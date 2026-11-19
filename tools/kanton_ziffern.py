# Die amtliche Ausnützungsziffer je Parzelle, aus der Nutzungsplanung.
#
# Gemessen am 19. November: in Thurgau, Zug und Luzern stand das Potenzial
# fast nirgends, weil im Zonennamen keine Ziffer steht («W2a Wohnzone 2a»)
# und die Potenzialrechnung ohne Ziffer nichts rechnet. Die Lieferungen
# nachgesehen, alle Elemente der Zonentypen gezählt:
#
#   * Zug: 2'447 Typen, davon 119 mit «Ausnützungsziffer» (100) oder
#     «Ausnutzungsziffer» (19) und einem Wert, 37 mit «Baumassenziffer»,
#     115 mit «vgl. Bauordnung» (Wert 0.00), die übrigen ohne Ziffer.
#   * Thurgau: 2'339 Typen, keiner mit Nutzungsziffer.
#   * Luzern: 3'182 Typen mit Nutzungsziffer, aber ohne Nutzungsziffer_Art.
#     Welche Ziffer es ist (Ausnützung oder Überbauung), steht nicht da;
#     raten wäre falsch. Ohne Fläche (Vermessung gegen Gebühr) rechnet dort
#     ohnehin kein Potenzial.
#
# Übernommen wird nur die Ausnützungsziffer: sie ist die Ziffer, mit der
# die Potenzialrechnung rechnet (Spalte ausnuetzung). Die Baumassenziffer
# steht in Zug nur bei Arbeitszonen und Wohn- und Arbeitszonen, die beide
# als «Keine Wohnnutzung» ausgeschlossen sind; sie umzurechnen brächte
# kein einziges Potenzial.
#
# Je Parzelle zählt die Zone mit der grössten Fläche, wie in
# kanton_haupt.py. Die Kennung des Typs steht im Verschnitt (zone_typ).
# Die kantonalen Typen (Typ_Kt) kommen in jeder Gemeindedatei mit
# derselben Kennung vor (131 in Zug, bis auf Schreibweisen gleich); sie
# tragen keine Ziffer. Die Typen der Gemeinden sind eindeutig.
#
# Daneben füllt tools/zonen_ziffern.py die Tabelle zone_ziffer mit den
# Flächen selbst, für die Frage per Punkt; die Potenzialrechnung liest sie
# nicht.
#
# Aufruf: python3 kanton_ziffern.py <verschnitten.csv> <aus.csv> <datei.xtf ...>
# Ausgegeben werden nur Zählungen.
import csv, re, sys
import xml.etree.ElementTree as ET
from collections import Counter

csv.field_size_limit(1 << 30)
# Dieselbe Erkennung wie im Ablauf «Zonenziffern» (art_kurz = 'az'): die
# Kantone schreiben die Art verschieden, auch mit Tippfehlern.
AUSNUETZUNG = re.compile(r'ausn(ü|u|ue)tzung|^\s*(max\.?\s*)?az\b', re.I)


def ohne_namensraum(tag):
    return tag.rsplit('}', 1)[-1]


def zahl(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def typen(dateien):
    ziffer = {}
    for pfad in dateien:
        for _, el in ET.iterparse(pfad, events=('end',)):
            name = ohne_namensraum(el.tag)
            if name.startswith('Nutzungsplanung') and (name.endswith('.Typ') or name.endswith('.Typ_Kt')):
                felder = {ohne_namensraum(k.tag): ' '.join(t.strip() for t in k.itertext() if t.strip()) for k in el}
                tid = (el.get('TID') or '').strip()
                if tid and tid not in ziffer:
                    ziffer[tid] = (felder.get('Nutzungsziffer_Art', ''), zahl(felder.get('Nutzungsziffer')))
                el.clear()
    return ziffer


def main(verschnitt, aus, *dateien):
    ziffer = typen(dateien)
    beste = {}
    with open(verschnitt, encoding='utf-8') as f:
        for z in csv.DictReader(f):
            e = (z.get('egrid') or '').strip()
            if not e:
                continue
            m2 = zahl(z.get('zone_m2')) or 0
            if e not in beste or m2 > beste[e][0]:
                beste[e] = (m2, (z.get('zone_typ') or '').strip())

    art = Counter()
    with open(aus, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['egrid', 'ausnuetzung'])
        for e, (_, typ) in sorted(beste.items()):
            a, wert = ziffer.get(typ, ('(Typ unbekannt)', None))
            art[a or '(ohne Angabe)'] += 1
            # 0.00 steht bei «vgl. Bauordnung» und bei Sonderzonen: keine Ziffer.
            if AUSNUETZUNG.search(a or '') and wert and 0 < wert < 5:
                w.writerow([e, wert])
    print(f'{len(ziffer)} Typen, {len(beste)} Parzellen im Verschnitt')
    print('Parzellen nach Art der Ziffer ihrer Hauptzone:')
    for a, n in art.most_common():
        print(f'{n:>8}  {a}')


if __name__ == '__main__':
    main(*sys.argv[1:])

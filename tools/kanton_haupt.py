# Eine Zeile je Parzelle aus dem Verschnitt von «Kanton laden», gerechnet
# auf dem Runner statt in der Datenbank (CLAUDE.md, «Die Datenbank bedient
# die Seite»). Bis zum 18. November lud der Ablauf den ganzen Verschnitt
# in eine Tabelle der Datenbank und suchte dort mit einer einzigen
# Anweisung die Hauptzone jeder Parzelle.
#
# Je Parzelle zählt die Zone mit der grössten Fläche. Sie steht so, wie
# die Zürcher Zonen stehen: Kürzel, Name und in Klammern Zonenfläche und
# Anteil, «W2b Wohnzone 2b (1357 m², 100%)». Die Klammer liest
# zone_parse(): ohne sie rechnet das Potenzial mit der ganzen Parzelle,
# auch wenn die Hälfte Wald ist (in Zürich Margen in Milliardenhöhe).
#
# Die BFS-Nummer kommt aus der Liste der Vermessung (av_liste.py), nicht
# aus dem Nummerierungsbereich: in Zug heisst er «ZG0200001701», und die
# Ziffern daraus wären 200001701, nicht Baar (1701).
#
# Ohne Verschnitt ('-' statt der Datei) kommt jede Liegenschaft der Liste
# ohne Zone: so schliessen sich Lücken, wo es (noch) keine Zonen gibt,
# etwa in Zürich, dessen Nutzungsplanung geodienste.ch nicht führt. Die
# Zone füllt ein späterer Lauf mit Verschnitt nach.
#
# Aufruf: python3 kanton_haupt.py <verschnitten.csv|-> <av.csv> <haupt.csv>
# Ausgegeben werden nur Zählungen.
import csv, os, sys


def zahl(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def zonentext(z):
    kurz = (z.get('zone_kurz') or '').strip()
    name = (z.get('zone_name') or '').strip()
    text = ' '.join(t for t in (kurz, name if name != kurz else '') if t)
    if not text:
        # Ohne Namen bleibt der Schlüssel allein stehen: «Zonennamen
        # nachziehen» sucht ihn genau so (p.zone = typ_id).
        return (z.get('zone_typ') or '').strip() or None
    m2, anteil = zahl(z.get('zone_m2')), zahl(z.get('anteil_prozent'))
    if m2 is not None and anteil is not None:
        text += f' ({round(m2)} m², {round(anteil)}%)'
    return text


def main(verschnitt, av, aus):
    bfs, nummer = {}, {}
    with open(av, encoding='utf-8') as f:
        for z in csv.DictReader(f):
            if z['egrid'] and not z['egrid'].startswith('ohne:'):
                bfs[z['egrid']] = z['bfs']
                nummer[z['egrid']] = z['nummer']

    beste = {}
    zeilen = 0
    if verschnitt == '-':
        with open(av, encoding='utf-8') as f:
            for z in csv.DictReader(f):
                if z['egrid'] and not z['egrid'].startswith('ohne:'):
                    beste[z['egrid']] = (0, {'parzelle': z['nummer'], 'flaeche_m2': z['flaeche']})
        verschnitt = os.devnull
    with open(verschnitt, encoding='utf-8') as f:
        for z in csv.DictReader(f):
            zeilen += 1
            e = (z.get('egrid') or '').strip()
            if not e:
                continue
            m2 = zahl(z.get('zone_m2')) or 0
            if e not in beste or m2 > beste[e][0]:
                beste[e] = (m2, z)

    ohne_bfs = 0
    with open(aus, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['egrid', 'parzelle', 'bfs_nr', 'flaeche', 'zone', 'notiz'])
        for e, (_, z) in sorted(beste.items()):
            b = bfs.get(e, '')
            ohne_bfs += not b
            fl = zahl(z.get('flaeche_m2'))
            notiz = (f"Zonenanteil {z.get('zone_m2') or '?'} m2 ({z.get('anteil_prozent') or '?'}%)"
                     if z.get('zone_m2') else 'Aus der Liste der Vermessung, noch ohne Zone')
            # Ein Verschnitt ohne Nummer (Zürich: Umrisse aus dem WFS) nimmt sie aus der Liste.
            w.writerow([e, z.get('parzelle') or nummer.get(e, ''), b, '' if fl is None else fl, zonentext(z) or '', notiz])
    print(f'{zeilen} Zeilen im Verschnitt, {len(beste)} Parzellen, {ohne_bfs} ohne BFS-Nummer')


if __name__ == '__main__':
    main(*sys.argv[1:4])

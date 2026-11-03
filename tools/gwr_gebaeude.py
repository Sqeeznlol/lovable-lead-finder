# Bereitet die Gebäude des Gebäude- und Wohnungsregisters (GWR) für die
# Tabelle `gebaeude` auf -- für die 3D-Karte, die jedes Haus nach
# Heizung, Baujahr oder Geschossen einfärbt.
#
# Eingabe: das entpackte Register von public.madd.bfs.admin.ch/<kt>.zip
# (Tabulator, Kopfzeile). Die Spaltennamen der Heizung (gwaerzh1,
# genh1, genw1, gwaerdath1, gebf, gvol) stehen so in der Antwort von
# api3.geo.admin.ch für dasselbe Register -- in der Datei selbst
# nachgesehen wird hier: fehlt eine Spalte, sagt das Skript es und
# bricht ab, statt leere Werte zu schreiben.
#
# Ausgabe:
#   gebaeude.csv  egid, egrid, baujahr, geschosse, wohnungen, grundflaeche,
#                 energieflaeche, volumen, kategorie, klasse, heizung,
#                 heizung_energie, warmwasser_energie, heizung_seit,
#                 zimmer, wohnflaeche (Summe der bestehenden Wohnungen)
#   kode.csv      merkmal, code, text -- nur die Merkmale, die die Karte zeigt
#
# Nur bestehende Gebäude und solche im Bau (wie gwr_zh.py): ein
# abgebrochenes Haus steht auf keiner Karte mehr.
#
# Ausgegeben werden nur Zählungen, nie Inhalte (das Protokoll ist öffentlich).
#
# Aufruf: python3 gwr_gebaeude.py <ordner> <gebaeude.csv> <kode.csv>
import csv, os, sys
from collections import Counter

ZAEHLT = {'1003', '1004'}   # im Bau, bestehend
# Ob die Codetabelle 'GENH1' oder 'GENH' schreibt, ist nicht nachgesehen:
# gespeichert wird der Stamm ohne Ziffer, und welche Namen vorkamen,
# steht im Protokoll.
MERKMALE = {'GWAERZH', 'GENH', 'GENW', 'GKAT', 'GKLAS', 'GSTAT', 'WSTAT'}
# Zimmer und Wohnfläche stehen je Wohnung, nicht je Gebäude. Spaltennamen
# wie in api3 für dasselbe Register (wazim, warea, wstat); hier in der
# Datei nachgesehen -- fehlt eine, bricht das Skript ab.
WOHNUNG_DATEI = 'wohnung_logement_abitazione.csv'
WOHNUNG_NOETIG = ['egid', 'wstat', 'wazim', 'warea']
# Bestehende Wohnungen. Der Text zum Code steht im Protokoll (Merkmal
# WSTAT); vor dem Schreiben dort nachsehen.
WOHNUNG_ZAEHLT = {'3004'}
NOETIG = ['egid', 'egrid', 'gstat', 'gbauj', 'gastw', 'ganzwhg', 'garea', 'gebf', 'gvol',
          'gkat', 'gklas', 'gwaerzh1', 'genh1', 'genw1', 'gwaerdath1']


def lesen(pfad):
    with open(pfad, newline='', encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t')
        kopf = [k.strip().lower() for k in next(r)]
        yield kopf
        for z in r:
            yield dict(zip(kopf, z))


def ganz(s):
    try:
        return str(int(float(s))) if s not in ('', None) else ''
    except ValueError:
        return ''


def datum(s):
    """15.04.2021 oder 2021-04-15 -> 2021-04-15; sonst leer."""
    s = (s or '').strip()
    if len(s) == 10 and s[2] == '.' and s[5] == '.':
        return f'{s[6:]}-{s[3:5]}-{s[:2]}'
    if len(s) == 10 and s[4] == '-' and s[7] == '-':
        return s
    return ''


def main():
    ordner, ziel, ziel_kode = sys.argv[1:4]
    datei = lambda name: os.path.join(ordner, name)

    zeilen = lesen(datei('gebaeude_batiment_edificio.csv'))
    kopf = next(zeilen)
    fehlt = [k for k in NOETIG if k not in kopf]
    if fehlt:
        print(f'FEHLT im Register: {", ".join(fehlt)}')
        print(f'Vorhandene Spalten: {", ".join(kopf)}')
        sys.exit(1)

    # Wohnungen je Gebäude: Zimmer und Fläche summieren.
    wohnung = {}
    wstat = Counter()
    pfad_w = datei(WOHNUNG_DATEI)
    if not os.path.exists(pfad_w):
        print(f'FEHLT: {WOHNUNG_DATEI}. Dateien im Register: {", ".join(sorted(os.listdir(ordner)))}')
        sys.exit(1)
    zw = lesen(pfad_w)
    kopf_w = next(zw)
    fehlt_w = [k for k in WOHNUNG_NOETIG if k not in kopf_w]
    if fehlt_w:
        print(f'FEHLT in {WOHNUNG_DATEI}: {", ".join(fehlt_w)}')
        print(f'Vorhandene Spalten: {", ".join(kopf_w)}')
        sys.exit(1)
    for w in zw:
        st = ganz(w.get('wstat')) or 'leer'
        wstat[st] += 1
        if st not in WOHNUNG_ZAEHLT:
            continue
        e = ganz(w.get('egid'))
        if not e:
            continue
        z, f = wohnung.get(e, (0, 0))
        wohnung[e] = (z + int(ganz(w.get('wazim')) or 0), f + int(ganz(w.get('warea')) or 0))

    n = n_alle = 0
    energie = Counter()
    with open(ziel, 'w', newline='') as f:
        w = csv.writer(f)
        for g in zeilen:
            n_alle += 1
            if g.get('gstat') not in ZAEHLT or not ganz(g.get('egid')):
                continue
            w.writerow([
                ganz(g['egid']), (g.get('egrid') or '').strip(),
                ganz(g.get('gbauj')), ganz(g.get('gastw')), ganz(g.get('ganzwhg')),
                ganz(g.get('garea')), ganz(g.get('gebf')), ganz(g.get('gvol')),
                ganz(g.get('gkat')), ganz(g.get('gklas')),
                ganz(g.get('gwaerzh1')), ganz(g.get('genh1')), ganz(g.get('genw1')),
                datum(g.get('gwaerdath1')),
                # 0 heisst: keine Angabe im Register -- leer lassen statt 0 zu behaupten.
                (wohnung.get(ganz(g['egid']), (0, 0))[0] or ''),
                (wohnung.get(ganz(g['egid']), (0, 0))[1] or ''),
            ])
            n += 1
            energie[ganz(g.get('genh1')) or 'leer'] += 1

    kodes = 0
    with open(ziel_kode, 'w', newline='') as f:
        w = csv.writer(f)
        zeilen = lesen(datei('kodes_codes_codici.csv'))
        next(zeilen)
        gesehen = set()
        namen = set()
        wstat_text = {}
        for k in zeilen:
            roh, c = (k.get('cmerkm') or '').strip().upper(), ganz(k.get('cecodid'))
            m = roh.rstrip('0123456789')
            if m in MERKMALE and c and (m, c) not in gesehen:
                gesehen.add((m, c))
                namen.add(roh)
                w.writerow([m, c, (k.get('codtxtld') or '').strip()])
                kodes += 1
                if m == 'WSTAT':
                    wstat_text[c] = (k.get('codtxtld') or '').strip()

    print(f'Gebäude im Register: {n_alle}, bestehend oder im Bau: {n}, Codes: {kodes}')
    print(f'Merkmale in der Codetabelle: {", ".join(sorted(namen))}')
    print(f'Wohnungen je Status (WSTAT), gezählt wird {sorted(WOHNUNG_ZAEHLT)}:')
    for code, anzahl in wstat.most_common():
        print(f'  {code} {wstat_text.get(code, "")}: {anzahl}')
    mit_flaeche = sum(1 for z, f in wohnung.values() if f)
    print(f'Gebäude mit Wohnungen: {len(wohnung)}, davon mit Wohnfläche: {mit_flaeche}')
    print('Energiequelle Heizung (GENH1), Anzahl Gebäude je Code:')
    for code, anzahl in energie.most_common():
        print(f'  {code}: {anzahl}')


if __name__ == '__main__':
    main()

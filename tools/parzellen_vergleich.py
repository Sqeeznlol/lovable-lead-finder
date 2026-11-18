# Sind alle Parzellen von ZH, TG, LU und ZG im Bestand, und mit welchen
# Angaben? Gleicht EGRID für EGRID ab (Julian, 18. November: «schau, dass
# wirklich alle Parzellen drin sind von ZH TG LU ZUG, mit allen Daten»).
#
# Massstab ist die Amtliche Vermessung (av_liste.py) für ZH, TG und ZG.
# Luzern gibt sie nur gegen Gebühr ab; dort ist der Massstab, was das
# Gebäuderegister an EGRID kennt, also die bebauten Parzellen.
#
# Eingaben: je Kanton eine Liste aus av_liste.py (av_<KT>.csv), für LU
# eine Liste von EGRID (gwr_lu.csv), und der Bestand (bestand.csv) mit
# kanton, egrid und je Angabe 't' oder 'f'. Ausgegeben werden nur
# Zählungen: das Protokoll ist öffentlich.
#
# Aufruf: python3 parzellen_vergleich.py <ordner>
import csv, os, sys
from collections import defaultdict

ORDNER = sys.argv[1]
KANTONE = ['ZH', 'TG', 'LU', 'ZG']
ANGABEN = ['flaeche', 'zone', 'umriss', 'adresse', 'bfs', 'baujahr', 'potenzial', 'gebaeude']


def lesen(name):
    pfad = os.path.join(ORDNER, name)
    if not os.path.exists(pfad):
        return None
    with open(pfad, encoding='utf-8') as f:
        return list(csv.DictReader(f))


bestand = defaultdict(list)
for z in lesen('bestand.csv') or []:
    bestand[z['kanton']].append(z)

print(f"{'Kanton':6} {'amtlich':>8} {'Bestand':>8} {'mit EGRID':>9} {'gefunden':>9} {'fehlen':>8} {'nur Bestand':>11} {'doppelt':>8}  Massstab")
fehlend = {}
for kt in KANTONE:
    if kt == 'LU':
        quelle = lesen('gwr_lu.csv')
        soll = {z['egrid'] for z in quelle or []}
        massstab = 'Gebäuderegister (nur bebaute Parzellen)'
    else:
        quelle = lesen(f'av_{kt}.csv')
        soll = {z['egrid'] for z in quelle or [] if not z['egrid'].startswith('ohne:')}
        massstab = 'Amtliche Vermessung (geodienste.ch)'
    zeilen = bestand.get(kt, [])
    mit = [z for z in zeilen if z['egrid']]
    ist = defaultdict(int)
    for z in mit:
        ist[z['egrid']] += 1
    gefunden = soll & set(ist)
    fehlend[kt] = len(soll - set(ist))
    print(f"{kt:6} {len(soll):>8} {len(zeilen):>8} {len(mit):>9} {len(gefunden):>9} {len(soll - set(ist)):>8} "
          f"{len(set(ist) - soll):>11} {sum(1 for n in ist.values() if n > 1):>8}  {massstab}")

print()
print('Angaben je Kanton, Anteil der Zeilen im Bestand, die sie haben:')
print(f"{'Kanton':6} " + ' '.join(f'{a:>10}' for a in ANGABEN))
for kt in KANTONE:
    zeilen = bestand.get(kt, [])
    if not zeilen:
        print(f'{kt:6} keine Zeilen')
        continue
    teile = []
    for a in ANGABEN:
        n = sum(1 for z in zeilen if z.get(a) == 't')
        teile.append(f'{100 * n / len(zeilen):>9.1f}%')
    print(f'{kt:6} ' + ' '.join(teile))

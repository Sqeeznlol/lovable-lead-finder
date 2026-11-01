# Die Baugesuche des Jahres aus dem Amtsblatt (Export von Julian,
# daten/amtsblatt-baugesuche-2026.csv) gegen die Quelle des täglichen
# Ablaufs halten: steht jede Publikation auch im Datensatz des
# Statistischen Amts? Dort gibt es Parzelle, Beschreibung und
# Bauherrschaft, im Amtsblatt-Export nur den Titel.
# Gibt die Zahlen aus und schreibt die Kennungen nach /tmp/ab_ids.txt.
import csv, io, urllib.request, collections

KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenpruefung)'}
QUELLE = 'https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00002982_00006183.csv'

ab = list(csv.DictReader(open('daten/amtsblatt-baugesuche-2026.csv', encoding='utf-8')))
with urllib.request.urlopen(urllib.request.Request(QUELLE, headers=KENNUNG), timeout=120) as r:
    roh = r.read().decode('utf-8', 'replace')
st = list(csv.DictReader(io.StringIO(roh)))
st_ids = {z['id'] for z in st}
daten = sorted(z['publicationDate'] for z in st if z.get('publicationDate'))
print('Amtsblatt-Export:', len(ab), 'Publikationen,', min(z['publiziert_am'] for z in ab), 'bis', max(z['publiziert_am'] for z in ab))
print('Statistik-Datensatz:', len(st), 'Zeilen,', len(st_ids), 'Publikationen,', daten[0], 'bis', daten[-1])
print('  davon seit 2026-01-01:', len({z['id'] for z in st if z.get('publicationDate', '') >= '2026-01-01'}))
drin = [z for z in ab if z['id'] in st_ids]
fehlt = [z for z in ab if z['id'] not in st_ids]
print('Amtsblatt-Publikationen im Statistik-Datensatz:', len(drin), '| fehlen dort:', len(fehlt))
print('  fehlende nach Monat:', sorted(collections.Counter(z['publiziert_am'][:7] for z in fehlt).items()))
print('  fehlende nach Zustand:', dict(collections.Counter(z['zustand'] for z in fehlt)))
print('  Beispiele fehlend:', [z['titel'][:60] for z in fehlt[:5]])
open('/tmp/ab_ids.txt', 'w').write('\n'.join(z['id'] for z in ab) + '\n')

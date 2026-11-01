# Nachsehen statt annehmen: welche Datensaetze opendata.swiss zu
# Baugesuchen fuehrt, mit welchen Dateien -- und wie die erste CSV-Datei
# des Zuercher Datensatzes aufgebaut ist (Spalten und zwei Zeilen).
import csv, io, json, sys, urllib.request

def holen(url, n=None):
    # Gemessen am 1. November: ohne Browser-Kennung antwortet
    # opendata.swiss mit 403.
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenpruefung)', 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(n) if n else r.read()

d = json.loads(holen('https://ckan.opendata.swiss/api/3/action/package_search?q=baugesuch&rows=20'))['result']
print('Treffer:', d['count'])
csvs = []
for p in d['results']:
    titel = (p.get('title') or {}).get('de')
    print('\n#', p['name'], '|', titel, '|', (p.get('organization') or {}).get('name'))
    print('  geaendert:', p.get('metadata_modified'), '| Rhythmus:', p.get('accrual_periodicity'))
    for r in p.get('resources', [])[:10]:
        url = r.get('download_url') or r.get('url')
        print('  -', r.get('format'), '|', (r.get('title') or {}).get('de'), '|', url)
        if (r.get('format') or '').upper() == 'CSV' and 'zh' in (p.get('organization') or {}).get('name', '').lower() + p['name']:
            csvs.append(url)

for url in csvs[:2]:
    print('\n## Aufbau', url)
    try:
        roh = holen(url, 200_000).decode('utf-8', 'replace')
        zeilen = list(csv.reader(io.StringIO(roh), delimiter=';' if roh.count(';') > roh.count(',') else ','))
        print('Spalten:', zeilen[0])
        for z in zeilen[1:3]:
            # Bauherrschaft kann eine Person sein: nur Laenge zeigen.
            print('Zeile:', [w if i < len(zeilen[0]) and 'bauherr' not in zeilen[0][i].lower() else f'<{len(w)} Zeichen>' for i, w in enumerate(z)])
    except Exception as e:
        print('Fehler:', e)

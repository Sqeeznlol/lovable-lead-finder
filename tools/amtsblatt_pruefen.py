# Welche Adresse im Amtsblattportal zeigt ein Baugesuch? Nachsehen statt
# raten: eine echte Publikation aus der Zuercher Quelle nehmen und die
# moeglichen Wege abfragen -- API und Seite -- mit Status, Inhaltstyp und
# ob die Publikationsnummer im Ergebnis vorkommt.
import csv, io, json, urllib.request

KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenpruefung)', 'Accept': '*/*'}
def holen(url, n=None):
    req = urllib.request.Request(url, headers=KENNUNG)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.headers.get('content-type', ''), r.read(n) if n else r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('content-type', ''), b''
    except Exception as e:
        return 0, str(e)[:80], b''

_, _, roh = holen('https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00002982_00006183.csv', 400_000)
zeilen = list(csv.reader(io.StringIO(roh.decode('utf-8', 'replace'))))
kopf = zeilen[0]; z = zeilen[1]
pid, nr = z[kopf.index('id')], z[kopf.index('publicationNumber')]
print('Publikation:', nr, 'Kennung:', pid)
print('Spalten mit Datum:', [(k, z[i]) for i, k in enumerate(kopf) if 'Date' in k or 'Deadline' in k])

for url in [
    f'https://www.amtsblattportal.ch/api/v1/publications/{pid}',
    f'https://www.amtsblattportal.ch/api/v1/publications/{pid}/xml',
    f'https://www.amtsblattportal.ch/api/v1/publications?publicationNumber={nr}',
    f'https://www.amtsblattportal.ch/#!/search/publications/detail/{pid}',
    f'https://amtsblattportal.ch/#!/search/publications/detail/{pid}',
    f'https://www.amtsblatt.zh.ch/#!/search/publications/detail/{pid}',
]:
    s, t, b = holen(url, 300_000)
    text = b.decode('utf-8', 'replace')
    print(f'\n{url}\n  HTTP {s} | {t[:40]} | {len(b)} Bytes | Nummer drin: {nr in text} | Kennung drin: {pid in text}')
    if s == 200 and 'json' in t:
        try:
            j = json.loads(text)
            print('  Schluessel:', list(j.keys())[:20] if isinstance(j, dict) else type(j).__name__)
        except Exception as e:
            print('  kein JSON:', e)
    elif s == 200 and 'xml' in t:
        print('  Anfang:', text[:300].replace('\n', ' '))

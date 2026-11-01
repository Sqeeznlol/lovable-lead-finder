# Wie viele Liegenschaften hat der Kanton Zürich laut Amtlicher
# Vermessung? Nachsehen statt raten: die WFS-Dienste von geodienste.ch
# und vom Kanton (maps.zh.ch) fragen, welche Objektarten es gibt, und je
# Art die Anzahl (resultType=hits) und die Feldnamen eines Beispiels.
# Ausgegeben werden nur Zahlen und Feldnamen.
import re, urllib.request, urllib.parse

KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenpruefung)'}
DIENSTE = {
    'geodienste av_0': 'https://geodienste.ch/db/av_0/deu',
    'Kanton ZH AVZHWFS': 'https://maps.zh.ch/wfs/AVZHWFS',
}

def holen(url, n=400_000):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=120) as r:
            return r.status, r.read(n).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read(2000).decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)[:200]

for name, basis in DIENSTE.items():
    print(f'== {name}')
    s, cap = holen(f'{basis}?SERVICE=WFS&REQUEST=GetCapabilities')
    typen = re.findall(r'<(?:wfs:)?Name>([^<]+)</(?:wfs:)?Name>', cap)
    print(f'  Fähigkeiten: HTTP {s}, {len(typen)} Objektarten')
    print('  Arten:', ', '.join(typen[:60]))
    for t in [t for t in typen if re.search(r'liegenschaft|grundst|parzell|lcsf|bodenbed', t, re.I)][:6]:
        q = urllib.parse.urlencode({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': t, 'RESULTTYPE': 'hits'})
        s2, hits = holen(f'{basis}?{q}', 4000)
        m = re.search(r'numberMatched="([^"]+)"', hits)
        print(f'  {t}: HTTP {s2}, numberMatched={m.group(1) if m else "?"} {"" if m else hits[:160].replace(chr(10), " ")}')
        q = urllib.parse.urlencode({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': t, 'COUNT': '1'})
        s3, bsp = holen(f'{basis}?{q}', 20000)
        felder = sorted(set(re.findall(r'<(?:[\w-]+:)?([A-Za-z_][\w-]*)>[^<]{0,80}</', bsp)))
        print(f'    Felder im Beispiel ({s3}):', ', '.join(felder[:40]))

# Baut ein schlankes Inhaltsverzeichnis der 3D-Gebäude für den Kanton
# Zürich (public/3d/zh/).
#
# Warum: Das Verzeichnis des Bundes (swissBUILDINGS3D, 3D Tiles) ist in
# sechs Teile von je 6 bis 11 MB geschnitten, unkomprimiert ausgeliefert.
# Die 3D-Karte über Albisrieden lud am 3. November 24 MB Verzeichnis für
# 2,7 MB Häuser -- auf dem Handy der Grund, warum sie so langsam kam.
#
# Wie: Im Baum des Bundes hängt jede Hauskachel als Blatt (Fehlerwert 0)
# unter einem leeren Knoten, dessen Fehlerwert bestimmt, ab welcher
# Entfernung sie geladen wird (nachgesehen: alle 53'655 Zürcher Kacheln
# auf Tiefe 12, ohne transform, refine ADD nur oben). Diese Paare bleiben
# unverändert; sie werden nur in Felder von 2 x 2 km sortiert, je Feld
# ein kleines Verzeichnis. Ein Feld trägt den grössten Fehlerwert seiner
# Paare und umschliesst sie -- so wird es nie später geöffnet, als eines
# seiner Paare es verlangt hätte. Die Hauskacheln selbst kommen weiter
# vom Bund (absolute Adressen).
#
# Der Ordner mit der Fassung des Bundes (z.B. 20260520) steht in den
# Adressen. Wechselt der Bund die Fassung, muss neu gebaut werden -- der
# Ablauf "3D-Gebäude" prüft das.
#
# Aufruf: python3 -I tools/gebaeude_kacheln.py <zielordner>
import json, math, os, shutil, sys, urllib.request

BUND = 'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/'
# Kanton Zürich mit etwas Rand, in Grad (West, Süd, Ost, Nord).
ZH = (8.35, 47.15, 9.00, 47.70)
FELD_M = 2000


def lade(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)


def rad(x): return math.radians(x)


ZH_RAD = [rad(x) for x in ZH]


def schneidet(r):
    return not (r[2] < ZH_RAD[0] or r[0] > ZH_RAD[2] or r[3] < ZH_RAD[1] or r[1] > ZH_RAD[3])


# Grenzen nach aussen runden: ein Umschluss darf grösser sein, nie kleiner.
def ab(x, s): return math.floor(x * 10 ** s) / 10 ** s
def auf(x, s): return math.ceil(x * 10 ** s) / 10 ** s


def region(r):
    return [ab(r[0], 8), ab(r[1], 8), auf(r[2], 8), auf(r[3], 8), ab(r[4], 1), auf(r[5], 1)]


def vereinige(rs):
    return [min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs),
            max(r[3] for r in rs), min(r[4] for r in rs), max(r[5] for r in rs)]


def main():
    ziel = sys.argv[1]
    wurzel = lade(BUND + 'tileset.json')
    # Die Wurzel verweist auf den Ordner der aktuellen Fassung.
    def verweise(n):
        c = n.get('content', {}).get('uri')
        if c: yield c
        for k in n.get('children', []): yield from verweise(k)
    fassung_datei = next(verweise(wurzel['root']))
    fassung = fassung_datei.split('/')[0]
    basis = BUND + fassung + '/'

    paare = []  # (knoten mit einem blatt, mitte lon, mitte lat)
    dateien = 0

    def gehe(n, eltern_basis):
        nonlocal dateien
        c = n.get('content', {}).get('uri')
        if c and c.endswith('.json'):
            if schneidet(n['boundingVolume']['region']):
                dateien += 1
                gehe(lade(eltern_basis + c)['root'], eltern_basis)
            return
        kinder = n.get('children', [])
        blaetter = [k for k in kinder if k.get('content', {}).get('uri', '').endswith('.b3dm')]
        if blaetter and len(blaetter) == len(kinder) and not c:
            r = n['boundingVolume']['region']
            if schneidet(r):
                knoten = {
                    'boundingVolume': {'region': region(r)},
                    'geometricError': auf(n['geometricError'], 1),
                    'children': [{
                        'boundingVolume': {'region': region(b['boundingVolume']['region'])},
                        'geometricError': 0,
                        'content': {'uri': eltern_basis + b['content']['uri']},
                    } for b in blaetter],
                }
                paare.append((knoten, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2))
            return
        if c:
            raise SystemExit(f'Unerwartet: Inhalt {c} ausserhalb eines Blattpaars -- Aufbau des Bundes geändert.')
        if 'transform' in n:
            raise SystemExit('Unerwartet: transform im Baum -- Aufbau des Bundes geändert.')
        for k in kinder:
            gehe(k, eltern_basis)

    gehe(lade(basis + fassung_datei.split('/', 1)[1])['root'], basis)

    # Felder von FELD_M Metern, gezählt ab der Südwestecke.
    m_lat = 6371000.0
    m_lon = m_lat * math.cos(rad(47.4))
    felder = {}
    for knoten, lon, lat in paare:
        i = int((lon - ZH_RAD[0]) * m_lon // FELD_M)
        j = int((lat - ZH_RAD[1]) * m_lat // FELD_M)
        felder.setdefault((i, j), []).append(knoten)

    if os.path.isdir(ziel):
        shutil.rmtree(ziel)
    os.makedirs(os.path.join(ziel, 'f'))
    kinder = []
    groesse = 0
    for (i, j), knoten in sorted(felder.items()):
        reg = vereinige([k['boundingVolume']['region'] for k in knoten])
        ge = max(k['geometricError'] for k in knoten)
        name = f'f/{i}_{j}.json'
        text = json.dumps({
            'asset': {'version': '1.0'}, 'geometricError': ge,
            'root': {'boundingVolume': {'region': reg}, 'geometricError': ge, 'refine': 'ADD', 'children': knoten},
        }, separators=(',', ':'))
        with open(os.path.join(ziel, name), 'w') as f:
            f.write(text)
        groesse += len(text)
        kinder.append({'boundingVolume': {'region': reg}, 'geometricError': ge, 'content': {'uri': name}})

    alle = vereinige([k['boundingVolume']['region'] for k in kinder])
    with open(os.path.join(ziel, 'tileset.json'), 'w') as f:
        json.dump({
            'asset': {'version': '1.0', 'extras': {'quelle': BUND, 'fassung': fassung}},
            'geometricError': 5000,
            'root': {'boundingVolume': {'region': alle}, 'geometricError': 5000, 'refine': 'ADD', 'children': kinder},
        }, f, separators=(',', ':'))

    wurzel_kb = os.path.getsize(os.path.join(ziel, 'tileset.json')) // 1024
    print(f'Fassung des Bundes: {fassung}')
    print(f'Verzeichnisse des Bundes gelesen: {dateien}, Hauskacheln im Kanton: {len(paare)}')
    print(f'Felder: {len(felder)}, Wurzel {wurzel_kb} kB, Felder zusammen {groesse // 1024} kB, '
          f'grösstes {max(len(json.dumps(v)) for v in felder.values()) // 1024} kB')


if __name__ == '__main__':
    main()

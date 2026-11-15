# Holt die Umrisse aller Liegenschaften der Amtlichen Vermessung Zürich
# aus dem WFS des Kantons (maps.zh.ch/wfs/AVZHWFS, Ebene
# liegenschaften_f) und schreibt sie als CSV: wkt, egrid.
#
# Warum erst jetzt: bis zum 15. November reichte der Platz der Datenbank
# nicht (av_zh_laden.py holt darum nur EGRID, Nummer und Fläche). Mit
# Supabase Pro passt es -- gemessen am Thurgau: 406 Bytes je Umriss,
# für Zürich also rund 160 MB.
#
# Der Aufbau der Antwort ist nachgesehen, nicht angenommen (Abruf mit
# COUNT=2 am 15. November):
#   ms:liegenschaften_f > ms:geometry > gml:MultiSurface
#     > gml:surfaceMember > gml:Polygon
#       > gml:exterior / gml:interior > gml:LinearRing > gml:posList
# Die Grenzen kommen schon als Linienzüge, ohne Kreisbögen; darum
# genügt es, die Koordinatenlisten zu lesen.
#
# Eine Liegenschaft kann aus mehreren Stücken bestehen, die der Dienst
# als mehrere Objekte mit derselben EGRID liefert (392'666 Objekte auf
# 391'418 EGRID). Sie werden zu einem MULTIPOLYGON je EGRID vereint --
# sonst gewänne beim Schreiben das zufällig erste Stück.
#
# Geblättert wird wie in av_zh_laden.py mit fester Sortierung, und am
# Schluss wird die Anzahl gegen den Dienst geprüft.
#
# Aufruf: python3 av_zh_umrisse.py <umrisse.csv> [höchstens_seiten]
import csv, re, sys, time, urllib.error, urllib.parse, urllib.request

BASIS = 'https://maps.zh.ch/wfs/AVZHWFS'
KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenbezug)'}
ART = 'liegenschaften_f'
SEITE = 2000


def holen(param, versuche=6):
    url = BASIS + '?' + urllib.parse.urlencode(param)
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=600) as r:
                return r.read().decode('utf-8', 'replace')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            warte = 5 * (2 ** i)
            print(f'  Fehler ({str(e)[:80]}), neuer Versuch in {warte}s', flush=True)
            time.sleep(warte)
    raise SystemExit('Dienst antwortet nicht.')


def ring(poslist):
    """'x y x y ...' -> '(x y, x y, ...)', in Millimetern wie geliefert."""
    z = poslist.split()
    if len(z) < 8 or len(z) % 2:
        return None   # weniger als vier Punkte ist kein Ring
    punkte = [f'{float(z[i]):.3f} {float(z[i + 1]):.3f}' for i in range(0, len(z), 2)]
    if punkte[0] != punkte[-1]:
        punkte.append(punkte[0])
    return '(' + ', '.join(punkte) + ')'


def polygone(block):
    """Alle Polygone eines Objekts, je als '((aussen), (innen), ...)'."""
    for poly in re.findall(r'<gml:Polygon\b[^>]*>(.*?)</gml:Polygon>', block, re.S):
        aussen = re.search(r'<gml:exterior>.*?<gml:posList[^>]*>([^<]*)</gml:posList>', poly, re.S)
        if not aussen:
            continue
        a = ring(aussen.group(1))
        if not a:
            continue
        innen = [ring(p) for p in re.findall(r'<gml:interior>.*?<gml:posList[^>]*>([^<]*)</gml:posList>', poly, re.S)]
        yield '(' + ', '.join([a] + [i for i in innen if i]) + ')'


def anzahl():
    xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                 'TYPENAMES': f'ms:{ART}', 'RESULTTYPE': 'hits'})
    m = re.search(r'numberMatched="(\d+)"', xml)
    if not m:
        raise SystemExit(f'Keine Anzahl: {xml[:200]}')
    return int(m.group(1))


def main():
    ziel = sys.argv[1]
    hoechstens = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    soll = anzahl()
    print(f'{ART}: {soll} laut Dienst', flush=True)

    je_egrid, gesehen = {}, set()
    ohne_egrid = ohne_umriss = 0
    start = seite = 0
    while start < soll:
        xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                     'TYPENAMES': f'ms:{ART}', 'COUNT': SEITE, 'STARTINDEX': start,
                     'SORTBY': 'objectid'})
        bloecke = re.findall(rf'<ms:{ART}\b[^>]*>(.*?)</ms:{ART}>', xml, re.S)
        if not bloecke:
            print(f'  leere Seite bei {start}', flush=True)
            break
        for b in bloecke:
            oid = re.search(r'<ms:objectid>([^<]*)</ms:objectid>', b)
            oid = oid.group(1).strip() if oid else None
            if oid in gesehen:
                continue
            gesehen.add(oid)
            e = re.search(r'<ms:egris_egrid>([^<]*)</ms:egris_egrid>', b)
            egrid = e.group(1).strip() if e else ''
            if not egrid:
                ohne_egrid += 1
                continue
            teile = list(polygone(b))
            if not teile:
                ohne_umriss += 1
                continue
            je_egrid.setdefault(egrid, []).extend(teile)
        start += len(bloecke)
        seite += 1
        if seite % 20 == 0:
            print(f'  {start} / {soll}', flush=True)
        if hoechstens and seite >= hoechstens:
            print(f'  Probe: nach {seite} Seiten aufgehört', flush=True)
            break

    with open(ziel, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['wkt', 'egrid'])
        for egrid, teile in je_egrid.items():
            w.writerow(['MULTIPOLYGON(' + ', '.join(teile) + ')', egrid])

    mehrteilig = sum(1 for t in je_egrid.values() if len(t) > 1)
    print(f'Objekte gesehen: {len(gesehen)}, verschiedene EGRID mit Umriss: {len(je_egrid)}', flush=True)
    print(f'davon mehrteilig: {mehrteilig}, ohne EGRID: {ohne_egrid}, ohne Umriss: {ohne_umriss}', flush=True)
    if not hoechstens and len(gesehen) != soll:
        raise SystemExit(f'Unvollständig: {len(gesehen)} statt {soll}.')


if __name__ == '__main__':
    main()

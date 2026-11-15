# Holt die Umrisse aller Liegenschaften eines Kantons aus dem WFS der
# Amtlichen Vermessung bei geodienste.ch (Ebene RESF) und schreibt sie
# als CSV: wkt, egrid.
#
# Warum geodienste.ch und nicht der Dienst des Kantons Zürich
# (maps.zh.ch): der antwortet einem GitHub-Runner nicht -- gemessen am
# 15. November, Zeitüberschreitung beim Verbindungsaufbau nach zehn
# Minuten. geodienste.ch führt dieselben Daten für 21 Kantone hinter
# einer Adresse; damit taugt dieses Werkzeug für jeden davon.
#
# Nachgesehen am 15. November, nicht angenommen:
#   * Felder von ms:RESF: BFSNr, NBIdent, Nummer, EGRIS_EGRID,
#     Vollstaendigkeit, Flaeche, Kanton, msGeometry
#   * die Geometrie kommt als gml:Polygon mit gml:exterior /
#     gml:interior > gml:LinearRing > gml:posList, als Linienzüge
#   * Filter Kanton = 'ZH' liefert 391'437 Objekte; sortiert nach
#     EGRIS_EGRID blättert der Dienst stabil, 5000 je Seite in 4 Sekunden
#
# Eine Liegenschaft aus mehreren Stücken liefert der Dienst als mehrere
# Objekte mit derselben EGRID. Sie werden zu einem MULTIPOLYGON vereint
# -- sonst gewänne beim Schreiben das zufällig erste Stück.
#
# Die Sortierung nach EGRID ist bei solchen Stücken nicht eindeutig.
# Darum zählt jedes Objekt nur einmal (über seine gml:id), und am
# Schluss wird die Anzahl gegen den Dienst geprüft; stimmt sie nicht,
# bricht das Werkzeug ab, statt halbe Daten zu liefern.
#
# Aufruf: python3 umrisse_laden.py <Kanton> <umrisse.csv> [höchstens_seiten]
import csv, re, sys, time, urllib.error, urllib.parse, urllib.request

BASIS = 'https://geodienste.ch/db/av_0/deu'
KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenbezug)'}
SEITE = 5000


def holen(param, versuche=6):
    url = BASIS + '?' + urllib.parse.urlencode(param)
    for i in range(versuche):
        try:
            # 120 Sekunden genügen: eine Seite kommt in vier. Eine längere
            # Frist liesse einen toten Dienst den Lauf eine Stunde aufhalten.
            with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=120) as r:
                return r.read().decode('utf-8', 'replace')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            warte = 5 * (2 ** i)
            print(f'  Fehler ({str(e)[:80]}), neuer Versuch in {warte}s', flush=True)
            time.sleep(warte)
    raise SystemExit('Dienst antwortet nicht.')


def filter_kanton(kanton):
    return ('<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo>'
            '<fes:ValueReference>Kanton</fes:ValueReference>'
            f'<fes:Literal>{kanton}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>')


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


def anzahl(kanton):
    xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                 'TYPENAMES': 'ms:RESF', 'RESULTTYPE': 'hits', 'FILTER': filter_kanton(kanton)})
    m = re.search(r'numberMatched="(\d+)"', xml)
    if not m:
        raise SystemExit(f'Keine Anzahl: {xml[:200]}')
    return int(m.group(1))


def main():
    kanton, ziel = sys.argv[1].upper(), sys.argv[2]
    if not re.fullmatch(r'[A-Z]{2}', kanton):
        raise SystemExit('Kanton als Kürzel, z.B. ZH.')
    hoechstens = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    soll = anzahl(kanton)
    print(f'Liegenschaften {kanton}: {soll} laut Dienst', flush=True)
    if soll == 0:
        raise SystemExit('Der Dienst führt für diesen Kanton keine Liegenschaften (nicht freigegeben?).')

    je_egrid, gesehen = {}, set()
    ohne_egrid = ohne_umriss = 0
    start = seite = 0
    while start < soll:
        xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                     'TYPENAMES': 'ms:RESF', 'COUNT': SEITE, 'STARTINDEX': start,
                     'SORTBY': 'EGRIS_EGRID', 'FILTER': filter_kanton(kanton)})
        bloecke = re.findall(r'<ms:RESF gml:id="([^"]+)">(.*?)</ms:RESF>', xml, re.S)
        if not bloecke:
            print(f'  leere Seite bei {start}', flush=True)
            break
        for kennung, b in bloecke:
            if kennung in gesehen:
                continue
            gesehen.add(kennung)
            e = re.search(r'<ms:EGRIS_EGRID>([^<]*)</ms:EGRIS_EGRID>', b)
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
        if seite % 10 == 0:
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

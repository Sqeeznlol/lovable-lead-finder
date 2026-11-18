# Alle Liegenschaften eines Kantons laut Amtlicher Vermessung, ohne
# Umriss: EGRID, Nummer, BFS-Nummer, Fläche. Quelle ist der WFS von
# geodienste.ch (Ebene RESF), der dieselben Daten für 21 Kantone führt.
#
# Nachgesehen am 18. November, nicht angenommen:
#   * frei erhältlich sind dort ZH, TG und ZG; Luzern verlangt eine
#     Freigabe (kostenpflichtig, geoportal.lu.ch/Geodaten/Gebuehren) und
#     liefert 0 Objekte;
#   * Treffer je Kanton (resultType=hits): ZH 391'437, TG 137'274,
#     ZG 24'646. Eine Liegenschaft aus mehreren Stücken kommt als
#     mehrere Objekte mit derselben EGRID;
#   * PROPERTYNAME ohne Geometrie: eine Seite kommt in unter einer Sekunde.
#
# Jedes Objekt zählt einmal (über seine gml:id); am Schluss wird die
# Zahl gegen den Dienst geprüft. Stimmt sie nicht, bricht das Werkzeug
# ab, statt eine halbe Liste als vollständig auszugeben.
#
# Aufruf: python3 av_liste.py <Kanton> <aus.csv>
import csv, re, sys, time, urllib.error, urllib.parse, urllib.request

BASIS = 'https://geodienste.ch/db/av_0/deu'
KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenbezug)'}
SEITE = 10000


def holen(param, versuche=6):
    url = BASIS + '?' + urllib.parse.urlencode(param)
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=180) as r:
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


def feld(block, name):
    m = re.search(rf'<ms:{name}>([^<]*)</ms:{name}>', block)
    return m.group(1).strip() if m else ''


def liste(kanton):
    grund = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': 'ms:RESF', 'FILTER': filter_kanton(kanton)}
    m = re.search(r'numberMatched="(\d+)"', holen({**grund, 'RESULTTYPE': 'hits'}))
    soll = int(m.group(1)) if m else -1
    gesehen, je_egrid = set(), {}
    start = 0
    while True:
        xml = holen({**grund, 'COUNT': SEITE, 'STARTINDEX': start, 'SORTBY': 'ms:EGRIS_EGRID',
                     'PROPERTYNAME': 'ms:EGRIS_EGRID,ms:Nummer,ms:BFSNr,ms:Flaeche,ms:Vollstaendigkeit'})
        bloecke = re.findall(r'<ms:RESF gml:id="([^"]+)">(.*?)</ms:RESF>', xml, re.S)
        for gid, b in bloecke:
            if gid in gesehen:
                continue
            gesehen.add(gid)
            e = feld(b, 'EGRIS_EGRID') or f'ohne:{gid}'
            fl = float(feld(b, 'Flaeche') or 0)
            if e in je_egrid:
                je_egrid[e]['flaeche'] += fl
                je_egrid[e]['stuecke'] += 1
            else:
                je_egrid[e] = {'egrid': e, 'nummer': feld(b, 'Nummer'), 'bfs': feld(b, 'BFSNr'), 'flaeche': fl,
                               'vollstaendig': feld(b, 'Vollstaendigkeit'), 'stuecke': 1}
        start += SEITE
        if len(bloecke) < SEITE:
            break
    if soll >= 0 and len(gesehen) != soll:
        raise SystemExit(f'{kanton}: {len(gesehen)} Objekte gelesen, der Dienst meldet {soll}. Abbruch.')
    return soll, list(je_egrid.values())


if __name__ == '__main__':
    kanton, aus = sys.argv[1].upper(), sys.argv[2]
    soll, zeilen = liste(kanton)
    with open(aus, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['egrid', 'nummer', 'bfs', 'flaeche', 'vollstaendig', 'stuecke'])
        w.writeheader()
        w.writerows(zeilen)
    ohne = sum(1 for z in zeilen if z['egrid'].startswith('ohne:'))
    print(f'{kanton}: {soll} Objekte, {len(zeilen) - ohne} Liegenschaften mit EGRID, {ohne} ohne EGRID, '
          f'{sum(1 for z in zeilen if z["stuecke"] > 1)} aus mehreren Stücken')

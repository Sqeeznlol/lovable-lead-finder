# Holt alle Liegenschaften der Amtlichen Vermessung Zürich aus dem
# WFS des Kantons (maps.zh.ch/wfs/AVZHWFS, Ebene liegenschaften_f) und
# die Gemeindenamen (gemeinden_f) -- als zwei CSV-Dateien.
#
# Ohne Umriss: der Platz in der Datenbank reicht dafür nicht, und
# EGRID, Nummer, BFS-Nummer und Fläche genügen, um jede Parzelle zu
# führen und anzureichern. Die Feldnamen stammen aus dem Lauf
# Auswerten/parzellen-zh vom 1. November, nicht aus einer Annahme:
#   liegenschaften_f: egris_egrid, nummer, bfsnr, flaechenmass, nbident
#
# Geblättert wird mit STARTINDEX/COUNT und fester Sortierung -- ohne
# Sortierung darf ein Dienst die Reihenfolge zwischen zwei Seiten
# ändern, und dann fehlen Parzellen oder kommen doppelt. Am Schluss
# wird die Anzahl gegen numberMatched geprüft; stimmt sie nicht,
# bricht das Werkzeug ab, statt halbe Daten zu liefern.
#
# Aufruf: python3 av_zh_laden.py <parzellen.csv> <gemeinden.csv>
import csv, re, sys, time, urllib.error, urllib.parse, urllib.request

BASIS = 'https://maps.zh.ch/wfs/AVZHWFS'
KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenbezug)'}
SEITE = 5000


def holen(param, versuche=5):
    url = BASIS + '?' + urllib.parse.urlencode(param)
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=300) as r:
                return r.read().decode('utf-8', 'replace')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            warte = 5 * (2 ** i)
            print(f'  Fehler ({str(e)[:80]}), neuer Versuch in {warte}s', flush=True)
            time.sleep(warte)
    raise SystemExit('Dienst antwortet nicht.')


def objekte(xml, art):
    # Jedes Objekt als Wörterbuch seiner einfachen Felder. Geometrie
    # und verschachtelte Teile fallen weg, weil sie Unterelemente haben.
    for block in re.findall(rf'<ms:{art}\b[^>]*>(.*?)</ms:{art}>', xml, re.S):
        yield {k: v.strip() for k, v in re.findall(r'<ms:(\w+)>([^<]*)</ms:\1>', block)}


def anzahl(art):
    xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                 'TYPENAMES': f'ms:{art}', 'RESULTTYPE': 'hits'})
    m = re.search(r'numberMatched="(\d+)"', xml)
    if not m:
        raise SystemExit(f'Keine Anzahl für {art}: {xml[:200]}')
    return int(m.group(1))


def alle(art, felder, sortierung):
    soll = anzahl(art)
    print(f'{art}: {soll} laut Dienst', flush=True)
    gesehen, zeilen = set(), []
    start = 0
    while start < soll:
        param = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                 'TYPENAMES': f'ms:{art}', 'COUNT': SEITE, 'STARTINDEX': start,
                 'SORTBY': sortierung, 'PROPERTYNAME': ','.join(felder)}
        teil = list(objekte(holen(param), art))
        if not teil:
            print(f'  leere Seite bei {start}', flush=True)
            break
        for o in teil:
            schluessel = o.get(sortierung)
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            zeilen.append(o)
        start += len(teil)
        if (start // SEITE) % 10 == 0:
            print(f'  {start} / {soll}', flush=True)
    print(f'{art}: {len(zeilen)} verschiedene geholt', flush=True)
    if len(zeilen) != soll:
        raise SystemExit(f'Unvollständig: {len(zeilen)} statt {soll}.')
    return zeilen


def main():
    ziel_parzellen, ziel_gemeinden = sys.argv[1], sys.argv[2]

    # Gemeinden zuerst: klein, und ihre Feldnamen werden ausgegeben,
    # damit die Zuordnung Name -> BFS-Nummer nachprüfbar ist.
    xml = holen({'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature',
                 'TYPENAMES': 'ms:gemeinden_f', 'COUNT': 1000})
    gem = list(objekte(xml, 'gemeinden_f'))
    print(f'gemeinden_f: {len(gem)} Objekte, Felder: {sorted(gem[0]) if gem else "-"}', flush=True)
    namefeld = next((k for k in (gem[0] if gem else {}) if re.fullmatch(r'(gemeinde)?name|gemeindename|name', k, re.I)), None)
    print(f'  Namensfeld: {namefeld}', flush=True)
    with open(ziel_gemeinden, 'w', newline='') as f:
        w = csv.writer(f)
        for g in gem:
            w.writerow([g.get('bfsnr', ''), g.get(namefeld, '') if namefeld else ''])

    felder = ['objectid', 'egris_egrid', 'nummer', 'bfsnr', 'flaechenmass', 'nbident']
    zeilen = alle('liegenschaften_f', felder, 'objectid')
    with open(ziel_parzellen, 'w', newline='') as f:
        w = csv.writer(f)
        for o in zeilen:
            w.writerow([o.get('egris_egrid', ''), o.get('nummer', ''), o.get('bfsnr', ''),
                        o.get('flaechenmass', ''), o.get('nbident', '')])
    ohne = sum(1 for o in zeilen if not o.get('egris_egrid'))
    print(f'davon ohne EGRID: {ohne}', flush=True)


if __name__ == '__main__':
    main()

"""Amtliche Immobilienpreise je Gemeinde für den Check (public/preise.json der Akquise).

Nur Kantone mit amtlichen Zahlen je Gemeinde als Datei (Recherche 15. November 2026):
  ZH  Statistisches Amt, «Immobilienpreise im Kanton Zürich» (opendata.swiss):
      Einfamilienhaus und Eigentumswohnung (Median ab 15 Verkäufen), Wohnbauland CHF/m²
      (bezahlter Median ab 4 Fällen, sonst Modellwert des Amts).
  BL  data.bl.ch Datensatz 10200, Durchschnitt Wohnbauland CHF/m² (unter 3 Fällen "( )").
Andere Kantone liefern nichts Vergleichbares; dort zeigt der Check keinen Wert.

Aufruf: python3 -I tools/preise.py <ordner mit den heruntergeladenen Dateien> <ziel.json>
Erwartet im Ordner: zh_efh.json, zh_stwe.json, zh_land.json, bl_land.json.
"""
import json
import sys
from pathlib import Path


def zahl(x):
    try:
        return round(float(x))
    except (TypeError, ValueError):
        return None


def zh_objekt(rows):
    """Je Gemeinde das jüngste Jahr; erst 1 Jahr, sonst 3 oder 5 Jahre zusammen, wenn der Median sonst fehlt."""
    aus = {}
    jahr = max(r['ref_jahr'] for r in rows)
    for r in rows:
        if r['geoLevelLevel'] != 3 or r['ref_jahr'] != jahr or r['median'] is None:
            continue
        alt = aus.get(r['geoLevelNumber'])
        if alt and alt['_p'] <= r['pooling']:
            continue
        aus[r['geoLevelNumber']] = {'_p': r['pooling'], 'm': zahl(r['median']), 'q25': zahl(r['q25']), 'q75': zahl(r['q75']),
                                    'n': r['verkaeufe'], 'z': r['zeitraum'], 'name': r['geoLevelName']}
    return aus


def zh_land(rows):
    aus = {}
    jahr = max(r['refJahr'] for r in rows)
    for r in rows:
        if r['geoLevelLevel'] != 3 or r['refJahr'] != jahr:
            continue
        g = r['geoLevelNumber']
        if r['pooling'] == 1 and r['medianModel'] is not None and g not in aus:
            aus[g] = {'_p': 9, 'm': zahl(r['medianModel']), 'q25': zahl(r['x25Model']), 'q75': zahl(r['x75Model']),
                      'n': None, 'z': r['zeitraum'], 'art': 'modell', 'name': r['geoLevelName']}
        if r['medianEffektiv'] is not None and (g not in aus or aus[g]['_p'] > r['pooling']):
            aus[g] = {'_p': r['pooling'], 'm': zahl(r['medianEffektiv']), 'q25': zahl(r['q25Effektiv']), 'q75': zahl(r['q75Effektiv']),
                      'n': r['faelle'], 'z': r['zeitraum'], 'art': 'bezahlt', 'name': r['geoLevelName']}
    return aus


def bl_land(rows):
    """Jüngstes Jahr mit Wert, höchstens fünf Jahre zurück; gesperrte Werte ("( )") zählen nicht."""
    jahre = sorted({int(r['jahr']) for r in rows})
    neu = jahre[-1]
    aus = {}
    for r in sorted(rows, key=lambda r: -int(r['jahr'])):
        g, j, m = int(r['bfs_nummer']), int(r['jahr']), zahl(r['quadratmeterpreis_chf'])
        if g in aus or m is None or j < neu - 4:
            continue
        aus[g] = {'m': m, 'n': zahl(r['falle']), 'z': str(j), 'art': 'durchschnitt', 'name': r['gemeinde']}
    return aus


def main(ordner, ziel):
    o = Path(ordner)
    lade = lambda n: json.loads((o / n).read_text(encoding='utf-8'))
    efh, stwe, land = zh_objekt(lade('zh_efh.json')), zh_objekt(lade('zh_stwe.json')), zh_land(lade('zh_land.json'))
    gem = {}
    for quelle, feld in ((efh, 'efh'), (stwe, 'stwe'), (land, 'land')):
        for g, w in quelle.items():
            e = gem.setdefault(str(g), {'k': 'ZH', 'name': w['name']})
            e[feld] = {k: v for k, v in w.items() if k not in ('_p', 'name')}
    for g, w in bl_land(lade('bl_land.json')).items():
        gem.setdefault(str(g), {'k': 'BL', 'name': w['name']})['land'] = {k: v for k, v in w.items() if k != 'name'}
    # Plausibilität: In der Stadt Zürich kostet ein Einfamilienhaus mehr als eine Eigentumswohnung
    # (2025: 2,88 gegen 1,75 Mio.). Sind die Dateien vertauscht, bricht der Lauf hier ab (15. November).
    z = gem.get('261', {})
    if z.get('efh') and z.get('stwe') and z['efh']['m'] <= z['stwe']['m']:
        sys.exit('Einfamilienhaus billiger als Eigentumswohnung in Zürich: Dateien vertauscht?')
    daten = {
        'quellen': {
            'ZH': 'Statistisches Amt des Kantons Zürich, Immobilienpreise (opendata.swiss)',
            'BL': 'Statistisches Amt Basel-Landschaft, Wohnbaulandpreise (data.bl.ch)',
        },
        'gemeinden': gem,
    }
    Path(ziel).write_text(json.dumps(daten, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    z = lambda f: sum(1 for x in gem.values() if f in x)
    print(f"Gemeinden: {len(gem)} (ZH {sum(1 for x in gem.values() if x['k'] == 'ZH')}, BL {sum(1 for x in gem.values() if x['k'] == 'BL')}); "
          f"mit EFH {z('efh')}, Eigentumswohnung {z('stwe')}, Bauland {z('land')}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

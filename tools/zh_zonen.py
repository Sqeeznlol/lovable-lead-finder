# Zonen der Zürcher Parzellen, verschnitten auf dem Runner.
#
# Gemessen am 18. November (Auswerten «parzellen-vier»): von 394'917
# Zürcher Parzellen im Bestand trugen 43.1 % eine Zone. geodienste.ch
# führt die Zürcher Nutzungsplanung nicht («Im Aufbau»), darum fehlt
# Zürich in «Kanton laden». Der Kanton gibt sie aber selbst frei heraus:
# maps.zh.ch/wfs/OGDZHWFS, Ebene ogd-0156_arv_basis_np_gn_zonenflaeche_f,
# 27'725 Zonenflächen aller Gemeinden, je Fläche mit Gemeinde, Kürzel,
# Bezeichnung, Rechtsstand und den Ziffern (Baumasse, Ausnützung,
# Vollgeschosse). In der Lieferung nachgesehen, nicht angenommen.
#
# Je Parzelle zählt die Zone mit der grössten Fläche im Umriss, wie beim
# Verschneiden der übrigen Kantone. Ausgegeben wird dieselbe Form wie
# dort, damit kanton_haupt.py und «Einspielen» sie unverändert nehmen.
# Nur Zonen in Kraft: eine laufende Änderung überlagert die geltende
# Zone und würde sonst die Fläche doppelt zählen.
#
# Die Baumassenziffer steht im Namen («2.7 BMZ»), wie in den Zürcher
# Zonen des Bestands; zone_parse() liest sie dort. Eine Ausnützungsziffer
# steht nicht im Namen: die Potenzialrechnung läse jede Dezimalzahl als
# Baumasse (ziffer_als_bmz) und rechnete sie um ein Drittel klein.
#
# Aufruf: python3 zh_zonen.py <umrisse.csv (wkt, egrid)> <verschnitten.csv>
# Ausgegeben werden nur Zählungen.
import csv, re, sys, time, urllib.error, urllib.parse, urllib.request
from collections import Counter

import shapely

BASIS = 'https://maps.zh.ch/wfs/OGDZHWFS'
EBENE = 'ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f'
KENNUNG = {'User-Agent': 'Mozilla/5.0 (bauraum-lead-finder; Datenbezug)'}
SEITE = 2000
csv.field_size_limit(1 << 30)


def holen(param, versuche=6):
    url = BASIS + '?' + urllib.parse.urlencode(param)
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=KENNUNG), timeout=300) as r:
                return r.read().decode('utf-8', 'replace')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            warte = 5 * (2 ** i)
            print(f'  Fehler ({str(e)[:80]}), neuer Versuch in {warte}s', flush=True)
            time.sleep(warte)
    raise SystemExit('Der Zürcher Dienst antwortet nicht.')


def feld(block, name):
    m = re.search(rf'<ms:{name}>([^<]*)</ms:{name}>', block)
    return m.group(1).strip() if m else ''


def ring(poslist):
    z = [float(v) for v in poslist.split()]
    return list(zip(z[0::2], z[1::2]))


def flaeche(block):
    teile = []
    for poly in re.findall(r'<gml:Polygon\b.*?</gml:Polygon>', block, re.S):
        aussen = re.search(r'<gml:exterior>.*?<gml:posList[^>]*>([^<]+)</gml:posList>', poly, re.S)
        if not aussen:
            continue
        innen = re.findall(r'<gml:interior>.*?<gml:posList[^>]*>([^<]+)</gml:posList>', poly, re.S)
        teile.append(shapely.Polygon(ring(aussen.group(1)), [ring(i) for i in innen]))
    if not teile:
        return None
    g = shapely.make_valid(shapely.MultiPolygon(teile) if len(teile) > 1 else teile[0])
    return g if not g.is_empty else None


def zonen():
    grund = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': EBENE}
    m = re.search(r'numberMatched="(\d+)"', holen({**grund, 'RESULTTYPE': 'hits'}))
    soll = int(m.group(1)) if m else -1
    gesehen, liste, stand = set(), [], Counter()
    start = 0
    while True:
        xml = holen({**grund, 'COUNT': SEITE, 'STARTINDEX': start, 'SORTBY': 'ms:geodb_oid'})
        bloecke = re.findall(r'<ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f gml:id="([^"]+)">(.*?)</ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f>', xml, re.S)
        for gid, b in bloecke:
            if gid in gesehen:
                continue
            gesehen.add(gid)
            stand[feld(b, 'rechtsstatus') or 'leer'] += 1
            if feld(b, 'rechtsstatus') != 'inKraft':
                continue
            g = flaeche(b)
            if g is None:
                continue
            name = feld(b, 'typ_gde_bezeichnung') or feld(b, 'typ_zh_bezeichnung')
            bmz = feld(b, 'baumassenziffer_max')
            # «Wohnzone 2/1.9» trägt die Ziffer schon im Namen.
            if bmz and bmz not in name:
                name = f'{name} {bmz} BMZ'
            liste.append((g, feld(b, 'typ_gde_code') or feld(b, 'typ_zh_code'), name,
                          feld(b, 'typ_gde_abkuerzung') or feld(b, 'typ_zh_abkuerzung')))
        start += SEITE
        print(f'  Zonen: {len(gesehen)} von {soll}', flush=True)
        if len(bloecke) < SEITE:
            break
    if soll >= 0 and len(gesehen) != soll:
        raise SystemExit(f'{len(gesehen)} Zonen gelesen, der Dienst meldet {soll}. Abbruch.')
    print(f'Zonen nach Rechtsstand: {dict(stand)}; in Kraft mit Fläche: {len(liste)}')
    return liste


def main(umrisse, aus):
    z = zonen()
    zgeom = [x[0] for x in z]
    baum = shapely.STRtree(zgeom)

    egrid, pgeom = [], []
    with open(umrisse, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            g = shapely.from_wkt(r['wkt'], on_invalid='ignore')
            if g is not None and not g.is_empty:
                egrid.append(r['egrid'])
                pgeom.append(shapely.make_valid(g))
    print(f'{len(egrid)} Parzellen mit Umriss')

    paar_p, paar_z = baum.query(pgeom, predicate='intersects')
    schnitt = shapely.area(shapely.intersection(
        [pgeom[i] for i in paar_p], [zgeom[j] for j in paar_z]))
    beste = {}
    for i, j, a in zip(paar_p, paar_z, schnitt):
        if a > 5 and (i not in beste or a > beste[i][1]):
            beste[i] = (j, a)

    with open(aus, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['egrid', 'parzelle', 'vermessungskreis', 'art', 'flaeche_m2',
                    'zone_typ', 'zone_name', 'zone_kurz', 'zone_m2', 'anteil_prozent'])
        for i, (j, a) in beste.items():
            fl = pgeom[i].area
            _, code, name, kurz = z[j]
            w.writerow([egrid[i], '', '', '', round(fl, 1), code, name, kurz, round(a),
                        round(100 * a / fl) if fl else ''])
    print(f'{len(beste)} Parzellen mit Zone, {len(egrid) - len(beste)} ohne')
    for name, n in Counter(f'{z[j][3]} {z[j][2]}' for j, _ in beste.values()).most_common(8):
        print(f'{n:>8}  {name}')


if __name__ == '__main__':
    main(*sys.argv[1:3])

#!/usr/bin/env python3
"""
Zonenflächen mit Nutzungsziffer aus den INTERLIS-Paketen der Nutzungsplanung
(MGDM 73.1 v1.2, geodienste.ch) in eine CSV für die Tabelle zone_ziffer.

Warum über die Geometrie: Im Aargau hat jede Zonenfläche ihren eigenen Typ
(118'605 Typen, gezählt 14. November 2026), die Codes nennen keine Gemeinde,
und der WFS von geodienste.ch liefert keine Kennung ins Paket. Also: Fläche
mit Ziffer als Umriss ablegen, abgefragt wird per Punkt.

Zwei Durchgänge je Datei, damit auch 500 MB im Speicher klein bleiben:
erst die Typen mit Ziffer, dann deren Flächen.

Aufruf: zonen_ziffern.py KANTON ausgabe.csv datei.xtf [datei.xtf ...]
Ausgegeben werden nur Zählungen (das Protokoll ist öffentlich).
"""
import csv, sys, xml.etree.ElementTree as ET

def name(tag):
    return tag.rsplit('}', 1)[-1]

def zahl(t):
    try:
        return float((t or '').replace(',', '.'))
    except ValueError:
        return None

def typen(pfad):
    aus = {}
    for _, el in ET.iterparse(pfad, events=('end',)):
        n = name(el.tag)
        if n.endswith('Geobasisdaten.Typ'):
            f = {name(c.tag): (c.text or '').strip() for c in el}
            z = zahl(f.get('Nutzungsziffer'))
            if z is not None and z > 0:
                aus[el.get('TID')] = (f.get('Code', ''), f.get('Bezeichnung', ''), f.get('Abkuerzung', ''), z, f.get('Nutzungsziffer_Art', ''))
            el.clear()
        elif n.endswith('Grundnutzung_Zonenflaeche'):
            el.clear()
    return aus

def ring(polyline):
    pts = []
    for p in polyline:
        k = name(p.tag)
        f = {name(c.tag): c.text for c in p}
        if k == 'ARC':  # Bogen: Mittelpunkt und Endpunkt reichen für die Abfrage per Punkt
            pts.append((f.get('A1'), f.get('A2')))
        pts.append((f.get('C1'), f.get('C2')))
    pts = [(float(a), float(b)) for a, b in pts if a and b]
    if len(pts) >= 3 and pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts if len(pts) >= 4 else None

def flaechen(pfad, ziff):
    for _, el in ET.iterparse(pfad, events=('end',)):
        n = name(el.tag)
        if n.endswith('Grundnutzung_Zonenflaeche'):
            ref = None; polys = []
            for c in el:
                cn = name(c.tag)
                if cn == 'Typ':
                    ref = c.get('REF')
                elif cn == 'Geometrie':
                    for surface in c.iter():
                        if name(surface.tag) == 'SURFACE':
                            ringe = [ring(pl) for b in surface if name(b.tag) == 'BOUNDARY' for pl in b if name(pl.tag) == 'POLYLINE']
                            ringe = [r for r in ringe if r]
                            if ringe:
                                polys.append(ringe)
            if ref in ziff and polys:
                yield ziff[ref], polys
            el.clear()
        elif n.endswith('Geobasisdaten.Typ'):
            el.clear()

def wkt(polys):
    teile = ['(' + ','.join('(' + ','.join(f'{x:.2f} {y:.2f}' for x, y in r) + ')' for r in ringe) + ')' for ringe in polys]
    return 'MULTIPOLYGON(' + ','.join(teile) + ')'

def main():
    kanton, ausgabe, dateien = sys.argv[1], sys.argv[2], sys.argv[3:]
    n_typ = n_fl = 0; arten = {}
    with open(ausgabe, 'a', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        for d in dateien:
            ziff = typen(d); n_typ += len(ziff)
            for (code, bez, abk, z, art), polys in flaechen(d, ziff):
                w.writerow([kanton, code, bez, abk, z, art, wkt(polys)])
                n_fl += 1; arten[art or '(leer)'] = arten.get(art or '(leer)', 0) + 1
    print(f'{kanton}: {len(dateien)} Dateien, {n_typ} Typen mit Ziffer, {n_fl} Flächen')
    for a, k in sorted(arten.items(), key=lambda x: -x[1])[:6]:
        print(f'   {k:6}  {a[:50]}')

if __name__ == '__main__':
    main()

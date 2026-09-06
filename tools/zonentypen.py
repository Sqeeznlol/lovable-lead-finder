#!/usr/bin/env python3
"""Liest die Zonentypen unmittelbar aus der INTERLIS-Datei.

In den Zonenflächen steht nur ein Schlüssel wie "x4401_221_gngde". Was
er bedeutet -- "W2", "Wohnzone 2-geschossig" --, steht in der Tabelle
Typ_Grundnutzung derselben Datei.

Beide Werkzeuge scheitern daran, sie herauszulösen: GDAL faltet die
Tabelle in die Zonenfläche und verwirft ihre Spalten, ili2gpkg bricht
ab, weil die Typen auf einen Katalog des Bundes verweisen, der nicht
mitgeliefert wird.

Eine XTF-Datei ist aber schlicht XML. Die dreissig Zeilen hier lesen
heraus, was gebraucht wird, und hängen von keinem Werkzeug ab. Gelesen
wird strömend, damit auch eine Datei von vierzig Megabyte nicht im
Speicher landet.
"""
import csv
import sys
import xml.etree.ElementTree as ET


def ohne_namensraum(tag: str) -> str:
    return tag.rsplit('}', 1)[-1]


def typen(pfad: str):
    """Je Typ die Kennung und die Bezeichnungen.

    Die Bezeichnung steht in einer mehrsprachigen Struktur: unter
    "Bezeichnung" folgt eine Liste von Einträgen je Sprache. Gesucht ist
    Deutsch; gibt es das nicht, tut es der erste Eintrag -- ein Name in
    der falschen Sprache ist immer noch besser als ein Schlüssel.
    """
    for _, element in ET.iterparse(pfad, events=('end',)):
        # Die Elemente tragen den vollen Modellpfad im Namen:
        # "Nutzungsplanung_V1_2.Geobasisdaten.Typ_Grundnutzung".
        if not ohne_namensraum(element.tag).endswith('Typ_Grundnutzung'):
            continue

        kennung = (element.get('TID') or element.get('BID') or '').strip()
        werte: dict[str, str] = {}
        for kind in element:
            name = ohne_namensraum(kind.tag)
            if not (name.endswith('Bezeichnung') or name.endswith('Abkuerzung')):
                continue
            # Mehrsprachig: unter der Bezeichnung hängt eine Liste je
            # Sprache, dazwischen viel Leerraum. Gesucht ist der erste
            # richtige Text.
            zeilen = [z.strip() for z in kind.itertext() if z.strip()]
            if not zeilen:
                continue
            kurz = 'Abkuerzung' if name.endswith('Abkuerzung') else 'Bezeichnung'
            # "de" ist die Sprachangabe, nicht der Name.
            werte[kurz] = next((z for z in zeilen if len(z) > 2), zeilen[0])
        if kennung:
            yield kennung, werte.get('Bezeichnung', ''), werte.get('Abkuerzung', '')
        element.clear()


def main() -> None:
    if len(sys.argv) < 2:
        print('Aufruf: zonentypen.py <datei.xtf> [ausgabe.csv]', file=sys.stderr)
        sys.exit(1)

    ziel = sys.argv[2] if len(sys.argv) > 2 else '-'
    datei = open(ziel, 'w', newline='', encoding='utf-8') \
        if ziel != '-' else sys.stdout
    schreiber = csv.writer(datei)
    schreiber.writerow(['typ_id', 'bezeichnung', 'abkuerzung'])

    anzahl = 0
    for zeile in typen(sys.argv[1]):
        schreiber.writerow(zeile)
        anzahl += 1
    if datei is not sys.stdout:
        datei.close()
    print(f'{anzahl} Zonentypen', file=sys.stderr)

    if anzahl == 0:
        # Auf einen Namen zu raten hat schon genug Läufe gekostet. Wenn
        # nichts gefunden wird, sagt die Datei selbst, was in ihr steht.
        print('Keine gefunden. Elemente in der Datei:', file=sys.stderr)
        gezaehlt: dict[str, int] = {}
        for _, element in ET.iterparse(sys.argv[1], events=('end',)):
            name = ohne_namensraum(element.tag)
            gezaehlt[name] = gezaehlt.get(name, 0) + 1
            element.clear()
        haeufig = sorted(gezaehlt.items(), key=lambda x: -x[1])[:60]
        for name, wieviele in haeufig:
            print(f'  {wieviele:>8}  {name}', file=sys.stderr)


if __name__ == '__main__':
    main()

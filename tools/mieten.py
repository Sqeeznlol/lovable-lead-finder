"""Amtliche Mieten je Kanton und Bauperiode für CALC YOU LATER (src/lib/mieten-daten.ts).

Quelle: Bundesamt für Statistik, Strukturerhebung, Tabelle je-d-09.03.03.06
«Durchschnittlicher Mietpreis pro m2 in Franken nach Bauperiode und Kanton»
(monatlicher Netto-Mietzins ohne Neben- und Heizkosten, Mieter- und
Genossenschafterwohnungen). Die Datei liegt beim BFS unter
https://dam-api.bfs.admin.ch/hub/api/dam/assets?orderNr=je-d-09.03.03.06
(dort die Adresse «master» des jüngsten Eintrags).

Es sind Bestandsmieten: was heute im Durchschnitt bezahlt wird, nicht was
ein Inserat verlangt. Je Gemeinde veröffentlicht das BFS nichts.

Aufruf: python3 -I tools/mieten.py <heruntergeladene.xlsx> src/lib/mieten-daten.ts
"""
import json
import sys

import openpyxl

KANTON = {
    'Zürich': 'ZH', 'Bern': 'BE', 'Luzern': 'LU', 'Uri': 'UR', 'Schwyz': 'SZ', 'Obwalden': 'OW', 'Nidwalden': 'NW',
    'Glarus': 'GL', 'Zug': 'ZG', 'Freiburg': 'FR', 'Solothurn': 'SO', 'Basel-Stadt': 'BS', 'Basel-Landschaft': 'BL',
    'Schaffhausen': 'SH', 'Appenzell A.Rh.': 'AR', 'Appenzell I.Rh.': 'AI', 'St.Gallen': 'SG', 'Graubünden': 'GR',
    'Aargau': 'AG', 'Thurgau': 'TG', 'Tessin': 'TI', 'Waadt': 'VD', 'Wallis': 'VS', 'Neuenburg': 'NE', 'Genf': 'GE',
    'Jura': 'JU', 'Schweiz': 'CH',
}


def zahl(x):
    """21.3 -> 21.3; '(12.3)' -> 12.3 (wenige Beobachtungen); 'X' -> None."""
    if isinstance(x, (int, float)):
        return round(float(x), 1)
    try:
        return round(float(str(x).strip().strip('()')), 1)
    except ValueError:
        return None


def bis(titel):
    """'Vor 1919' -> 1918, '1961 - 1970' -> 1970, die jüngste Periode -> 9999."""
    t = str(titel).replace(' ', '')
    if t.lower().startswith('vor'):
        return int(t[3:]) - 1
    return int(t.split('-')[1])


def main(quelle, ziel):
    wb = openpyxl.load_workbook(quelle, read_only=True, data_only=True)
    jahr = max(int(n) for n in wb.sheetnames if n.isdigit())
    zeilen = list(wb[str(jahr)].iter_rows(values_only=True))
    kopf = next(i for i, z in enumerate(zeilen) if z[1] == 'Total')
    spalten = [(j, bis(t)) for j, t in enumerate(zeilen[kopf]) if t and j > 1]
    # Die jüngste Periode gilt für alles danach.
    spalten[-1] = (spalten[-1][0], 9999)
    kantone = {}
    for z in zeilen[kopf + 2:]:
        k = KANTON.get(str(z[0]).strip()) if z[0] else None
        if not k:
            continue
        kantone[k] = {'total': zahl(z[1]), 'perioden': [[b, zahl(z[j])] for j, b in spalten]}
    assert len(kantone) == 27, f'{len(kantone)} statt 27 Zeilen (26 Kantone und die Schweiz)'
    assert all(v['total'] for v in kantone.values()), 'ein Kanton ohne Gesamtwert'
    with open(ziel, 'w', encoding='utf-8') as f:
        f.write('// Erzeugt von tools/mieten.py -- nicht von Hand ändern.\n')
        f.write('// Quelle: Bundesamt für Statistik, Strukturerhebung, Tabelle je-d-09.03.03.06.\n')
        f.write(f'export const MIETEN_JAHR = {jahr};\n')
        f.write('/** Netto-Miete in CHF je m² und Monat: gesamt und je Bauperiode ([bis Baujahr, Wert]). */\n')
        f.write('export const MIETEN: Record<string, { total: number; perioden: [number, number | null][] }> = ')
        f.write(json.dumps(kantone, ensure_ascii=False, separators=(',', ':')).replace('"total"', 'total').replace('"perioden"', 'perioden'))
        f.write(';\n')
    print(f'{len(kantone)} Zeilen, Jahr {jahr}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

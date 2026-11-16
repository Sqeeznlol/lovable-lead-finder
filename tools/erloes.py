"""Amtliche Verkaufspreise je m² Wohnfläche für CALC YOU LATER (src/lib/erloes-daten.ts).

Je m² veröffentlicht das nur die Stadt Zürich (Statistik Stadt Zürich,
«Verkaufspreise (Median) pro Wohnung und pro Quadratmeter Wohnungsfläche im
Stockwerkeigentum, nach Baualtersklasse», BAU515OD5158). Der Kanton Zürich
nennt je Gemeinde nur den Preis je Wohnung, ohne Fläche -- daraus lässt sich
kein Preis je m² rechnen, ohne die Grösse zu raten.

Gezählt werden Neubauten (0 bis 1 Jahre): das ist, was ein Entwickler
verkauft. Wohnfläche und Hauptnutzfläche sind bei Wohnungen dasselbe Mass.

Aufruf: python3 -I tools/erloes.py <BAU515OD5158.csv> src/lib/erloes-daten.ts
Quelle: https://data.stadt-zuerich.ch/dataset/bau_hae_preis_stockwerkeigentum_gebaeudealter_od5158
"""
import csv
import json
import sys


def main(quelle, ziel):
    zeilen = [z for z in csv.DictReader(open(quelle, encoding='utf-8-sig'))
              if z['HAArtLevel1Lang'] == 'Kauf' and z['HASTWELang'] == 'Ja' and z['BaualterLang_noDM'].startswith('Neubauten')]
    assert zeilen, 'keine Zeile für Neubauten im Stockwerkeigentum'
    jahr = max(int(z['Stichtagdatjahr']) for z in zeilen)
    z = next(z for z in zeilen if int(z['Stichtagdatjahr']) == jahr)
    m2, n = int(z['HAPreisWohnflaeche']), int(z['AnzHA'])
    assert 5000 < m2 < 60000 and n > 0, (m2, n)
    daten = {'261': {'m2': m2, 'n': n, 'jahr': jahr,
                     'text': f'amtlich: neue Eigentumswohnungen in der Stadt Zürich, Median {jahr} aus {n} Verkäufen'}}
    with open(ziel, 'w', encoding='utf-8') as f:
        f.write('// Erzeugt von tools/erloes.py -- nicht von Hand ändern.\n')
        f.write('// Quelle: Statistik Stadt Zürich, BAU515OD5158 (Neubauten im Stockwerkeigentum).\n')
        f.write('/** Verkaufspreis je m² Wohnfläche neuer Eigentumswohnungen, je BFS-Nummer der Gemeinde. */\n')
        f.write('export const ERLOES_AMTLICH: Record<string, { m2: number; n: number; jahr: number; text: string }> = ')
        f.write(json.dumps(daten, ensure_ascii=False, indent=2))
        f.write(';\n')
    print(f'Stadt Zürich {jahr}: CHF {m2} je m², {n} Verkäufe')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

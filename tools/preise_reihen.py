"""Preise der letzten Jahre je Zürcher Gemeinde, für CALC YOU LATER (public/preise-reihen.json).

Julian, 17. November: «Die Preise stimmen nicht ... schaue genau alle Preise an, die letzten
paar Jahre, und begründe es auch.» Bis dahin rechnete die Seite mit dem jüngsten Jahr allein
und für den Verkaufspreis je m² ausserhalb der Stadt Zürich mit einer Annahme (CHF 9'500).

Quellen, am 17. November nachgesehen:
  Kanton    Handänderungsstatistik (opendata.swiss «Immobilienpreise im Kanton Zürich»):
            Eigentumswohnung und Einfamilienhaus je Gemeinde als Median JE OBJEKT, 2007 bis 2025,
            unter 15 Verkäufen über 3 oder 5 Jahre zusammengefasst (zh_stwe.json, zh_efh.json);
            Wohnbauland je m² (zh_land.json); dieselben Grössen je Marktregion und Jahr
            (zh_6784.csv, zh_6781.csv, zh_6780.csv); Zuteilung der Gemeinden (zh_6783.xlsx).
            Einen Preis je m² Wohnfläche veröffentlicht der Kanton nicht.
  Stadt     Statistik Stadt Zürich: Preis je m² Wohnfläche im Stockwerkeigentum nach Quartier
            und Zimmerzahl (stzh_5155.csv) und nach Gebäudealter (stzh_5158.csv), 2009 bis 2025.
  Bund      Gebäude- und Wohnungsregister des Kantons Zürich (public.madd.bfs.admin.ch/zh.zip):
            Wohnfläche jeder bestehenden Wohnung.

Der Preis je m² ausserhalb der Stadt wird so berechnet, und so steht es auf der Seite:
  Median je Wohnung (Kanton)  ÷  typische Wohnfläche (Register, Mehrfamilienhäuser ab 1980)
  × Eichung an der Stadt Zürich, wo beides amtlich bekannt ist.

Aufruf: python3 -I tools/preise_reihen.py <ordner> <gwr-ordner> <ziel.json>
Im Ordner: zh_stwe.json zh_efh.json zh_land.json zh_6784.csv zh_6781.csv zh_6780.csv
           zh_6783.xlsx stzh_5155.csv stzh_5158.csv
Im GWR-Ordner: gebaeude_batiment_edificio.csv wohnung_logement_abitazione.csv (Tabulator)
Ausgegeben werden nur Zählungen und Stichproben öffentlicher Statistik.
"""
import csv
import json
import re
import statistics
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

JAHRE_ZURUECK = 11          # 2015 bis 2025: die «letzten paar Jahre» und genug für einen Trend
FRISCH = 3                  # die jüngsten drei Jahre ergeben den Wert von heute
REGION = {'Land': 'Landgemeinden', 'Agglomeration': 'Agglomerationsgemeinden', 'See': 'Seegemeinden',
          'Stadt Zürich': 'Stadt Zürich', 'Stadt Winterthur': 'Stadt Winterthur'}


def zahl(x):
    try:
        f = float(str(x).replace("'", ''))
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def ganz(x):
    f = zahl(x)
    return None if f is None else round(f)


def anzahl(x):
    """Die Stadt maskiert kleine Anzahlen als Bereich («2–6»): dann die Mitte."""
    if x is None:
        return None
    m = re.match(r'^\s*(\d+)\s*[–-]\s*(\d+)\s*$', str(x))
    return (int(m.group(1)) + int(m.group(2))) / 2 if m else zahl(x)


# ------------------------------------------------------------------ Kanton
def objekt_reihe(rows, letztes):
    """Je Gemeinde und Jahr der Median mit der kleinsten Zusammenfassung, die einen Wert hat."""
    aus = defaultdict(dict)
    for r in rows:
        if r['geoLevelLevel'] != 3 or r['median'] is None or r['ref_jahr'] < letztes - JAHRE_ZURUECK + 1:
            continue
        g, j = str(r['geoLevelNumber']), r['ref_jahr']
        alt = aus[g].get(j)
        if alt and alt['p'] <= r['pooling']:
            continue
        aus[g][j] = {'p': r['pooling'], 'w': [j, ganz(r['median']), ganz(r['q25']), ganz(r['q75']), r['verkaeufe'], r['zeitraum']]}
    return {g: [v['w'] for _, v in sorted(js.items(), reverse=True)] for g, js in aus.items()}


def land_reihe(rows, letztes):
    aus = defaultdict(dict)
    for r in rows:
        if r['geoLevelLevel'] != 3 or r['refJahr'] < letztes - JAHRE_ZURUECK + 1:
            continue
        g, j = str(r['geoLevelNumber']), r['refJahr']
        alt = aus[g].get(j)
        if r['medianEffektiv'] is not None and (not alt or alt['p'] > r['pooling']):
            aus[g][j] = {'p': r['pooling'], 'w': [j, ganz(r['medianEffektiv']), ganz(r['q25Effektiv']), ganz(r['q75Effektiv']), r['faelle'], r['zeitraum'], 'bezahlt']}
        elif r['pooling'] == 1 and r['medianModel'] is not None and not alt:
            aus[g][j] = {'p': 9, 'w': [j, ganz(r['medianModel']), ganz(r['x25Model']), ganz(r['x75Model']), None, r['zeitraum'], 'modell']}
    return {g: [v['w'] for _, v in sorted(js.items(), reverse=True)] for g, js in aus.items()}


def region_reihe(datei, schluessel):
    aus = defaultdict(list)
    for r in csv.DictReader(open(datei, encoding='utf-8-sig')):
        aus[r['region'].replace('Kanton Zürich', 'Ganzer Kanton Zürich').replace('Ganzer Ganzer', 'Ganzer')].append(
            [r[schluessel] if schluessel == 'Zeitraum' else int(r[schluessel]), ganz(r['Median']), ganz(r.get('Verkaeufe') or r.get('Faelle'))])
    return {k: sorted(v, key=lambda x: str(x[0]), reverse=True) for k, v in aus.items()}


def zuteilung(xlsx):
    """Gemeinde → Marktregion. openpyxl scheitert an einer fehlenden Zeichnung der Datei: direkt gelesen."""
    z = zipfile.ZipFile(xlsx)
    texte = [re.sub(r'<[^>]+>', '', m) for m in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode('utf-8'), re.S)]
    aus = {}
    for name in z.namelist():
        if not re.match(r'xl/worksheets/sheet\d+\.xml$', name):
            continue
        for zeile in re.findall(r'<row[^>]*>(.*?)</row>', z.read(name).decode('utf-8'), re.S):
            zellen = {c: (texte[int(v)] if 't="s"' in a else v).strip() for c, a, v in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)>(?:<v>(.*?)</v>)?', zeile) if v}
            if zellen.get('A', '').isdigit() and zellen.get('C') in REGION:
                aus[zellen['A']] = REGION[zellen['C']]
    return aus


# ------------------------------------------------------------------- Stadt
def stadt(datei55, datei58):
    """Preis je m² nach Quartier, Kreis und ganzer Stadt: Mittel der Mediane je Zimmerzahl, nach Verkäufen gewichtet."""
    summe = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    for r in csv.DictReader(open(datei55, encoding='utf-8-sig')):
        p, n = zahl(r['HAPreisWohnflaeche']), anzahl(r['AnzHA'])
        if p is None or not n:
            continue
        e = summe[r['RaumLang']][int(r['Stichtagdatjahr'])]
        e[0] += p * n
        e[1] += n
    raum = {k: [[j, round(v[0] / v[1]), round(v[1])] for j, v in sorted(js.items(), reverse=True)] for k, js in summe.items()}
    gesamt, neubau = {}, {}
    for r in csv.DictReader(open(datei58, encoding='utf-8-sig')):
        j = int(r['Stichtagdatjahr'])
        w = [j, ganz(r['HAPreisWohnflaeche']), ganz(r['HAMedianPreis']), ganz(r['AnzHA'])]
        if r['BaualterLang_noDM'] == 'Total':
            gesamt[j] = w
        elif r['BaualterLang_noDM'].startswith('Neubauten'):
            neubau[j] = w
    return raum, [gesamt[j] for j in sorted(gesamt, reverse=True)], [neubau[j] for j in sorted(neubau, reverse=True)]


# --------------------------------------------------------------- Register
def wohnflaechen(ordner):
    """Median der Wohnfläche in Mehrfamilienhäusern ab 1980, je Gemeinde: dort steht das Stockwerkeigentum."""
    geb = {}
    with open(Path(ordner) / 'gebaeude_batiment_edificio.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            if r['GSTAT'] == '1004' and r['GKLAS'] == '1122' and r['GBAUJ'].isdigit() and int(r['GBAUJ']) >= 1980:
                geb[r['EGID']] = r['GGDENR']
    flaeche = defaultdict(list)
    with open(Path(ordner) / 'wohnung_logement_abitazione.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            g = geb.get(r['EGID'])
            if g and r['WSTAT'] == '3004' and r['WAREA'].isdigit() and 15 <= int(r['WAREA']) <= 400:
                flaeche[g].append(int(r['WAREA']))
    return {g: [round(statistics.median(v)), len(v)] for g, v in flaeche.items() if len(v) >= 30}


def main(ordner, gwr, ziel):
    o = Path(ordner)
    lade = lambda n: json.loads((o / n).read_text(encoding='utf-8'))
    stwe_roh, efh_roh, land_roh = lade('zh_stwe.json'), lade('zh_efh.json'), lade('zh_land.json')
    letztes = max(r['ref_jahr'] for r in stwe_roh)
    stwe, efh, land = objekt_reihe(stwe_roh, letztes), objekt_reihe(efh_roh, letztes), land_reihe(land_roh, letztes)
    namen = {str(r['geoLevelNumber']): r['geoLevelName'] for r in stwe_roh if r['geoLevelLevel'] == 3}
    region = zuteilung(o / 'zh_6783.xlsx')
    raum, stadt_gesamt, stadt_neubau = stadt(o / 'stzh_5155.csv', o / 'stzh_5158.csv')
    flaechen = wohnflaechen(gwr)

    # Eichung: in der Stadt Zürich sind Preis je Wohnung und je m² amtlich. Ihr Verhältnis ist die
    # Fläche der verkauften Wohnungen; geteilt durch den Median des Registers ergibt den Faktor,
    # mit dem das Register in den übrigen Gemeinden zur Fläche der verkauften Wohnungen wird.
    frisch = [w for w in stadt_gesamt if w[0] > letztes - FRISCH]
    verkauft = sum(w[2] / w[1] * w[3] for w in frisch) / sum(w[3] for w in frisch)
    faktor = verkauft / flaechen['261'][0]

    gemeinden = {}
    for g in sorted(set(stwe) | set(efh) | set(land), key=int):
        gemeinden[g] = {k: v for k, v in {
            'name': namen.get(g), 'region': region.get(g), 'flaeche': flaechen.get(g),
            'stwe': stwe.get(g), 'efh': efh.get(g), 'land': land.get(g),
        }.items() if v}
    aus = {
        'stand': letztes,
        'quellen': {
            'kanton': 'Statistisches Amt des Kantons Zürich, Handänderungsstatistik (opendata.swiss)',
            'stadt': 'Statistik Stadt Zürich, Preise im Stockwerkeigentum (data.stadt-zuerich.ch)',
            'register': 'Gebäude- und Wohnungsregister (Bundesamt für Statistik)',
        },
        'eichung': {'faktor': round(faktor, 3), 'verkauft': round(verkauft, 1), 'register': flaechen['261'][0], 'jahre': f'{letztes - FRISCH + 1}-{letztes}'},
        'regionen': {
            'stwe': region_reihe(o / 'zh_6784.csv', 'Jahr'),
            'efh': region_reihe(o / 'zh_6781.csv', 'Jahr'),
            'land': region_reihe(o / 'zh_6780.csv', 'Zeitraum'),
        },
        'zuerich': {'raum': raum, 'gesamt': stadt_gesamt, 'neubau': stadt_neubau},
        'gemeinden': gemeinden,
    }
    Path(ziel).write_text(json.dumps(aus, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Stand {letztes}: {len(gemeinden)} Gemeinden, davon {sum(1 for v in gemeinden.values() if "stwe" in v)} mit Wohnungspreisen, '
          f'{sum(1 for v in gemeinden.values() if "flaeche" in v)} mit Wohnfläche aus dem Register; '
          f'{len(raum)} Raumeinheiten der Stadt; Eichung {faktor:.3f} (verkaufte Wohnungen {verkauft:.1f} m², Register {flaechen["261"][0]} m²); '
          f'{Path(ziel).stat().st_size // 1024} kB.')


if __name__ == '__main__':
    main(*sys.argv[1:4])

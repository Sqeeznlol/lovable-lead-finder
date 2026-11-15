#!/usr/bin/env python3
"""
Lead-Listen aus dem Gebäude- und Wohnungsregister (GWR) für die Tabelle
lead_gebaeude (Migration 20261115120000): bestehende Wohngebäude mit Öl-
oder Gasheizung, gebaut bis 1980 -- dort steht der Heizungsersatz an.
Julian, 14. November ("Lead-Listen aus dem Gebäuderegister ... weiterer
Kantone").

Nur diese Gebäude, nicht das ganze Register: die Datenbank wird bei 1107 MB
schreibgeschützt (980 MB am 15. November gemessen), das ganze Register der
Deutschschweiz passte nicht.

Codes nachgesehen in kodes_codes_codici.csv (Paket zh.zip, 14. November):
GSTAT 1004 bestehend; GKLAS 1110 bis 1130 Wohngebäude; GENH 7520 Gas,
7530 Heizöl; GBAUP 8011 bis 8015 = vor 1919 bis 1971-1980.

Eingabe: entpacktes Paket public.madd.bfs.admin.ch/<kt>.zip.
Ausgabe: CSV ohne Kopf; gedruckt werden nur Zählungen (öffentliches Protokoll).
Aufruf: gwr_leads.py <ordner> <ausgabe.csv>
"""
import csv, os, sys
from collections import Counter

csv.field_size_limit(10**9)
ORDNER, AUS = sys.argv[1], sys.argv[2]
GEB = os.path.join(ORDNER, 'gebaeude_batiment_edificio.csv')
EIN = os.path.join(ORDNER, 'eingang_entree_entrata.csv')
NOETIG = ['EGID', 'GDEKT', 'GGDENR', 'GGDENAME', 'EGRID', 'GSTAT', 'GKLAS', 'GBAUJ', 'GBAUP', 'GANZWHG', 'GENH1', 'GWAERZH1', 'GWAERDATH1', 'GKODE', 'GKODN']

def lesen(pfad):
    with open(pfad, encoding='utf-8', newline='') as f:
        r = csv.reader(f, delimiter='\t')
        kopf = next(r)
        yield kopf
        yield from r

def zahl(s):
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None

# Erster Eingang je Gebäude: Strasse, Nummer, PLZ, Ort.
adr = {}
it = lesen(EIN); k = next(it); i = {n: k.index(n) for n in ['EGID', 'STRNAME', 'DEINR', 'DPLZ4', 'DPLZNAME']}
for z in it:
    e = z[i['EGID']]
    if e not in adr:
        adr[e] = (f"{z[i['STRNAME']]} {z[i['DEINR']]}".strip(), z[i['DPLZ4']], z[i['DPLZNAME']])

it = lesen(GEB); k = next(it)
fehlt = [n for n in NOETIG if n not in k]
if fehlt:
    sys.exit(f'Spalten fehlen: {fehlt}')
i = {n: k.index(n) for n in NOETIG}
n = Counter()
with open(AUS, 'a', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for z in it:
        n['gebaeude'] += 1
        if z[i['GSTAT']] != '1004':
            continue
        kl = zahl(z[i['GKLAS']])
        if kl is None or not 1110 <= kl <= 1130:
            continue
        n['wohngebaeude'] += 1
        enh = zahl(z[i['GENH1']])
        if enh not in (7520, 7530):
            continue
        n['fossil'] += 1
        bj, bp = zahl(z[i['GBAUJ']]), zahl(z[i['GBAUP']])
        if not ((bj and bj <= 1980) or (not bj and bp and bp <= 8015)):
            continue
        n['lead'] += 1
        strasse, plz, ort = adr.get(z[i['EGID']], ('', '', ''))
        if strasse:
            n['mit_adresse'] += 1
        w.writerow([z[i['EGID']], z[i['EGRID']] or '', z[i['GDEKT']], z[i['GGDENR']], z[i['GGDENAME']], strasse, plz, ort,
                    bj or '', bp or '', zahl(z[i['GANZWHG']]) or '', kl, enh, zahl(z[i['GWAERZH1']]) or '',
                    (z[i['GWAERDATH1']] or '')[:10], z[i['GKODE']], z[i['GKODN']]])
kt = os.path.basename(os.path.normpath(ORDNER)).upper()
print(f"{kt}: {n['gebaeude']} Gebäude, {n['wohngebaeude']} Wohngebäude, {n['fossil']} mit Öl oder Gas, "
      f"{n['lead']} davon bis 1980 ({n['mit_adresse']} mit Adresse)")

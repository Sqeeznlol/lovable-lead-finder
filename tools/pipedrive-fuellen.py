#!/usr/bin/env python3
"""Füllt die Felder am Deal aus der Datenbank.

Zone, Geschosse, Baujahr und Hauptnutzfläche entscheiden, ob sich ein
Anruf lohnt -- sie stehen in der Datenbank hinter wohntraums.life und
gehören an den Deal, wo man sie beim Telefonieren sieht.

Dazu Gemeinde und Kanton und der Link in den ÖREB-Kataster. Letzterer
braucht die Gemeindenummer: Parzellennummern sind nur innerhalb einer
Gemeinde eindeutig, und ohne sie meldet das Portal "parz nicht
gefunden".

Verbunden wird über die EGRID. Was sich nicht zuordnen lässt, bleibt
unberührt -- das sind die Kantone, die noch nicht geladen sind.

Geschrieben wird nur in leere Felder. Ohne --schreiben verändert der
Lauf nichts.
"""
import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

EGRID = re.compile(r'\bCH\d{12}\b')

# Spalte in der Datenbank -> Feldname in Pipedrive
ZUORDNUNG = {
    'gemeinde':    'Gemeinde',
    'kanton':      'Kanton',
    'zone':        'Zone',
    'geschosse':   'Geschosse',
    'baujahr':     'Baujahr',
    'hnf_delta':   'Mehr Wohnfläche m²',
    'bebaubar_m2': 'Grundstück m²',
}


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def put(pfad: str, token: str, daten: dict) -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(
        url, data=json.dumps(daten).encode(),
        headers={'Content-Type': 'application/json'}, method='PUT')
    try:
        with urllib.request.urlopen(anfrage, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # Die Adresse enthält den Token -- deshalb nur der Code.
        return {'success': False, 'code': e.code}


def alle(pfad: str, token: str, **params) -> list:
    raus, start = [], 0
    while True:
        a = get(pfad, token, start=start, limit=500, **params)
        stueck = a.get('data') or []
        if not stueck:
            break
        raus.extend(stueck)
        weiter = (a.get('additional_data') or {}).get('pagination') or {}
        if not weiter.get('more_items_in_collection'):
            break
        start = weiter.get('next_start', start + 500)
    return raus


def oereb(objekt: dict) -> str:
    """Der Link, der die Parzelle im Kataster auch wirklich auswählt.

    Nur für Zürich: andere Kantone führen eigene Portale mit eigenen
    Adressen. Einen Zürcher Link an eine Thurgauer Parzelle zu hängen
    wäre schlimmer als kein Link.
    """
    if (objekt.get('kanton') or '').upper() not in ('ZH', 'ZÜRICH', 'ZUERICH'):
        return ''
    nr = (objekt.get('parzelle') or '').strip()
    bfs = (objekt.get('bfs_nr') or '').strip()
    if not nr or not bfs:
        return ''
    return ('https://maps.zh.ch/?locate=parz&locations='
            + urllib.parse.quote(f'{bfs},{nr}')
            + '&topic=OerebKatasterZH')


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--objekte', required=True)
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    with open(args.objekte, encoding='utf-8') as f:
        objekte = {z['egrid']: z for z in csv.DictReader(f) if z.get('egrid')}

    felder = {f.get('name'): f.get('key')
              for f in (get('/dealFields', token).get('data') or [])}
    personen = {p['id']: p for p in alle('/persons', token)}
    deals = alle('/deals', token, status='all_not_deleted')

    print(f'# Felder füllen — {len(deals)} Deals, {len(objekte)} Objekte')
    print()

    zu_aendern: list[tuple[dict, dict]] = []
    ohne = 0
    for d in deals:
        kennung = ''
        for wert in list(d.values()):
            if isinstance(wert, str):
                treffer = EGRID.search(wert)
                if treffer:
                    kennung = treffer.group(0)
                    break
        if not kennung:
            person = d.get('person_id')
            p_id = person.get('value') if isinstance(person, dict) else person
            for wert in (personen.get(p_id) or {}).values():
                if isinstance(wert, str):
                    treffer = EGRID.search(wert)
                    if treffer:
                        kennung = treffer.group(0)
                        break

        objekt = objekte.get(kennung)
        if not objekt:
            ohne += 1
            continue

        neu: dict = {}
        for spalte, name in ZUORDNUNG.items():
            schluessel = felder.get(name)
            wert = (objekt.get(spalte) or '').strip()
            if not schluessel or not wert:
                continue
            if str(d.get(schluessel) or '').strip():
                continue  # Was dasteht, bleibt.
            neu[schluessel] = wert

        link = oereb(objekt)
        schluessel = felder.get('ÖREB Kataster')
        if link and schluessel and not str(d.get(schluessel) or '').strip():
            neu[schluessel] = link

        if neu:
            zu_aendern.append((d, neu))

    umgekehrt = {v: k for k, v in felder.items() if v}
    print(f'## {len(zu_aendern)} Deals werden ergänzt')
    print()
    for d, neu in zu_aendern[:15]:
        werte = ', '.join(
            f'{umgekehrt.get(k, k)} {str(v)[:28]}' for k, v in neu.items())
        print(f'- `{(d.get("title") or "")[:45]}` — {werte}')
    if len(zu_aendern) > 15:
        print(f'- … und {len(zu_aendern) - 15} weitere')
    print()
    if ohne:
        print(f'> {ohne} Deals ohne Objekt in der Datenbank -- die Kantone,')
        print('> die noch nicht geladen sind. Sie bleiben unberührt.')
        print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    fehler = 0
    for d, neu in zu_aendern:
        if not put(f'/deals/{d["id"]}', token, neu).get('success'):
            fehler += 1
    print(f'- {len(zu_aendern) - fehler} Deals ergänzt'
          + (f', {fehler} fehlgeschlagen' if fehler else ''))


if __name__ == '__main__':
    main()

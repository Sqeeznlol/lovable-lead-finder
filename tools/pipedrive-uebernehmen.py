#!/usr/bin/env python3
"""Trägt am Deal nach, was beim Kontakt schon steht.

Die Angaben zur Liegenschaft stecken beim Kontakt -- EGRID unter
"Objektinfo", die Parzellennummer unter "Grundstück", das zuständige
Grundbuchamt unter "Grundbuch". Am Deal, wo man sie beim Anruf sieht,
fehlen sie.

Das lässt sich ohne Datenbank beheben, und es betrifft auch die 309
Deals aus dem Thurgau, für die es bei uns noch kein Objekt gibt.

Der Kanton kommt aus dem Grundbuchamt: "Grundbuch Zürich" heisst Kanton
Zürich. Das ist verlässlicher als aus der Postleitzahl zu raten -- die
Grenzen verlaufen quer durch die Postleitzahlbereiche.

Geschrieben wird nur in leere Felder. Ohne --schreiben verändert der
Lauf nichts.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

EGRID = re.compile(r'\bCH\d{12}\b')

# Die Parzellennummer steht selten allein. Im Bestand steht zum Beispiel
#
#   Grundstück: Liegenschaft Nr. 2028 ( CH945005774131 )
#
# Gesucht ist die 2028. Zürcher Nummern tragen manchmal ein Kürzel
# davor ("SE2423"), deshalb die Buchstaben.
NUMMER = re.compile(
    r'(?:Liegenschaft|Grundst(?:ü|ue)ck|Parzelle)?\s*(?:Nr\.?)?\s*'
    r'\b([A-Z]{0,3}\d{1,6}[a-z]?)\b')

# Grundbuchamt -> Kantonskürzel. Die Ämter tragen den Kantonsnamen,
# manche einen Bezirksnamen mit Kantonszusatz.
KANTONE = {
    'zürich': 'ZH', 'zurich': 'ZH', 'bern': 'BE', 'luzern': 'LU',
    'uri': 'UR', 'schwyz': 'SZ', 'obwalden': 'OW', 'nidwalden': 'NW',
    'glarus': 'GL', 'zug': 'ZG', 'freiburg': 'FR', 'solothurn': 'SO',
    'basel-stadt': 'BS', 'basel-landschaft': 'BL', 'schaffhausen': 'SH',
    'appenzell': 'AR', 'st. gallen': 'SG', 'sankt gallen': 'SG',
    'graubünden': 'GR', 'aargau': 'AG', 'thurgau': 'TG', 'tessin': 'TI',
    'waadt': 'VD', 'wallis': 'VS', 'neuenburg': 'NE', 'genf': 'GE',
    'jura': 'JU',
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


def naechste_egrid(p_daten: dict):
    """Die EGRID irgendwo im Kontakt finden."""
    for wert in p_daten.values():
        if isinstance(wert, str):
            treffer = EGRID.search(wert)
            if treffer:
                return treffer
    return None


def kanton_von(grundbuch: str) -> str:
    text = (grundbuch or '').strip().lower()
    if not text:
        return ''
    for name, kuerzel in KANTONE.items():
        if name in text:
            return kuerzel
    return ''


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    df = {f.get('name'): f.get('key')
          for f in (get('/dealFields', token).get('data') or [])}
    pf = {f.get('name'): f.get('key')
          for f in (get('/personFields', token).get('data') or [])}

    quelle = {
        'EGRID':    (pf.get('Objektinfo'),  df.get('EGRID')),
        'Parzelle': (pf.get('Grundstück'),  df.get('Parzelle')),
        'Kanton':   (pf.get('Grundbuch'),   df.get('Kanton')),
    }
    fehlend = [n for n, (a, b) in quelle.items() if not a or not b]
    if fehlend:
        print(f'> Ohne Feld: {", ".join(fehlend)}')
        print()

    personen = {p['id']: p for p in alle('/persons', token)}
    deals = alle('/deals', token, status='all_not_deleted')

    print(f'# Übernehmen — {len(deals)} Deals')
    print()

    zu_aendern: list[tuple[dict, dict]] = []
    for d in deals:
        person = d.get('person_id')
        kennung = person.get('value') if isinstance(person, dict) else person
        p_daten = personen.get(kennung) or {}

        neu: dict = {}
        for name, (vom_kontakt, zum_deal) in quelle.items():
            if not vom_kontakt or not zum_deal:
                continue
            if str(d.get(zum_deal) or '').strip():
                continue  # Was dasteht, bleibt.
            wert = str(p_daten.get(vom_kontakt) or '').strip()
            if name == 'EGRID':
                # Die EGRID kann in jedem Feld des Kontakts stecken --
                # im Bestand steht sie mal unter "Objektinfo", mal
                # mitten in der Zeile unter "Grundstück".
                treffer = EGRID.search(wert) or naechste_egrid(p_daten)
                wert = treffer.group(0) if treffer else ''
            elif name == 'Kanton':
                wert = kanton_von(wert)
            elif name == 'Parzelle':
                # Nicht die ganze Zeile übernehmen: gesucht ist die
                # Nummer, nicht ihr Beiwerk.
                ohne_egrid = EGRID.sub('', wert)
                treffer = NUMMER.search(ohne_egrid)
                wert = treffer.group(1) if treffer else ''
            if wert:
                neu[zum_deal] = wert
        if neu:
            zu_aendern.append((d, neu))

    umgekehrt = {v: k for k, (_, v) in quelle.items() if v}
    print(f'## {len(zu_aendern)} von {len(deals)} Deals werden ergänzt')
    print()
    for d, neu in zu_aendern[:15]:
        werte = ', '.join(f'{umgekehrt.get(k, k)} {v}' for k, v in neu.items())
        print(f'- `{(d.get("title") or "")[:50]}` — {werte}')
    if len(zu_aendern) > 15:
        print(f'- … und {len(zu_aendern) - 15} weitere')
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

#!/usr/bin/env python3
"""Räumt die Datenfelder in Pipedrive auf.

Ein Feld, das bei allen Deals leer ist, hilft niemandem: es verlängert
jede Maske, jeden Export und jede Suche, ohne je eine Entscheidung zu
tragen. Im Konto stehen einunddreissig eigene Felder, von denen die
meisten nie gefüllt wurden -- darunter dreizehn Unterfelder, die
Pipedrive automatisch zu einem Adressfeld anlegt.

Was dieses Werkzeug tut:

  Es zählt für jedes Feld, bei wie vielen Deals es gefüllt ist.
  Es legt die Felder an, die für ein Verkaufsgespräch nötig sind und
  fehlen.
  Es entfernt eigene Felder, die bei keinem einzigen Deal einen Wert
  tragen.

Gelöscht wird ausschliesslich, was vollständig leer ist -- dabei geht
kein Wert verloren, weil keiner da ist. Felder mit Inhalt bleiben
stehen und werden nur benannt; über sie entscheidet ein Mensch.

Ohne --schreiben verändert der Lauf nichts.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

# Die Angaben, die ein Anruf braucht. Mehr nicht: was im Gespräch nicht
# vorkommt, gehört nicht in die Maske.
GEBRAUCHT = {
    'Parzelle': 'varchar',
    'EGRID': 'varchar',
    'Gemeinde': 'varchar',
    'Kanton': 'varchar',
    'Zone': 'varchar',
    'Grundstück m²': 'double',
    'HNF m²': 'double',
    'Baujahr': 'double',
    'ÖREB Kataster': 'varchar',
}


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def schreibe(pfad: str, token: str, daten: dict | None, methode: str) -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    rumpf = json.dumps(daten).encode() if daten is not None else None
    anfrage = urllib.request.Request(
        url, data=rumpf,
        headers={'Content-Type': 'application/json'}, method=methode)
    try:
        with urllib.request.urlopen(anfrage, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # Die Adresse enthält den Token -- deshalb nur der Code.
        return {'success': False, 'code': e.code}


def alle_deals(token: str) -> list:
    raus, start = [], 0
    while True:
        a = get('/deals', token, start=start, limit=500, status='all_not_deleted')
        stueck = a.get('data') or []
        if not stueck:
            break
        raus.extend(stueck)
        weiter = (a.get('additional_data') or {}).get('pagination') or {}
        if not weiter.get('more_items_in_collection'):
            break
        start = weiter.get('next_start', start + 500)
    return raus


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    felder = get('/dealFields', token).get('data') or []
    deals = alle_deals(token)
    eigene = [f for f in felder if f.get('edit_flag')]

    print(f'# Datenfelder — {len(eigene)} eigene, {len(deals)} Deals')
    print()

    leer, gefuellt, gebraucht_leer = [], [], []
    for f in eigene:
        k = f.get('key')
        n = sum(1 for d in deals if d.get(k) not in (None, '', 0))
        if n:
            gefuellt.append((f, n))
        elif f['name'] in GEBRAUCHT:
            # Leer, aber gebraucht: Zone und Grundstücksfläche stehen im
            # Konto ohne Werte, weil der bisherige Export sie nie gefüllt
            # hat. Sie zu löschen und gleich wieder anzulegen wäre unsinnig
            # -- sie bleiben stehen und werden künftig befüllt.
            gebraucht_leer.append(f)
        else:
            leer.append((f, n))

    print('## Gefüllt — bleiben stehen')
    print()
    if gefuellt:
        print('| Feld | gefüllt |')
        print('|---|---:|')
        for f, n in sorted(gefuellt, key=lambda x: -x[1]):
            print(f'| {f["name"]} | {n} von {len(deals)} |')
    else:
        print('Kein einziges eigenes Feld trägt einen Wert.')
    print()

    if gebraucht_leer:
        print('## Leer, aber gebraucht — bleiben stehen')
        print()
        for f in gebraucht_leer:
            print(f'- {f["name"]} — wird künftig vom Abgleich gefüllt')
        print()

    print(f'## Leer und entbehrlich — {len(leer)} Felder')
    print()
    for f, _ in leer:
        print(f'- {f["name"]}')
    print()

    # Was noch fehlt, damit ein Gespräch ohne Nachschlagen geführt werden kann.
    vorhanden = {f['name'] for f in felder}
    fehlt = {n: t for n, t in GEBRAUCHT.items() if n not in vorhanden}
    if fehlt:
        print('## Fehlt und wird gebraucht')
        print()
        for n in fehlt:
            print(f'- {n}')
        print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        print()
        print(f'Mit dem Schreiblauf würden {len(leer)} leere Felder entfernt')
        print(f'und {len(fehlt)} fehlende angelegt. Gelöscht wird nur, was bei')
        print('keinem einzigen Deal einen Wert trägt; dabei geht nichts')
        print('verloren, weil nichts da ist.')
        return

    print('## Änderungen')
    print()
    for name, typ in fehlt.items():
        a = schreibe('/dealFields', token,
                     {'name': name, 'field_type': typ}, 'POST')
        print(f'- angelegt: {name} '
              f'{"" if a.get("success") else "(fehlgeschlagen)"}')

    for f, _ in leer:
        a = schreibe(f'/dealFields/{f["id"]}', token, None, 'DELETE')
        print(f'- entfernt: {f["name"]} '
              f'{"" if a.get("success") else "(fehlgeschlagen)"}')


if __name__ == '__main__':
    main()

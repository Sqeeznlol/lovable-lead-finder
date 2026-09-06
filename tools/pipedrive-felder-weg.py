#!/usr/bin/env python3
"""Entfernt drei Felder, die niemand mehr braucht.

  Eigentümer 1, Eigentümer 2 -- der Eigentümer ist der Kontakt, und
      mehrere Eigentümer hängen seit heute als Teilnehmer am Deal. Zwei
      Textfelder daneben veralten nur und widersprechen irgendwann dem
      Kontakt.
  EGID -- die Nummer eines Gebäudes. Für ein Gespräch über ein
      Grundstück ist die EGRID der Schlüssel; die EGID beantwortet
      keine Frage, die sich am Telefon stellt.

Gelöscht wird nur, was leer ist. Wo ein Wert steht, bleibt das Feld --
und der Lauf sagt, bei welchen Deals. Ein gelöschtes Feld lässt sich
nicht wiederherstellen, und was jemand von Hand eingetragen hat, wiegt
schwerer als Ordnung.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

WEG = ['Eigentümer 1', 'Eigentümer 2', 'EGID']


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def sende(pfad: str, token: str, daten: dict, methode: str = 'PUT') -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(
        url, data=json.dumps(daten).encode(),
        headers={'Content-Type': 'application/json'}, method=methode)
    try:
        with urllib.request.urlopen(anfrage, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {'success': False, 'code': e.code}


def loeschen(pfad: str, token: str) -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(url, method='DELETE')
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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    p.add_argument('--leeren', action='store_true',
                   help='Werte entfernen, bevor das Feld gelöscht wird')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    felder = [f for f in (get('/dealFields', token).get('data') or [])
              if f.get('name') in WEG and f.get('edit_flag')]
    fehlt = [n for n in WEG if n not in {f.get('name') for f in felder}]

    print('# Felder entfernen')
    print()
    if fehlt:
        print(f'> Nicht (mehr) vorhanden: {", ".join(fehlt)}')
        print()

    deals = alle('/deals', token, status='all_not_deleted')
    print(f'{len(deals)} Deals geprüft.')
    print()

    belegt: dict[str, list[str]] = {}
    for f in felder:
        mit_wert = [str(d.get('id')) for d in deals
                    if str(d.get(f['key']) or '').strip()]
        if mit_wert:
            belegt[f['name']] = mit_wert

    for f in felder:
        name = f['name']
        if name in belegt:
            print(f'- **{name}**: bei {len(belegt[name])} Deals gefüllt '
                  f'(z.B. {", ".join(belegt[name][:5])})')
        else:
            print(f'- {name}: leer, kann weg')
    print()

    if belegt and args.leeren:
        # Die Namen stehen inzwischen als Kontakte am Deal. Ein Feld,
        # das denselben Namen noch einmal führt, wirft in einem halben
        # Jahr die Frage auf, welcher der richtige ist -- doppelte
        # Wahrheiten altern schlecht.
        print('## Felder leeren')
        print()
        geleert = 0
        for f in felder:
            for kennung in belegt.get(f['name'], []):
                if sende(f'/deals/{kennung}', token,
                         {f['key']: ''}, 'PUT').get('success'):
                    geleert += 1
        print(f'- {geleert} Werte entfernt')
        print()
        belegt = {}
    elif belegt:
        print('> Felder mit Werten bleiben stehen. Erst gehören die')
        print('> Namen gesichert -- danach können sie weg.')
        print()

    leer = [f for f in felder if f['name'] not in belegt]
    if not leer:
        print('Nichts zu löschen.')
        return

    if not args.schreiben:
        print(f'Zu löschen: {", ".join(f["name"] for f in leer)}')
        print()
        print('**Probelauf** — es wurde nichts verändert.')
        return

    for f in leer:
        a = loeschen(f'/dealFields/{f["id"]}', token)
        stand = 'entfernt' if a.get('success') else f'fehlgeschlagen ({a.get("code")})'
        print(f'- {f["name"]}: {stand}')


if __name__ == '__main__':
    main()

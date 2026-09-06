#!/usr/bin/env python3
"""Entfernt drei Felder, die niemand mehr braucht.

  Eigentümer 1, Eigentümer 2 -- der Eigentümer ist der Kontakt, und
      mehrere Eigentümer hängen seit heute als Teilnehmer am Deal. Zwei
      Textfelder daneben veralten nur und widersprechen irgendwann dem
      Kontakt.
  EGID -- die Nummer eines Gebäudes. Für ein Gespräch über ein
      Grundstück ist die EGRID der Schlüssel; die EGID beantwortet
      keine Frage, die sich am Telefon stellt.

Gelöscht wird nur, was leer ist. Steht irgendwo ein Wert, bricht der
Lauf ab und nennt ihn: ein gelöschtes Feld ist nicht wiederherstellbar,
und was jemand von Hand eingetragen hat, wiegt schwerer als Ordnung.
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

    if belegt:
        print('**Abgebrochen** — es steht etwas drin. Ein gelöschtes Feld')
        print('lässt sich nicht wiederherstellen.')
        return

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    for f in felder:
        a = loeschen(f'/dealFields/{f["id"]}', token)
        stand = 'entfernt' if a.get('success') else f'fehlgeschlagen ({a.get("code")})'
        print(f'- {f["name"]}: {stand}')


if __name__ == '__main__':
    main()

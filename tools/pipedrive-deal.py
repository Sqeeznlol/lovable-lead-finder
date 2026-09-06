#!/usr/bin/env python3
"""Zeigt einen einzelnen Deal mit allem, was daran hängt.

Für die Stichprobe: "Deal 365 stimmt nicht" lässt sich nur beantworten,
wenn man sieht, was tatsächlich drinsteht -- Feld für Feld, mit den
Namen, die in der Oberfläche stehen, statt der Schlüssel der
Schnittstelle.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def zeige(titel: str, eintrag: dict, felder: list) -> None:
    """Einen Datensatz mit sprechenden Feldnamen ausgeben."""
    print(f'## {titel}')
    print()
    namen = {f['key']: f['name'] for f in felder}
    for schluessel, wert in eintrag.items():
        if isinstance(wert, (dict, list)) or wert in (None, ''):
            leer = wert in (None, '')
            name = namen.get(schluessel, schluessel)
            if leer and schluessel in namen:
                print(f'- {name}: _leer_')
            continue
        name = namen.get(schluessel)
        if name:
            print(f'- **{name}**: `{wert}`')
    print()


def main() -> None:
    if len(sys.argv) < 2:
        print('Aufruf: pipedrive-deal.py <deal-nummer>')
        sys.exit(1)
    nummer = sys.argv[1]

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    deal = (get(f'/deals/{nummer}', token) or {}).get('data') or {}
    if not deal:
        print(f'Deal {nummer} nicht gefunden.')
        sys.exit(1)

    print(f'# Deal {nummer} — {deal.get("title")}')
    print()
    print(f'- Pipeline/Phase: `{deal.get("pipeline_id")}` / `{deal.get("stage_id")}`')
    print(f'- Status: `{deal.get("status")}`')
    print()

    zeige('Felder des Deals', deal, get('/dealFields', token).get('data') or [])

    person = deal.get('person_id')
    kennung = person.get('value') if isinstance(person, dict) else person
    if kennung:
        p = (get(f'/persons/{kennung}', token) or {}).get('data') or {}
        print(f'## Kontakt {kennung}')
        print()
        print(f'- Name: `{p.get("name")}`')
        print(f'- Vorname: `{p.get("first_name")}`')
        print(f'- Nachname: `{p.get("last_name")}`')
        for nummer_ in (p.get('phone') or []):
            print(f'- Telefon: `{nummer_.get("value")}` ({nummer_.get("label")})')
        print()
        zeige('Felder des Kontakts', p,
              get('/personFields', token).get('data') or [])

    org = deal.get('org_id')
    if isinstance(org, dict) and org.get('name'):
        print(f'## Organisation\n\n- Name: `{org.get("name")}`\n')


if __name__ == '__main__':
    main()

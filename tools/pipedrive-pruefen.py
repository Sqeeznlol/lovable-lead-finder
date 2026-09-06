#!/usr/bin/env python3
"""Zeigt, was an einem Deal wirklich steht -- mit Feldnamen.

In der Seitenleiste von Pipedrive stehen nur Werte: "614", "1925",
"100". Was davon Baujahr ist und was Flaeche, sieht man erst beim
Darueberfahren. Hier steht beides nebeneinander, dazu die
Eigenschaften der Felder selbst: Typ, Reihenfolge, ob sie als
Pflichtfeld markiert sind.

Ausschliesslich lesend.
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


def zeige_felder(pfad: str, token: str, titel: str) -> list:
    felder = get(pfad, token).get('data') or []
    print(f'## {titel} — {len(felder)}')
    print()
    for f in sorted(felder, key=lambda x: x.get('order_nr') or 0):
        merkmale = []
        if f.get('mandatory_flag'):
            merkmale.append('**Pflicht**')
        if f.get('edit_flag'):
            merkmale.append('eigenes')
        else:
            merkmale.append('fest')
        if not f.get('add_visible_flag'):
            merkmale.append('nicht im Formular')
        print(f'- `{f.get("name")}` — {f.get("field_type")}, '
              f'Nr {f.get("order_nr")}, {", ".join(merkmale)}')
    print()
    return felder


def main() -> None:
    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token.')
        sys.exit(1)
    nummer = sys.argv[1] if len(sys.argv) > 1 else None

    dealfelder = zeige_felder('/dealFields', token, 'Deal-Felder')
    personfelder = zeige_felder('/personFields', token, 'Personen-Felder')
    zeige_felder('/organizationFields', token, 'Organisations-Felder')

    # Die eigenen Kontaktfelder vollstaendig, nicht nur die Flags, die
    # ich fuer wichtig hielt: der Block "Bitte ausfuellen" haengt an
    # einem Schalter, und welcher es ist, steht hier.
    print('## Eigene Kontaktfelder -- vollständig')
    print()
    for f in personfelder:
        if f.get('edit_flag'):
            print(f'- `{f.get("name")}`')
            print(f'  ```')
            print(f'  {json.dumps(f, ensure_ascii=False, sort_keys=True)}')
            print(f'  ```')
    print()

    if not nummer:
        return

    d = get(f'/deals/{nummer}', token).get('data') or {}
    print(f'## Deal {nummer}: {d.get("title")}')
    print()
    namen = {f['key']: f['name'] for f in dealfelder if f.get('key')}
    for k, v in d.items():
        if v in (None, '', [], {}):
            continue
        name = namen.get(k)
        if name and name != k:
            print(f'- **{name}** = `{str(v)[:160]}`')
    print()
    print('### Ohne eigenen Namen (feste Felder)')
    print()
    for k, v in d.items():
        if v in (None, '', [], {}) or k in namen and namen[k] != k:
            continue
        print(f'- {k} = `{str(v)[:100]}`')
    print()

    person = d.get('person_id')
    pid = person.get('value') if isinstance(person, dict) else person
    if pid:
        p = get(f'/persons/{pid}', token).get('data') or {}
        pnamen = {f['key']: f['name'] for f in personfelder if f.get('key')}
        print(f'## Kontakt {pid}: {p.get("name")}')
        print()
        for k, v in p.items():
            if v in (None, '', [], {}):
                continue
            name = pnamen.get(k)
            if name and name != k:
                print(f'- **{name}** = `{str(v)[:200]}`')
        print()


if __name__ == '__main__':
    main()

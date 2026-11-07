#!/usr/bin/env python3
"""Findet doppelte Organisationen und führt sie zusammen.

Beim Export wurde je Objekt eine Organisation angelegt, benannt nach
Adresse und Kennung:

    Liegenschaft: Zeughausstrasse 74 [CH1234...]

Lief der Export zweimal, entstand sie zweimal. Für den Anruf ist das
lästig: dieselbe Liegenschaft steht doppelt in der Liste, und der
Verlauf verteilt sich auf beide.

Zusammengeführt wird über die Kennung in eckigen Klammern -- die EGRID.
Sie ist schweizweit eindeutig; zwei Organisationen mit derselben EGRID
sind dieselbe Liegenschaft. Über den blossen Namen zu gehen wäre
gefährlich: "Bahnhofstrasse 12" gibt es in jeder zweiten Gemeinde.

Behalten wird die älteste -- an ihr hängt der längste Verlauf.

Ohne --schreiben verändert der Lauf nichts.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

# "Liegenschaft: Zeughausstrasse 74 [CH707709971116]"
KENNUNG = re.compile(r'\[([^\]]+)\]\s*$')


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def sende(pfad: str, token: str, daten: dict | None,
          methode: str = 'POST') -> dict:
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

    organisationen = alle('/organizations', token)
    print(f'# Organisationen — {len(organisationen)}')
    print()

    nach_kennung: dict[str, list[dict]] = {}
    ohne = 0
    for o in organisationen:
        treffer = KENNUNG.search(o.get('name') or '')
        if not treffer:
            ohne += 1
            continue
        nach_kennung.setdefault(treffer.group(1).strip(), []).append(o)

    doppelt = {k: v for k, v in nach_kennung.items() if len(v) > 1}
    zusammen = sum(len(v) - 1 for v in doppelt.values())
    print(f'## {len(doppelt)} Liegenschaften mehrfach angelegt')
    print()
    print(f'{zusammen} Organisationen würden verschwinden, '
          f'{len(organisationen) - zusammen} blieben übrig.')
    print()
    if ohne:
        print(f'> {ohne} Organisationen tragen keine Kennung im Namen.')
        print('> Sie bleiben unberührt -- über den blossen Namen zu gehen')
        print('> wäre gefährlich: "Bahnhofstrasse 12" gibt es überall.')
        print()

    for kennung, gruppe in list(doppelt.items())[:10]:
        namen = ', '.join(str(o.get('id')) for o in gruppe)
        print(f'- `{kennung}` — {len(gruppe)}× (Nummern {namen})')
    if len(doppelt) > 10:
        print(f'- … und {len(doppelt) - 10} weitere')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    zusammengefuehrt = fehler = 0
    for gruppe in doppelt.values():
        # Die älteste behalten: an ihr hängt der längste Verlauf.
        nach_alter = sorted(gruppe, key=lambda o: o.get('add_time') or '')
        bleibt, weg = nach_alter[0], nach_alter[1:]
        for o in weg:
            a = sende(f'/organizations/{o["id"]}/merge', token,
                      {'merge_with_id': bleibt['id']}, 'PUT')
            if a.get('success'):
                zusammengefuehrt += 1
            else:
                fehler += 1
    print(f'- {zusammengefuehrt} Organisationen zusammengeführt'
          + (f', {fehler} fehlgeschlagen' if fehler else ''))


if __name__ == '__main__':
    main()

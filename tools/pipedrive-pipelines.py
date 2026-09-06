#!/usr/bin/env python3
"""Legt die Pipeline "Search" an und nennt alle Kennungen.

Nach der Abfrage im Grundbuchportal steht der Eigentümer fest, die
Telefonnummer aber nicht immer. Beide Fälle gehören getrennt:

  * Nummer gefunden  -> Akquise, Phase "Neu". Dort wird angerufen.
  * keine Nummer     -> Search. Dort wird von Hand gesucht, und dafür
                        müssen alle Eigentümer wörtlich in der Notiz
                        stehen, so wie das Portal sie ausgibt.

Ohne --schreiben verändert der Lauf nichts, er zeigt nur, was wäre.
Am Ende stehen die Kennungen von Pipelines und Phasen -- die braucht
der Push, um einen Deal an der richtigen Stelle anzulegen.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

NEU = 'Search'
# Eine Phase genügt: in Search wird nichts weitergeschoben, sondern
# gesucht und dann nach Akquise verschoben.
NEU_PHASE = 'Eigentümer suchen'


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def sende(pfad: str, token: str, daten: dict, methode: str = 'POST') -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(
        url, data=json.dumps(daten).encode(),
        headers={'Content-Type': 'application/json'}, method=methode)
    try:
        with urllib.request.urlopen(anfrage, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        # Die Adresse enthält den Token -- deshalb nur der Code.
        return {'success': False, 'code': e.code}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token.')
        sys.exit(1)

    pipelines = (get('/pipelines', token).get('data') or [])
    phasen = (get('/stages', token).get('data') or [])

    ziel = next((x for x in pipelines
                 if (x.get('name') or '').strip().lower() == NEU.lower()), None)

    if ziel is None:
        if not args.schreiben:
            print(f'Pipeline "{NEU}" fehlt und würde angelegt.')
        else:
            a = sende('/pipelines', token, {'name': NEU})
            ziel = a.get('data')
            if not ziel:
                print(f'Pipeline liess sich nicht anlegen: {a}')
                sys.exit(1)
            print(f'Pipeline "{NEU}" angelegt.')
            b = sende('/stages', token,
                      {'name': NEU_PHASE, 'pipeline_id': ziel['id']})
            if b.get('data'):
                phasen.append(b['data'])
                print(f'Phase "{NEU_PHASE}" angelegt.')
            pipelines.append(ziel)
    else:
        print(f'Pipeline "{NEU}" gibt es bereits.')

    print()
    print('| Pipeline | Kennung | Phase | Kennung |')
    print('|---|---:|---|---:|')
    for pl in pipelines:
        eigene = [s for s in phasen if s.get('pipeline_id') == pl.get('id')]
        eigene.sort(key=lambda s: s.get('order_nr') or 0)
        if not eigene:
            print(f"| {pl.get('name')} | {pl.get('id')} | — | — |")
        for s in eigene:
            print(f"| {pl.get('name')} | {pl.get('id')} "
                  f"| {s.get('name')} | {s.get('id')} |")


if __name__ == '__main__':
    main()

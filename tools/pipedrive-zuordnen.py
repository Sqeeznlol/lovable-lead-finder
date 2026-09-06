#!/usr/bin/env python3
"""Sammelt die Deals mit unklarem Titel in einer eigenen Pipeline.

Der vereinbarte Titel ist

    Parz. 2688 · Lettenmattstrasse 12, 8903 Birmensdorf

Parzellennummer, dann die Adresse der Liegenschaft mit Postleitzahl und
Ort. Wer anruft, sieht damit in der Liste sofort, um welches Grundstück
es geht, ohne den Deal zu öffnen.

Nicht jeder Deal lässt sich so bilden: mancher hat keine Parzelle in der
Datenbank, bei manchem steht im Titel die Wohnadresse des Eigentümers
statt der Liegenschaft. Diese Deals gehören nicht stillschweigend
korrigiert -- sie gehören angeschaut. Dafür ist die Pipeline
"Zuordnen" da.

Verschoben wird nur die Pipeline, nicht der Inhalt. Zurück geht es
jederzeit, und welche Phase ein Deal vorher hatte, steht in der
Zusammenfassung dieses Laufs.

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

PIPELINE = 'Zuordnen'
PHASE = 'Prüfen'

# Parz. 2688 · Lettenmattstrasse 12, 8903 Birmensdorf
#
# Die Nummer darf Buchstaben vorweg tragen -- in Zürich heissen die
# Parzellen SE2627 oder FL681, nach dem Stadtkreis. Danach zwingend das
# Trennzeichen, eine Adresse, eine vierstellige Postleitzahl und ein
# Ort. Fehlt eines davon, ist der Titel nicht der vereinbarte.
TITEL = re.compile(
    r'^Parz\. [A-Za-zÄÖÜ]{0,3}\d+[a-zA-Z]?(?:[./-]\d+)? · '
    r'\S.*, \d{4} \S.*$')


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def sende(pfad: str, token: str, daten: dict, methode: str) -> dict:
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
        print('Kein Token.')
        sys.exit(1)

    pipelines = alle('/pipelines', token)
    phasen = alle('/stages', token)
    ziel = next((x for x in pipelines
                 if (x.get('name') or '').strip().lower() == PIPELINE.lower()),
                None)

    zeilen = []
    if ziel is None:
        if args.schreiben:
            a = sende('/pipelines', token, {'name': PIPELINE}, 'POST')
            ziel = a.get('data')
            if not ziel:
                print(f'Pipeline liess sich nicht anlegen: {a}')
                sys.exit(1)
            zeilen.append(f'Pipeline "{PIPELINE}" angelegt.')
        else:
            zeilen.append(f'Pipeline "{PIPELINE}" fehlt und würde angelegt.')

    ziel_phase = None
    if ziel:
        eigene = [s for s in phasen if s.get('pipeline_id') == ziel['id']]
        ziel_phase = next(
            (s for s in eigene
             if (s.get('name') or '').strip().lower() == PHASE.lower()),
            eigene[0] if eigene else None)
        if ziel_phase is None and args.schreiben:
            a = sende('/stages', token,
                      {'name': PHASE, 'pipeline_id': ziel['id']}, 'POST')
            ziel_phase = a.get('data')

    name_pipeline = {x['id']: x.get('name') for x in pipelines}
    name_phase = {s['id']: s.get('name') for s in phasen}

    deals = alle('/deals', token, status='open')
    passt, unklar = [], []
    for d in deals:
        titel = (d.get('title') or '').strip()
        if ziel and d.get('pipeline_id') == ziel['id']:
            continue          # liegt schon dort
        (passt if TITEL.match(titel) else unklar).append(d)

    print(f'# Zuordnen — {len(deals)} offene Deals')
    print()
    for z in zeilen:
        print(f'{z}')
        print()
    print(f'- {len(passt)} Titel entsprechen der Form')
    print(f'- {len(unklar)} Titel entsprechen ihr nicht')
    print()

    if unklar:
        print(f'## Kommen nach "{PIPELINE}"')
        print()
    verschoben = 0
    for d in unklar:
        herkunft = (f'{name_pipeline.get(d.get("pipeline_id"), "?")} · '
                    f'{name_phase.get(d.get("stage_id"), "?")}')
        print(f'- {d["id"]} `{(d.get("title") or "")[:60]}` — aus {herkunft}')
        if args.schreiben and ziel and ziel_phase:
            a = sende(f'/deals/{d["id"]}', token,
                      {'pipeline_id': ziel['id'],
                       'stage_id': ziel_phase['id']}, 'PUT')
            if a.get('success'):
                verschoben += 1
    print()

    if args.schreiben:
        print(f'**{verschoben} Deals verschoben.**')
    else:
        print('**Probelauf** — es wurde nichts verändert.')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Probe der Sofort-Meldung (lead-melden): Probe-Deals zeigen oder löschen.

Eine Probe ist ein Lead mit Name «TEST Pipedrive» und
angaben.pipedrive_probe = true. Ausgegeben werden nur Kennungen, Titel ohne
Namen, Pipeline, Stufe und ob Notiz und Anruf-Aufgabe daran hängen
(öffentliches Ablaufprotokoll).

    python3 tools/pipedrive-lead-probe.py            # zeigen
    python3 tools/pipedrive-lead-probe.py --loeschen # Deal und Person löschen
"""
import json, os, sys, urllib.parse, urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'
TOKEN = os.environ['PIPEDRIVE_TOKEN']


def rufe(methode, pfad, **params):
    params['api_token'] = TOKEN
    req = urllib.request.Request(f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}', method=methode)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


treffer = rufe('GET', '/deals/search', term='Check:', fields='title', limit=50).get('data', {}).get('items', [])
probe = []
for t in treffer:
    d = rufe('GET', f"/deals/{t['item']['id']}")['data']
    person = (d.get('person_id') or {}).get('name', '') if isinstance(d.get('person_id'), dict) else ''
    if person.startswith('TEST Pipedrive'):
        probe.append(d)
print(f'Probe-Deals: {len(probe)}')
for d in probe:
    akt = rufe('GET', f"/deals/{d['id']}/activities").get('data') or []
    print(f"- Deal {d['id']}: Pipeline {d['pipeline_id']}, Stufe {d['stage_id']}, Notizen {d.get('notes_count')}, "
          f"Aufgaben {len(akt)} ({', '.join(a['type'] + ' fällig ' + str(a['due_date']) for a in akt)})")
    if '--loeschen' in sys.argv:
        pid = d['person_id']['value'] if isinstance(d.get('person_id'), dict) else d.get('person_id')
        print('  Deal gelöscht:', rufe('DELETE', f"/deals/{d['id']}").get('success'))
        if pid:
            print('  Person gelöscht:', rufe('DELETE', f'/persons/{pid}').get('success'))

#!/usr/bin/env python3
"""Benennt die Deals nach der Liegenschaft, nicht nach dem Eigentümer.

Ein Probelauf am Bestand hat gezeigt, wie nötig das ist: viele Titel
tragen die Grundbuchzeile des Eigentümers --

    Rudolf Nater,  Schützenstrasse 17, 8575 Bürglen TG, 1/1 Deal

Die Schützenstrasse 17 ist das Wohnhaus von Herrn Nater, nicht das
Grundstück, um das es geht. Wer solche Titel maschinell kürzt, bekommt
eine saubere, aber falsche Liste -- und ruft Leute wegen der falschen
Adresse an.

Deshalb kommt der Titel hier ausschliesslich aus der Datenbank, über
die EGRID verbunden. Was sich dort nicht findet, behält seinen alten
Titel: lieber unschön als falsch.

Die Objektdaten werden als CSV erwartet (egrid, address, plz, gemeinde,
parzelle) -- der Ablauf holt sie mit psql, weil die Tabelle seit der
Zugangsbeschränkung eine Anmeldung verlangt.

Ohne --schreiben verändert der Lauf nichts.
"""
import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com/v1'

# "CH" und zwölf Ziffern -- so sieht eine EGRID aus.
EGRID = re.compile(r'\bCH\d{12}\b')


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


def titel(objekt: dict) -> str:
    """Adresse, Postleitzahl mit Ort, Parzellennummer.

    Am Telefon beginnt das Gespräch mit der Adresse; die Postleitzahl
    macht sie über mehrere Kantone eindeutig; und ohne Parzellennummer
    lässt sich weder das Grundbuch noch der ÖREB-Kataster aufrufen.
    """
    ort = ' '.join(x for x in (objekt.get('plz'), objekt.get('gemeinde')) if x)
    nr = (objekt.get('parzelle') or '').strip()
    adresse = (objekt.get('address') or '').strip()
    if not adresse:
        adresse = f'Parz. {nr}' if nr else ''
    kopf = ', '.join(x for x in (adresse, ort) if x)
    if nr and objekt.get('address'):
        return f'{kopf} · Parz. {nr}'
    return kopf


def person_von(deal: dict, personen: dict) -> dict:
    person = deal.get('person_id')
    kennung = person.get('value') if isinstance(person, dict) else person
    return personen.get(kennung) or {}


def parzelle_von(deal: dict, personen: dict, feld: str | None) -> str:
    """Die Parzellennummer steht am Kontakt, nicht am Deal.

    Das war der Grund, warum sie bei 411 von 424 Deals zu fehlen
    schien: gesucht wurde beim Deal, eingetragen ist sie im Feld
    "Grundstück" des Kontakts.
    """
    if not feld:
        return ''
    return str(person_von(deal, personen).get(feld) or '').strip()


def egrid_von(deal: dict, felder: list, personen: dict) -> str:
    """Die EGRID des Deals finden -- im Feld, im Titel oder am Kontakt."""
    for f in felder:
        wert = str(deal.get(f) or '')
        treffer = EGRID.search(wert)
        if treffer:
            return treffer.group(0)
    treffer = EGRID.search(str(deal.get('title') or ''))
    if treffer:
        return treffer.group(0)

    for wert in person_von(deal, personen).values():
        if isinstance(wert, str):
            treffer = EGRID.search(wert)
            if treffer:
                return treffer.group(0)
    return ''


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--objekte', required=True,
                   help='CSV mit egrid, address, plz, gemeinde, parzelle')
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    with open(args.objekte, encoding='utf-8') as f:
        objekte = {z['egrid']: z for z in csv.DictReader(f) if z.get('egrid')}
    print(f'# Titel — {len(objekte)} Objekte aus der Datenbank')
    print()

    deals = alle('/deals', token, status='all_not_deleted')
    personen = {p['id']: p for p in alle('/persons', token)}

    # Alle Textfelder durchsuchen: die EGRID steht mal im dafür
    # vorgesehenen Feld, mal im Feld "Objektinfo" des Kontakts.
    schluessel = [f['key'] for f in (get('/dealFields', token).get('data') or [])
                  if f.get('field_type') in ('varchar', 'text', 'varchar_auto')]
    personenfelder = get('/personFields', token).get('data') or []
    grundstueck = next((f['key'] for f in personenfelder
                        if f.get('name') == 'Grundstück'), None)

    zu_aendern: list[tuple[dict, str]] = []
    ohne_objekt = 0
    for d in deals:
        kennung = egrid_von(d, schluessel, personen)
        objekt = dict(objekte.get(kennung) or {})
        if not objekt:
            ohne_objekt += 1
            continue
        # Was die Datenbank nicht führt, steht vielleicht am Kontakt.
        if not objekt.get('parzelle'):
            objekt['parzelle'] = parzelle_von(d, personen, grundstueck)
        neu = titel(objekt)
        if neu and neu != (d.get('title') or '').strip():
            zu_aendern.append((d, neu))

    print(f'## {len(zu_aendern)} von {len(deals)} Deals bekommen einen neuen Titel')
    print()
    for d, neu in zu_aendern[:20]:
        print(f'- `{d.get("title")}`')
        print(f'  → `{neu}`')
    if len(zu_aendern) > 20:
        print(f'- … und {len(zu_aendern) - 20} weitere')
    print()
    if ohne_objekt:
        print(f'> {ohne_objekt} Deals lassen sich keinem Objekt in der')
        print('> Datenbank zuordnen. Sie behalten ihren Titel -- ein')
        print('> falscher Titel wäre schlimmer als ein unschöner.')
        print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    fehler = 0
    for d, neu in zu_aendern:
        if not put(f'/deals/{d["id"]}', token, {'title': neu}).get('success'):
            fehler += 1
    print(f'- {len(zu_aendern) - fehler} Titel gesetzt'
          + (f', {fehler} fehlgeschlagen' if fehler else ''))


if __name__ == '__main__':
    main()

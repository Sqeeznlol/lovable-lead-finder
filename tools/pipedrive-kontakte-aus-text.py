#!/usr/bin/env python3
"""Macht aus Namen, die als Text herumstehen, richtige Kontakte.

Im Bestand stecken Eigentümer an Stellen, an denen man sie nicht
anrufen kann: in den Feldern "Eigentümer 1" und "Eigentümer 2" des
Deals, in Notizen, in Bemerkungszeilen. Ein Name in einem Textfeld ist
für Pipedrive kein Mensch -- man kann ihn nicht wählen, nicht
anschreiben, nicht als erledigt markieren.

Dieser Lauf sammelt sie ein:

  * Name, Adresse und Telefonnummer werden aus dem Text gelesen.
  * Gibt es den Kontakt schon, wird er verwendet -- kein Doppel.
  * Sonst wird er angelegt, mit Nummer und Adresse, soweit vorhanden.
  * Hat der Deal noch keinen Kontakt, wird dieser der Hauptkontakt;
    sonst kommt er als Teilnehmer dazu.

Damit geht kein Eigentümer verloren, wenn die Textfelder später
verschwinden.

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

# Schweizer Nummern: "071 622 55 92", "+41 71 622 55 92", "0797778899".
TELEFON = re.compile(r'(?:\+41|0041|0)\s?\d{2}[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b')

# "8570 Weinfelden" -- Postleitzahl und Ort.
PLZ_ORT = re.compile(r'\b(\d{4})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàç.\- ]{1,30})')

ANTEIL = re.compile(
    r',?\s*(\d+/\d+\s*)?(Allein|Mit|Gesamt)eigentum(\s+zu\s+\d+/\d+)?', re.I)

# Was kein Name ist: Strassen, Zahlen, Floskeln.
WIE_EINE_ADRESSE = re.compile(r'^[^,\d]{2,}\s+\d+[a-z]?$', re.I)
KEIN_NAME = re.compile(
    r'^(unbekannt|eigent(ü|ue)mer|keine?r?|offen|tbd|siehe|noch|nummer)\b', re.I)


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


def lesen(text: str) -> dict | None:
    """Aus einer Zeile Name, Adresse und Nummer holen.

    Lieber nichts zurückgeben als etwas Falsches: ein erfundener
    Kontakt kostet später mehr Zeit, als er heute spart.
    """
    roh = (text or '').replace('\n', ' ').strip()
    if not roh or len(roh) < 4:
        return None

    nummer = ''
    treffer = TELEFON.search(roh)
    if treffer:
        nummer = treffer.group(0).strip()
        roh = roh.replace(nummer, ' ')

    adresse = ''
    ort = PLZ_ORT.search(roh)
    if ort:
        davor = roh[:ort.start()].rstrip().rstrip(',')
        strasse = davor.split(',')[-1].strip()
        adresse = ', '.join(x for x in (strasse, ort.group(0).strip()) if x)
        roh = davor[:davor.rfind(strasse)] if strasse and strasse in davor else davor

    roh = ANTEIL.sub('', roh).strip(' ,;-')
    name = roh.split(',')[0].strip() if ',' in roh else roh.strip()
    # Zwei Namensteile reichen; ein einzelnes Wort ist meist eine Notiz.
    if (not name or len(name) < 4 or name[0].isdigit()
            or KEIN_NAME.match(name) or WIE_EINE_ADRESSE.match(name)
            or len(name.split()) > 6):
        return None
    return {'name': name, 'adresse': adresse, 'telefon': nummer}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    dealfelder = [f for f in (get('/dealFields', token).get('data') or [])
                  if f.get('name') in ('Eigentümer 1', 'Eigentümer 2')]
    pf = {f.get('name'): f.get('key')
          for f in (get('/personFields', token).get('data') or [])}
    k_adresse = pf.get('Adresse')

    personen = alle('/persons', token)
    nach_name = {(p.get('name') or '').strip().lower(): p for p in personen}
    deals = alle('/deals', token, status='all_not_deleted')

    print(f'# Kontakte aus Text — {len(deals)} Deals')
    print()

    arbeit: list[tuple[dict, dict]] = []
    for d in deals:
        # Steht derselbe Name in "Eigentümer 1" und "Eigentümer 2",
        # ist es trotzdem ein Mensch.
        gesehen: set[str] = set()
        for f in dealfelder:
            gelesen = lesen(str(d.get(f['key']) or ''))
            if not gelesen:
                continue
            schluessel = gelesen['name'].lower()
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            arbeit.append((d, gelesen))

    print(f'## {len(arbeit)} Namen gefunden')
    print()
    for d, e in arbeit[:20]:
        schon = 'bekannt' if e['name'].lower() in nach_name else 'neu'
        stuecke = [e['adresse'], e['telefon']]
        print(f'- Deal {d.get("id")}: **{e["name"]}** ({schon})'
              + (' — ' + ', '.join(x for x in stuecke if x) if any(stuecke) else ''))
    if len(arbeit) > 20:
        print(f'- … und {len(arbeit) - 20} weitere')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    angelegt = verknuepft = 0
    for d, e in arbeit:
        vorhanden = nach_name.get(e['name'].lower())
        if vorhanden:
            kennung = vorhanden['id']
        else:
            daten = {'name': e['name']}
            if e['telefon']:
                daten['phone'] = [{'value': e['telefon'], 'primary': True}]
            if k_adresse and e['adresse']:
                daten[k_adresse] = e['adresse']
            antwort = sende('/persons', token, daten)
            kennung = (antwort.get('data') or {}).get('id')
            if not kennung:
                continue
            nach_name[e['name'].lower()] = {'id': kennung, 'name': e['name']}
            angelegt += 1

        # Ohne Hauptkontakt wird er es; sonst als Teilnehmer dazu.
        person = d.get('person_id')
        hat_haupt = bool(person.get('value') if isinstance(person, dict) else person)
        if not hat_haupt:
            if sende(f'/deals/{d["id"]}', token,
                     {'person_id': kennung}, 'PUT').get('success'):
                verknuepft += 1
        elif sende(f'/deals/{d["id"]}/participants', token,
                   {'person_id': kennung}).get('success'):
            verknuepft += 1

    print(f'- {angelegt} Kontakte angelegt, {verknuepft} mit Deals verknüpft')


if __name__ == '__main__':
    main()

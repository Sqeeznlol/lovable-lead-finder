#!/usr/bin/env python3
"""Bringt die Kontakte in Ordnung: Name, Adresse, Kartenlink.

Beim Import ist der ganze Eintrag aus der Grundbuchauskunft in die
Namensfelder geraten. Ein Beispiel aus dem Konto:

    Nachname:  Zeberg Sonja, Dorfstrasse 25
    Vorname:   6340 Baar
    Adresse:   (leer)
    Maps:      (leer)

Damit stimmt nichts: Wer die Liste nach Nachnamen sortiert, bekommt
Unsinn; wer die Adresse sucht, findet ein leeres Feld; und der
Kartenlink, der beim Anruf zeigt, wie das Haus dasteht, fehlt ganz.

Der vollständige Name trägt aber alles, was gebraucht wird -- er ist
nur an der falschen Stelle:

    "Zeberg Sonja, Dorfstrasse 25, 6340 Baar"
     ^^^^^^^^^^^^  ^^^^^^^^^^^^^^  ^^^^^^^^^
     Name          Strasse         PLZ und Ort

Schweizer Grundbuchauszüge führen den Nachnamen zuerst, deshalb wird
"Zeberg Sonja" zu Nachname "Zeberg" und Vorname "Sonja".

Firmen und Gemeinschaften werden nicht zerlegt: eine "Erbengemeinschaft
Müller" hat keinen Vornamen, und eine "Meier AG" auch nicht. Sie
behalten ihren Namen und bekommen nur Adresse und Kartenlink.

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

# Wer so heisst, ist keine Privatperson und wird nicht in Vor- und
# Nachname zerlegt.
KEINE_PERSON = re.compile(
    r'\b(AG|SA|GmbH|Sàrl|Sagl|Genossenschaft|Stiftung|Verein|Kirche|'
    r'Kirchgemeinde|Gemeinde|Stadt|Kanton|Erbengemeinschaft|Erben|'
    r'Immobilien|Immo|Holding|Treuhand|Verwaltung|Pensionskasse|'
    r'Baugesellschaft|Bau|Liegenschaften|Stockwerkeigentümer|'
    r'Miteigentümer|Gemeinschaft|Korporation|Genossame|Bank|'
    r'Versicherung|SBB|Post|Swisscom)\b', re.IGNORECASE)

# "8004 Zürich", "6340 Baar" -- vier Ziffern, dann der Ort.
PLZ_ORT = re.compile(r'^\s*(\d{4})\s+(.+?)\s*$')


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


def zerlegen(voll: str) -> dict:
    """Aus dem verrutschten Namen die vier Angaben herausholen.

    Zurück kommt, was sich sicher sagen lässt -- lieber ein Feld leer
    lassen als es falsch füllen. Ein Kontakt mit leerer Adresse ist ein
    Ärgernis, ein Kontakt mit fremder Adresse ein Fehlanruf.
    """
    teile = [t.strip() for t in (voll or '').split(',') if t.strip()]
    if not teile:
        return {}

    ergebnis: dict[str, str] = {}
    name = teile[0]

    # Von hinten aufrollen: das letzte Stück mit PLZ ist Ort, was
    # dazwischen liegt, ist die Strasse.
    ort = strasse = ''
    for t in reversed(teile[1:]):
        if not ort and PLZ_ORT.match(t):
            ort = t
        elif ort and not strasse:
            strasse = t
    if not ort and len(teile) >= 3:
        # Kein "8004 Zürich"-Muster: dann ist das letzte Stück der Ort.
        ort, strasse = teile[-1], teile[-2]

    if strasse or ort:
        ergebnis['adresse'] = ', '.join(x for x in (strasse, ort) if x)
    if strasse:
        ergebnis['strasse'] = strasse
    if ort:
        ergebnis['ort'] = ort

    # Der Name selbst: "Zeberg Sonja" -> Nachname Zeberg, Vorname Sonja.
    #
    # Nur wenn eine Adresse dabeisteht: dann stammt der Eintrag aus dem
    # Import und die Reihenfolge ist bekannt. Ein blosses "Hans Muster",
    # das jemand von Hand angelegt hat, wird nicht angerührt -- dort
    # wäre "Nachname Hans" schlicht falsch.
    if ergebnis.get('adresse') and not KEINE_PERSON.search(name):
        woerter = name.split()
        if woerter and woerter[0].lower() in ('von', 'van', 'de', 'du',
                                              'della', 'di', 'zu'):
            # "von Arx Peter" -- das Adelspartikel gehört zum Nachnamen.
            if len(woerter) == 3:
                ergebnis['nachname'] = ' '.join(woerter[:2])
                ergebnis['vorname'] = woerter[2]
        elif len(woerter) == 2:
            ergebnis['nachname'], ergebnis['vorname'] = woerter
    ergebnis['name'] = name
    return ergebnis


def karte(adresse: str) -> str:
    return ('https://www.google.com/maps/search/?api=1&query='
            + urllib.parse.quote(adresse + ', Schweiz'))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    p.add_argument('--grenze', type=int, default=0,
                   help='Höchstzahl geänderter Kontakte (0 = alle)')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    felder = get('/personFields', token).get('data') or []
    schluessel = {f.get('name'): f.get('key') for f in felder}
    k_adresse = schluessel.get('Adresse')
    k_maps = schluessel.get('Maps')

    personen = alle('/persons', token)
    print(f'# Kontakte — {len(personen)}')
    print()
    if not k_adresse:
        print('> Kein Feld "Adresse" bei den Kontakten gefunden.')
    if not k_maps:
        print('> Kein Feld "Maps" bei den Kontakten gefunden.')
    print()

    aenderungen: list[tuple[dict, dict]] = []
    for person in personen:
        voll = (person.get('name') or '').strip()
        teile = zerlegen(voll)
        if not teile:
            continue

        neu: dict = {}
        # Namen nur richten, wenn wirklich etwas verrutscht ist.
        if teile.get('nachname') and person.get('last_name') != teile['nachname']:
            neu['last_name'] = teile['nachname']
            neu['first_name'] = teile['vorname']
        adresse = teile.get('adresse')
        if adresse:
            if k_adresse and not (person.get(k_adresse) or '').strip():
                neu[k_adresse] = adresse
            if k_maps and not (person.get(k_maps) or '').strip():
                neu[k_maps] = karte(adresse)
        if neu:
            aenderungen.append((person, neu))

    print(f'## {len(aenderungen)} von {len(personen)} Kontakten unvollständig')
    print()
    for person, neu in aenderungen[:15]:
        print(f'- `{person.get("name")}`')
        for schl, wert in neu.items():
            bezeichnung = {'last_name': 'Nachname',
                           'first_name': 'Vorname',
                           k_adresse: 'Adresse',
                           k_maps: 'Maps'}.get(schl, schl)
            gekuerzt = wert if len(str(wert)) < 60 else str(wert)[:57] + '…'
            print(f'  - {bezeichnung}: `{gekuerzt}`')
    if len(aenderungen) > 15:
        print(f'- … und {len(aenderungen) - 15} weitere')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    if args.grenze:
        aenderungen = aenderungen[:args.grenze]
    fehler = 0
    for person, neu in aenderungen:
        a = put(f'/persons/{person["id"]}', token, neu)
        if not a.get('success'):
            fehler += 1
    print(f'- {len(aenderungen) - fehler} Kontakte ergänzt'
          + (f', {fehler} fehlgeschlagen' if fehler else ''))


if __name__ == '__main__':
    main()

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

# "8004 Zürich", "9063 Stein AR" -- vier Ziffern, dann der Ort. Der Ort
# endet am Komma, am Zeilenende oder am Trennzeichen zwischen zwei
# Eigentümern.
PLZ_IN_TEXT = re.compile(r'\b\d{4}\s+[A-Za-zÄÖÜäöüéèàç][^,\n¬]*')


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
    """Aus dem Namensfeld die Adresse herausholen.

    Zwei Dinge werden hier bewusst NICHT getan, beide, weil ein
    Probelauf an den echten Daten gezeigt hat, wohin sie führen:

    Der Name wird nicht in Vor- und Nachname zerlegt. Die Reihenfolge
    ist im Bestand nicht einheitlich -- neben "Zeberg Sonja" steht
    "Markus Schiffmann" und "Marlen Graf". Eine Regel, die beides
    richtig trifft, gibt es nicht, und ein falsch einsortierter Name
    ist schlimmer als ein unsortierter: man findet die Person nicht
    mehr wieder.

    Einträge mit mehreren Eigentümern werden übersprungen. Bei

        Ernst Meyer, Espenpark 8, 9220 Bischofszell
        ¬ Willi Walter Meyer, Weinbergstrasse 3, 8532 Weiningen

    gehören zwei Adressen zu zwei Menschen. Welche die richtige ist,
    kann hier niemand entscheiden -- und eine fremde Adresse im Feld
    heisst: Brief an den Falschen.
    """
    text = (voll or '').strip()
    if not text:
        return {}

    # Der Anteil am Ende ("1/1", "1/2") gehört nicht zur Adresse, die
    # Eigentumsform ebensowenig, und dass die Schweiz gemeint ist, weiss
    # der Anrufende auch so.
    text = re.sub(r',?\s*\d+/\d+\s*$', '', text)
    text = re.sub(r',?\s*(Allein|Mit|Gesamt)eigentum\s*$', '', text,
                  flags=re.IGNORECASE)
    text = re.sub(r',?\s*Schweiz\s*$', '', text, flags=re.IGNORECASE)

    stellen = list(PLZ_IN_TEXT.finditer(text))
    if len(stellen) != 1:
        # Keine Adresse erkennbar oder mehrere Eigentümer.
        return {'mehrdeutig': True} if len(stellen) > 1 else {}

    treffer = stellen[0]
    ort = treffer.group(0).strip()

    # Die Strasse steht unmittelbar vor der Postleitzahl, getrennt durch
    # ein Komma.
    davor = text[:treffer.start()].rstrip().rstrip(',')
    strasse = davor.split(',')[-1].strip()
    if not strasse:
        return {}

    # Der Name ist alles vor der Strasse. Die Reihenfolge von Vor- und
    # Nachname wird dabei nicht angetastet -- sie ist im Bestand nicht
    # einheitlich, und ein falsch einsortierter Name ist schlimmer als
    # ein unsortierter. Entfernt wird nur, was gar nicht in ein
    # Namensfeld gehört: Strasse, Postleitzahl und Ort.
    name = davor[:davor.rfind(strasse)].strip().rstrip(',').strip() \
        if strasse in davor else davor
    return {'adresse': f'{strasse}, {ort}', 'name': name or None}


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
    mehrdeutig = 0
    for person in personen:
        voll = (person.get('name') or '').strip()
        teile = zerlegen(voll)
        if teile.get('mehrdeutig'):
            mehrdeutig += 1
            continue
        if not teile:
            continue

        neu: dict = {}
        # Die Adresse gehört aus dem Namensfeld heraus -- dort steht sie
        # quer über Nach- und Vorname verteilt.
        name = teile.get('name')
        if name and name != voll:
            neu['name'] = name
        # Die Adresse kann auch im Adressfeld selbst stecken -- dort
        # steht bei vielen Kontakten die ganze Rohzeile der
        # Grundbuchauskunft: "Leutert-Illi, Marie Elsa,
        # Sennhüttenstrasse 3, 8912 Obfelden, Schweiz, Alleineigentum".
        # Ein solches Feld ist zwar gefüllt, aber unbrauchbar.
        adresse = teile.get('adresse')
        vorhanden = (person.get(k_adresse) or '').strip() if k_adresse else ''
        if not adresse and vorhanden:
            adresse = zerlegen(vorhanden).get('adresse')

        if adresse:
            # Ersetzt wird nur, was erkennbar die Rohzeile ist: eine von
            # Hand eingetragene Adresse bleibt, wie sie ist.
            roh = vorhanden and vorhanden.count(',') >= 3
            if k_adresse and (not vorhanden or roh) and vorhanden != adresse:
                neu[k_adresse] = adresse
            if k_maps and not (person.get(k_maps) or '').strip():
                neu[k_maps] = karte(adresse)
        if neu:
            aenderungen.append((person, neu))

    print(f'## {len(aenderungen)} von {len(personen)} Kontakten unvollständig')
    print()
    if mehrdeutig:
        print(f'> Bei {mehrdeutig} Kontakten stehen mehrere Eigentümer mit')
        print('> je eigener Adresse im Feld. Dort wird nichts gesetzt --')
        print('> welche Adresse gilt, kann nur ein Mensch entscheiden.')
        print()
    for person, neu in aenderungen[:15]:
        print(f'- `{person.get("name")}`')
        for schl, wert in neu.items():
            bezeichnung = {'name': 'Name',
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

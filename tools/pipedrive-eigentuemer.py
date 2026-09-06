#!/usr/bin/env python3
"""Trennt Miteigentümer in eigene Kontakte auf.

Im Bestand steht bei Miteigentum die ganze Grundbuchzeile in einem
einzigen Kontakt:

    Bolli, Jürg, Emmerstrasse 21, 8192 Glattfelden, Miteigentum zu 1/2
    Bolli, Susanne, Emmerstrasse 21, 8192 Glattfelden, Miteigentum zu 1/2

Das ist ein Datensatz für zwei Menschen. Man kann ihn weder anrufen
noch anschreiben: Der Name gehört zweien, und welche Adresse gilt,
steht nirgends.

Daraus wird je Eigentümer ein Kontakt mit eigener Adresse. Wer eine
Telefonnummer hat, wird der Hauptkontakt des Deals -- den ruft man an.
Die übrigen kommen als Teilnehmer an denselben Deal; so sieht man beim
Öffnen: drei Eigentümer, einer erreichbar.

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

# Woran ein Eintrag mehrere Eigentümer erkennen lässt: das Trennzeichen
# des Exports, oder eine zweite Postleitzahl mitten im Text.
PLZ = re.compile(r'\b\d{4}\s+[A-Za-zÄÖÜäöüéèàç]')
ANTEIL = re.compile(
    r',?\s*(\d+/\d+\s*)?(Allein|Mit|Gesamt)eigentum(\s+zu\s+\d+/\d+)?', re.I)

# Reste des vorherigen Eintrags, die beim Schneiden vorne hängenbleiben:
# das Land und der Bruchteil.
VORSPANN = re.compile(r'^\s*((Schweiz|Suisse|Svizzera)\b|\d+/\d+)[\s,]*', re.I)

# Erbengemeinschaften führen die Mitglieder als Aufzählung:
#
#   Schmid-Colemberg Luzi Erben, Gemeinschaft, Bahnhofstrasse 25, ...
#   bestehend aus:
#   -   Luzi Schmid, Rebenstrasse 69, 9320 Arbon
#   -   Beatrice Huber-Schmid, Dorf 10, 8561 Ottoberg
#
# Wer hier stumpf an der Postleitzahl schneidet, macht aus "Dorf 10"
# einen Namen. Die Aufzählung wird deshalb zuerst zerlegt.
AUFZAEHLUNG = re.compile(r'\bbestehend\s+aus\s*:?', re.I)
PUNKT = re.compile(r'\s+-\s+')

# Eine Strasse ist kein Name: "Dorf 10", "Bahnhofstrasse 25a".
WIE_EINE_ADRESSE = re.compile(r'^[^,\d]{2,}\s+\d+[a-z]?$', re.I)


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


def einzeln(stueck: str) -> dict | None:
    """Aus "Bolli, Jürg, Emmerstrasse 21, 8192 Glattfelden" Name und
    Adresse holen -- oder nichts, wenn das Ergebnis nicht taugt.
    """
    stueck = ANTEIL.sub('', (stueck or '')).strip(' ,-')
    teile = [t.strip() for t in stueck.split(',') if t.strip()]
    if len(teile) < 2:
        return None

    ort = teile[-1]
    strasse = teile[-2] if len(teile) >= 3 else ''
    name = ', '.join(teile[:-2]) if len(teile) >= 3 else teile[0]

    # "Schweiz  Bolli, Susanne" -> "Bolli, Susanne"
    while True:
        gekuerzt = VORSPANN.sub('', name).strip()
        if gekuerzt == name:
            break
        name = gekuerzt

    # Lieber keinen Eintrag als einen falschen: eine Strasse im
    # Namensfeld wäre schlimmer als ein fehlender Kontakt.
    if not name or WIE_EINE_ADRESSE.match(name) or name[0].isdigit():
        return None
    return {'name': name, 'adresse': ', '.join(x for x in (strasse, ort) if x)}


def aufteilen(text: str) -> list[dict]:
    """Aus einer Grundbuchzeile die einzelnen Eigentümer holen.

    Geschnitten wird an der Postleitzahl: nach ihr endet ein Eintrag,
    was danach kommt, gehört zum nächsten Menschen. Das ist
    verlässlicher als auf ein Trennzeichen zu hoffen -- der Export
    benutzt mal "¬", mal einen Zeilenumbruch, mal gar nichts.
    """
    roh = (text or '').replace('\n', ' ').strip()
    if not roh:
        return []

    # Erbengemeinschaft: die Gemeinschaft selbst bleibt der
    # Hauptkontakt, die Mitglieder kommen als eigene Einträge dazu.
    if AUFZAEHLUNG.search(roh):
        kopf, _, rest = AUFZAEHLUNG.split(roh, 1)[0], '', ''
        kopf = AUFZAEHLUNG.split(roh, 1)[0]
        rest = AUFZAEHLUNG.split(roh, 1)[1]
        eintraege = [einzeln(kopf)] + [einzeln(t) for t in PUNKT.split(rest)]
        gefiltert = [e for e in eintraege if e]
        return gefiltert if len(gefiltert) >= 2 else []

    stellen = list(PLZ.finditer(roh))
    if len(stellen) < 2:
        return []

    eigentuemer, anfang = [], 0
    for treffer in stellen:
        # Bis zum Ende der Ortsangabe: das nächste Komma nach der PLZ
        # oder der Beginn des nächsten Eintrags.
        ende = roh.find(',', treffer.end())
        stueck = roh[anfang:(ende if ende != -1 else len(roh))].strip(' ,')
        anfang = (ende + 1) if ende != -1 else len(roh)

        eintrag = einzeln(stueck)
        if eintrag:
            eigentuemer.append(eintrag)
    return eigentuemer if len(eigentuemer) >= 2 else []


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    felder = get('/personFields', token).get('data') or []
    k_adresse = next((f['key'] for f in felder if f.get('name') == 'Adresse'),
                     None)

    personen = alle('/persons', token)
    deals = alle('/deals', token, status='all_not_deleted')
    deal_zu_person: dict[int, list[dict]] = {}
    for d in deals:
        person = d.get('person_id')
        kennung = person.get('value') if isinstance(person, dict) else person
        if kennung:
            deal_zu_person.setdefault(kennung, []).append(d)

    print(f'# Miteigentümer — {len(personen)} Kontakte geprüft')
    print()

    arbeit = []
    for person in personen:
        geteilt = aufteilen(person.get('name') or '')
        if geteilt:
            arbeit.append((person, geteilt))

    print(f'## {len(arbeit)} Kontakte stehen für mehrere Menschen')
    print()
    for person, geteilt in arbeit[:10]:
        print(f'- `{(person.get("name") or "")[:70]}…`')
        for e in geteilt:
            print(f'  - **{e["name"]}** — {e["adresse"]}')
    if len(arbeit) > 10:
        print(f'- … und {len(arbeit) - 10} weitere')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    angelegt = angehaengt = 0
    for person, geteilt in arbeit:
        # Der erste bleibt der Hauptkontakt und behält Telefonnummer und
        # Verlauf; er wird nur auf seinen eigenen Namen zurechtgestutzt.
        erster, weitere = geteilt[0], geteilt[1:]
        daten = {'name': erster['name']}
        if k_adresse:
            daten[k_adresse] = erster['adresse']
        sende(f'/persons/{person["id"]}', token, daten, 'PUT')

        neue_kennungen = []
        for e in weitere:
            felder_neu = {'name': e['name'], 'org_id': person.get('org_id')}
            if k_adresse:
                felder_neu[k_adresse] = e['adresse']
            a = sende('/persons', token, felder_neu)
            kennung = (a.get('data') or {}).get('id')
            if kennung:
                neue_kennungen.append(kennung)
                angelegt += 1

        # Als Teilnehmer an die Deals des ursprünglichen Kontakts.
        for d in deal_zu_person.get(person['id'], []):
            for kennung in neue_kennungen:
                a = sende(f'/deals/{d["id"]}/participants', token,
                          {'person_id': kennung})
                if a.get('success'):
                    angehaengt += 1

    print(f'- {angelegt} Kontakte angelegt, {angehaengt} als Teilnehmer '
          'an Deals gehängt')


if __name__ == '__main__':
    main()

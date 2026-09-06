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

# Die Parzellennummer steht selten allein. Im Kontaktfeld "Grundstück"
# steht zum Beispiel
#
#   1, Grundstück: Liegenschaft Nr. 1344 ( CH136677062815 )
#
# Gesucht ist die 1344. Ohne diese Regel landete die ganze Zeile im
# Titel -- "Parz. 1, Grundstück: Liegenschaft Nr. 1344 ( CH... )".
NUMMER = re.compile(
    r'(?:Liegenschaft|Grundst(?:ü|ue)ck|Parzelle)\s*(?:Nr\.?)?\s*'
    r'\b([A-Z]{0,3}\d{1,6}[a-z]?)\b')


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
    """Parzellennummer, Adresse, Postleitzahl mit Ort.

    Die Parzelle steht vorn, weil sie das Grundstück eindeutig benennt
    und in Grundbuch wie ÖREB-Kataster der Schlüssel ist. Dann die
    Adresse -- damit beginnt das Gespräch am Telefon -- und die
    Postleitzahl, die sie über mehrere Kantone eindeutig macht.

    Kurz gehalten, weil Pipedrive in der Listenansicht rechts
    abschneidet: "an der" und "in" tragen nichts bei und kosten die
    Zeichen, an denen dann die Strasse fehlt.
    """
    ort = ' '.join(x for x in (objekt.get('plz'), objekt.get('gemeinde')) if x)
    nr = (objekt.get('parzelle') or '').strip()
    adresse = (objekt.get('address') or '').strip()

    hinten = ', '.join(x for x in (adresse, ort) if x)
    if nr and adresse:
        return f'Parz. {nr} · {hinten}'
    if nr:
        return ', '.join(x for x in (f'Parz. {nr}', ort) if x)
    return hinten


def aus_organisation(deal: dict) -> dict:
    """Die Liegenschaft aus dem Namen der Organisation lesen.

    Der Export nannte sie "Liegenschaft: Zeughausstrasse 74 [CH...]".
    Das ist die Adresse des Grundstücks -- anders als der alte
    Deal-Titel, in dem oft der Wohnsitz des Eigentümers steht.
    """
    org = deal.get('org_id')
    name = org.get('name') if isinstance(org, dict) else ''
    name = re.sub(r'^\s*Liegenschaft:\s*', '', name or '')
    name = re.sub(r'\s*\[[^\]]*\]\s*$', '', name).strip()
    if not name:
        return {}

    teile = [t.strip() for t in re.split(r'[,·]', name) if t.strip()]
    if not teile:
        return {}
    ort = next((t for t in teile[1:] if re.search(r'\b\d{4}\b', t)), '')
    if not ort and len(teile) > 1:
        ort = teile[-1]
    return {'address': teile[0], 'gemeinde': ort, 'plz': ''}


# Im Feld "Fläche" steht die Grundbuchauskunft im Volltext:
#
#   1, Fläche(n): 5'492 m² Oekonomiegebäude Assek.Nr. 700.1005 [227 m²]
#   Wohnhaus und Oekonomiegebäude Assek.Nr. 700.1049, Sangenstrasse 27,
#   8570 Weinfelden [300 m²] Garage Assek.Nr. 700.1051 [45 m²]
#
# Darin steckt die Adresse der Liegenschaft -- nicht zu verwechseln mit
# dem Wohnsitz des Eigentümers, der im Adressfeld steht. Bei diesem
# Beispiel wohnt Frau Burkhart an der Zweigstrasse 14, das Grundstück
# liegt an der Sangenstrasse 27.
OBJEKTADRESSE = re.compile(
    r'([A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàç.\-\' ]{2,40}\s+\d+[a-z]?)\s*,\s*'
    r'(\d{4})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàç.\- ]{1,30}?)\s*\[')


def aus_flaeche(p_daten: dict) -> dict:
    """Die Adresse der Liegenschaft aus dem Fläche-Text holen."""
    for wert in p_daten.values():
        if not isinstance(wert, str) or 'Assek' not in wert:
            continue
        treffer = OBJEKTADRESSE.search(wert)
        if treffer:
            return {'address': treffer.group(1).strip(),
                    'plz': treffer.group(2),
                    'gemeinde': treffer.group(3).strip()}
    return {}


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
    roh = str(person_von(deal, personen).get(feld) or '').strip()
    if not roh:
        return ''
    # Steht dort nur die Nummer, ist sie es schon.
    if re.fullmatch(r'[A-Z]{0,3}\d{1,6}[a-z]?', roh):
        return roh
    ohne_egrid = EGRID.sub('', roh)
    treffer = NUMMER.search(ohne_egrid)
    return treffer.group(1) if treffer else ''


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
    ohne_egrid: list[str] = []
    fremd: list[str] = []
    for d in deals:
        kennung = egrid_von(d, schluessel, personen)
        objekt = dict(objekte.get(kennung) or {})
        if not objekt:
            # Zweite Quelle: die Organisation trägt die Adresse der
            # Liegenschaft. Damit bekommen auch die Deals einen Titel,
            # deren Kanton noch nicht in der Datenbank steht.
            objekt = aus_organisation(d)
        if not objekt:
            # Dritte Quelle: die Grundbuchauskunft im Feld "Fläche".
            objekt = aus_flaeche(person_von(d, personen))
        if not objekt:
            # Zwei ganz verschiedene Gründe, die man auseinanderhalten
            # muss: entweder trägt der Deal gar keine EGRID -- dann ist
            # die Verbindung zum Objekt nie hergestellt worden --, oder
            # er trägt eine, die in der Datenbank fehlt. Letzteres heisst
            # meist: ein anderer Kanton, den wir noch nicht haben.
            (fremd if kennung else ohne_egrid).append(
                f'{d.get("id")} {kennung or d.get("title")}')
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
    if ohne_egrid:
        print(f'## {len(ohne_egrid)} Deals ohne EGRID')
        print()
        print('Bei ihnen wurde die Verbindung zum Objekt nie hergestellt.')
        print()
        for z in ohne_egrid[:10]:
            print(f'- `{z}`')
        print()
    if fremd:
        print(f'## {len(fremd)} Deals mit unbekannter EGRID')
        print()
        print('Die EGRID steht am Deal, das Objekt fehlt in der Datenbank --')
        print('meist ein Kanton, den wir noch nicht geladen haben.')
        print()
        for z in fremd[:10]:
            print(f'- `{z}`')
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

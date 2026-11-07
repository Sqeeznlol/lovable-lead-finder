#!/usr/bin/env python3
"""Bringt Titel und Adressfeld der bestehenden Deals in Ordnung.

Zwei Altlasten aus dem bisherigen Export:

Die Deal-Titel nennen die Gebäudefläche statt des Objekts -- "79m² ·
Affoltern am Albis". Damit findet niemand ein Grundstück wieder, und
genau daran scheiterte die Zuordnung von 377 der 390 Deals. Die Adresse
steht aber im Namen der verknüpften Organisation ("Liegenschaft:
Zeughausstrasse 74"), von dort lässt sie sich zurückholen.

Das Feld "Adresse" bringt zwölf Unterfelder mit, die Pipedrive
automatisch anlegt und die sich einzeln nicht löschen lassen. Alle
zwölf sind leer. Da die Adresse im Titel steht, ist das Feld doppelt --
mit ihm verschwinden die zwölf.

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


def get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def sende(pfad: str, token: str, daten: dict | None, methode: str) -> dict:
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


# Ein Titel, der nur eine Fläche nennt, benennt kein Grundstück.
NUR_FLAECHE = re.compile(r'^\s*[\d\'.,]+\s*m²', re.IGNORECASE)

# "8903 Birmensdorf (ZH)" -- vier Ziffern, dann der Ort.
PLZ_ORT = re.compile(r'\b(\d{4})\s+(.+)$')


def aus_organisation(name: str) -> str:
    """Die Adresse aus dem Organisationsnamen holen.

    Der bisherige Export nannte sie "Liegenschaft: Zeughausstrasse 74";
    das Präfix trägt nichts bei und der Zusatz in eckigen Klammern ist
    die Kennung, die im Titel nichts zu suchen hat.
    """
    n = re.sub(r'^\s*Liegenschaft:\s*', '', name or '')
    n = re.sub(r'\s*\[[^\]]*\]\s*$', '', n)
    return n.strip()


def gewuenschter_titel(alt: str, org: str, parzelle: str) -> str:
    """Adresse, Postleitzahl mit Ort, Parzellennummer.

    Am Telefon beginnt das Gespräch mit der Adresse; die Postleitzahl
    macht sie über mehrere Kantone eindeutig -- Dorfstrassen gibt es
    zuhauf; und ohne Parzellennummer lässt sich weder das Grundbuch
    noch der ÖREB-Kataster aufrufen.

    Nicht im Titel: der Eigentümername (er steht im Kontakt, und ein
    Eigentümer kann mehrere Parzellen haben -- dann stünde dreimal
    dasselbe da) und die Marge (sie ändert sich mit jeder Neuberechnung
    und der Titel logte danach).
    """
    # Was schon dasteht, ist die beste Quelle -- ausser es nennt bloss
    # eine Fläche. Dann hilft der Name der Organisation weiter.
    grundlage = alt.strip()
    if NUR_FLAECHE.match(grundlage) or not grundlage:
        grundlage = aus_organisation(org)
    if not grundlage:
        return ''

    # Eine bereits angehängte Parzelle wird neu gebildet, nicht verdoppelt.
    grundlage = re.sub(r'\s*·\s*Parz\.?\s*\S+\s*$', '', grundlage).strip()

    teile = [t.strip() for t in grundlage.split(',') if t.strip()]
    adresse = teile[0] if teile else ''
    ort = next((t for t in teile[1:] if PLZ_ORT.search(t)), '')
    if not ort and len(teile) > 1:
        ort = teile[-1]
    # Der alte Export trennte den Ort mit einem Mittelpunkt statt Komma.
    if not ort and '·' in adresse:
        adresse, _, ort = (x.strip() for x in adresse.partition('·'))

    kopf = ', '.join(x for x in (adresse, ort) if x)
    nr = (parzelle or '').strip()
    return f'{kopf} · Parz. {nr}' if nr and kopf else kopf


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    deals = alle('/deals', token, status='all_not_deleted')
    print(f'# Ordnen — {len(deals)} Deals')
    print()

    # ------------------------------------------------------------ Titel
    felder = get('/dealFields', token).get('data') or []
    parzellenfeld = next((f['key'] for f in felder
                          if f.get('name') == 'Parzelle'), None)

    zu_aendern: list[tuple[dict, str]] = []
    for d in deals:
        titel = (d.get('title') or '').strip()
        org = d.get('org_id') or {}
        parzelle = str(d.get(parzellenfeld) or '') if parzellenfeld else ''
        neu = gewuenschter_titel(
            titel, org.get('name') if isinstance(org, dict) else '', parzelle)
        if neu and neu != titel:
            zu_aendern.append((d, neu))

    print(f'## Titel — {len(zu_aendern)} von {len(deals)} werden umbenannt')
    print()
    for d, neu in zu_aendern[:25]:
        print(f'- `{d.get("title")}` → `{neu}`')
    if len(zu_aendern) > 25:
        print(f'- … und {len(zu_aendern) - 25} weitere')
    print()

    ohne_parzelle = sum(1 for d in deals
                        if not (str(d.get(parzellenfeld) or '').strip()
                                if parzellenfeld else ''))
    if ohne_parzelle:
        print(f'> Bei {ohne_parzelle} Deals fehlt die Parzellennummer.')
        print('> Sie bekommen Adresse und Ort, mehr ist nicht bekannt.')
        print()

    # ----------------------------------------------------------- Adresse
    felder = get('/dealFields', token).get('data') or []
    adressfeld = next((f for f in felder
                       if f.get('name') == 'Adresse' and f.get('edit_flag')),
                      None)
    if adressfeld:
        k = adressfeld['key']
        gefuellt = sum(1 for d in deals if d.get(k) not in (None, ''))
        print('## Feld "Adresse"')
        print()
        print(f'Bei {gefuellt} von {len(deals)} Deals gefüllt. Mit ihm')
        print('verschwinden die zwölf leeren Unterfelder, die Pipedrive')
        print('automatisch dazu anlegt.')
        print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    print('## Änderungen')
    print()
    fehler = 0
    for d, neu in zu_aendern:
        a = sende(f'/deals/{d["id"]}', token, {'title': neu}, 'PUT')
        if not a.get('success'):
            fehler += 1
    print(f'- {len(zu_aendern) - fehler} Titel geändert'
          + (f', {fehler} fehlgeschlagen' if fehler else ''))

    if adressfeld:
        a = sende(f'/dealFields/{adressfeld["id"]}', token, None, 'DELETE')
        stand = 'entfernt' if a.get('success') else f'fehlgeschlagen ({a.get("code")})'
        print(f'- Feld "Adresse": {stand}')


if __name__ == '__main__':
    main()

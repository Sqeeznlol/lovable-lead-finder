#!/usr/bin/env python3
"""Raeumt auf, was beim Ansehen eines Deals stoert.

Fuenf Dinge, alle im selben Lauf:

  Namen sichtbar machen. Die eigenen Felder stehen auf "nicht im
  Formular"; Pipedrive zeigt sie dann in der Zusammenfassung als nackte
  Werte -- 614, 1925, 100 -- und wer wissen will, was davon das Baujahr
  ist, muss mit der Maus darueberfahren. Sichtbar geschaltet stehen die
  Namen daneben.

  Die Rohdatenfelder am Kontakt aus dem Formular nehmen. Objektinfo,
  Grundstueck, Flaeche und Grundbuch tragen die Grundbuchtexte aus dem
  Import. Bei einem neuen Kontakt sind sie leer, und Pipedrive fordert
  sie unter "Bitte ausfuellen" ein. Ausfuellen soll sie aber niemand:
  sie sind Herkunft, nicht Aufgabe. Der Inhalt bleibt, nur die
  Aufforderung verschwindet.

  Die EGID wieder anlegen. Sie war geloescht, steckt aber als einzige
  Spur in einem kaputten Link -- und wer im GWR oder auf einem
  Kantonsportal nachschlagen will, braucht genau sie.

  Den OEREB-Link reparieren. Heute steht dort
  "locations=https://www.housing-stat.ch/...?egid=1061,1319": an der
  Stelle, wo die Gemeindenummer hingehoert, klebt eine fremde Adresse.
  Der Link fuehrt so nirgendwohin.

  Die Zone kuerzen. "Fuenfgeschossige Wohnzone (rechtskraeftig, 614m2,
  100%)" nennt dreimal, was daneben schon in eigenen Feldern steht.

Ohne --schreiben veraendert der Lauf nichts.
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

# Alter Name -> neuer Name. "HNF" ist die Hauptnutzflaeche, und was im
# Feld steht, ist nicht einmal sie, sondern ihr Zuwachs: wie viel
# Wohnflaeche auf der Parzelle noch dazukaeme. Genau das ist das
# Argument am Telefon -- und genau das las man dem Kuerzel nicht an.
UMBENENNEN = {'HNF m²': 'Mehr Wohnfläche m²'}

# Felder am Kontakt, die Herkunft tragen und keine Aufgabe sind.
HERKUNFT = ('Objektinfo', 'Grundstück', 'Fläche', 'Grundbuch')

EGRID = re.compile(r'\bCH\d{12}\b')

# Die EGID stand nirgends als Feld -- nur im kaputten OEREB-Link, als
# "...egid.html?egid=1061,1319". In der Datenbank ist gwr_egid fuer
# viele Objekte 0, und eine Null ist keine Gebaeudenummer.
IM_LINK = re.compile(r'egid=(\d+)')


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


def oereb(bfs: str, nr: str) -> str:
    if not bfs or not nr:
        return ''
    return ('https://maps.zh.ch/?locate=parz&locations='
            + urllib.parse.quote(f'{bfs},{nr}')
            + '&topic=OerebKatasterZH')


def kurze_zone(zone: str) -> str:
    """Nur der Name der Zone, ohne die angehängte Rechnung."""
    return re.sub(r'\s*\(.*$', '', zone or '').strip()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--objekte', required=True)
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token.')
        sys.exit(1)

    with open(args.objekte, newline='', encoding='utf-8') as f:
        objekte = {z['egrid']: z for z in csv.DictReader(f) if z.get('egrid')}

    # ------------------------------------------------ 1. Namen sichtbar
    dealfelder = get('/dealFields', token).get('data') or []
    unsichtbar = [f for f in dealfelder
                  if f.get('edit_flag') and not f.get('add_visible_flag')]
    print(f'## {len(unsichtbar)} eigene Deal-Felder sind nicht im Formular')
    print()
    for f in unsichtbar:
        print(f'- `{f["name"]}` wird sichtbar')
        if args.schreiben:
            sende(f'/dealFields/{f["id"]}', token,
                  {'add_visible_flag': True}, 'PUT')
    print()

    # -------------------------------- 2. Herkunftsfelder aus dem Formular
    personfelder = get('/personFields', token).get('data') or []
    # Nicht add_visible_flag: das steuert nur das Anlegen-Formular. Was
    # den Block "Bitte ausfuellen" fuellt, ist details_visible_flag --
    # sichtbar in der Detailansicht und leer.
    stoerend = [f for f in personfelder
                if f.get('name') in HERKUNFT and f.get('details_visible_flag')]
    print(f'## {len(stoerend)} Kontaktfelder fordern "Bitte ausfüllen"')
    print()
    for f in stoerend:
        print(f'- `{f["name"]}` verschwindet aus der Ansicht, Inhalt bleibt')
        if args.schreiben:
            sende(f'/personFields/{f["id"]}', token,
                  {'details_visible_flag': False,
                   'add_visible_flag': False}, 'PUT')
    print()

    # -------------------------------------------- 2b. Klarere Namen
    umzubenennen = [f for f in dealfelder
                    if f.get('name') in UMBENENNEN
                    and f.get('name') != UMBENENNEN[f['name']]]
    if umzubenennen:
        print(f'## {len(umzubenennen)} Felder heissen missverständlich')
        print()
        for f in umzubenennen:
            neu = UMBENENNEN[f['name']]
            print(f'- `{f["name"]}` wird `{neu}`')
            if args.schreiben:
                sende(f'/dealFields/{f["id"]}', token, {'name': neu}, 'PUT')
        print()

    # ------------------------------------------------ 3. EGID anlegen
    schluessel = {f['name']: f['key'] for f in dealfelder if f.get('name')}
    if 'EGID' not in schluessel:
        print('## Feld EGID fehlt und wird angelegt')
        print()
        if args.schreiben:
            a = sende('/dealFields', token,
                      {'name': 'EGID', 'field_type': 'varchar'}, 'POST')
            neu = (a.get('data') or {}).get('key')
            if neu:
                schluessel['EGID'] = neu
                print('- angelegt')
            else:
                print(f'- fehlgeschlagen ({a.get("code")})')
        print()

    # ------------------------------- 4./5. Link, EGID und Zone am Deal
    k_oereb = schluessel.get('ÖREB Kataster')
    k_zone = schluessel.get('Zone')
    k_egrid = schluessel.get('EGRID')
    k_egid = schluessel.get('EGID')
    k_parz = schluessel.get('Parzelle')

    deals = alle('/deals', token)
    links, zonen, egids = 0, 0, 0
    print('## Deals')
    print()
    for d in deals:
        neu = {}
        egrid = (d.get(k_egrid) or '') if k_egrid else ''
        if not EGRID.fullmatch(str(egrid).strip()):
            treffer = EGRID.search(json.dumps(d, ensure_ascii=False))
            egrid = treffer.group(0) if treffer else ''
        o = objekte.get(egrid) or {}

        # Der Link ist falsch, sobald etwas anderes als Zahlen und ein
        # Komma hinter "locations=" steht.
        alt = str(d.get(k_oereb) or '') if k_oereb else ''
        if alt and not re.search(r'locations=\d+(%2C|,)[A-Za-z0-9]+&', alt):
            richtig = oereb((o.get('bfs_nr') or '').strip(),
                            (o.get('parzelle') or '').strip()
                            or str(d.get(k_parz) or '').strip())
            if richtig and richtig != alt:
                neu[k_oereb] = richtig
                links += 1
            elif not richtig:
                neu[k_oereb] = ''      # ein falscher Link ist schlimmer
                links += 1             # als gar keiner

        alt_zone = str(d.get(k_zone) or '') if k_zone else ''
        kurz = kurze_zone(alt_zone)
        if kurz and kurz != alt_zone:
            neu[k_zone] = kurz
            zonen += 1

        # Der kaputte Link ist bei manchen Deals schon ersetzt, die
        # EGID darin also verloren. Ihre Quelle steht aber in der
        # Datenbank: housing_stat_url zeigt auf genau dieses Gebaeude.
        egid = (o.get('gwr_egid') or '').strip()
        if egid in ('0', '0.0', ''):
            gefunden = (IM_LINK.search(o.get('housing_stat_url') or '')
                        or IM_LINK.search(alt))
            egid = gefunden.group(1) if gefunden else ''
        if egid in ('0', '0.0'):
            egid = ''
        vorher = str(d.get(k_egid) or '').strip()
        if k_egid and vorher in ('0', '0.0') and not egid:
            neu[k_egid] = ''       # eine Null ist keine Gebaeudenummer
            egids += 1
        elif k_egid and egid and vorher in ('', '0', '0.0') and vorher != egid:
            neu[k_egid] = egid
            egids += 1

        if neu and args.schreiben:
            sende(f'/deals/{d["id"]}', token, neu, 'PUT')

    print(f'- {links} ÖREB-Links ersetzt')
    print(f'- {zonen} Zonen gekürzt')
    print(f'- {egids} EGID eingetragen')
    print()
    print('**Geschrieben.**' if args.schreiben
          else '**Probelauf** — es wurde nichts verändert.')


if __name__ == '__main__':
    main()

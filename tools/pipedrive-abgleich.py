#!/usr/bin/env python3
"""Gleicht die Zürcher Objekte aus wohntraums.life mit Pipedrive ab.

Zwei Listen, die dasselbe meinen, laufen auseinander, sobald niemand
sie zusammenhält. In der Datenbank stehen die gerechneten Objekte, in
Pipedrive die Gespräche -- und was in der einen fehlt, merkt man in der
anderen erst beim Anruf.

Der Abgleich ordnet beide Seiten über die EGRID zu, die schweizweit
eindeutig ist. Nicht über die Adresse: über sie entstanden schon
dreizehn Einträge für dasselbe Grundstück.

Daraus ergeben sich drei Stapel:

    beidseitig   Deal und Objekt kennen sich -- fehlende Felder
                 werden ergänzt, vorhandene nie überschrieben.
    fehlt in PD  gerechnetes Objekt ohne Deal -- wird angelegt.
    ohne Objekt  Deal ohne Gegenstück in der Datenbank -- wird nur
                 gemeldet. Was in Pipedrive steht, gehört jemandem;
                 gelöscht wird hier nichts.

Angelegt wird nach Marge sortiert und nur bis --grenze. Zwei Personen
telefonieren; eine Liste, die länger ist als ihre Woche, ist keine
Liste mehr.

Wer angelegt wurde, bekommt seine Deal-Nummer zurück in die Datenbank
geschrieben -- als SQL-Datei unter --rueckschreiben, die der Workflow
danach ausführt. Damit findet der nächste Lauf dasselbe Objekt wieder,
auch wenn jemand den Titel von Hand ändert.

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

EGRID = re.compile(r'\bCH\d{12}\b')

# "Parz. 2688 · Lettenmattstrasse 12, 8903 Birmensdorf" -- Nummer und
# Postleitzahl. Die Parzellennummer allein genuegt nicht: sie ist nur
# innerhalb einer Gemeinde eindeutig, schweizweit gibt es Tausende
# Parzellen 12. Erst mit der Postleitzahl wird daraus ein Schluessel.
# Gebildet wird der Schluessel nur aus einem Titel in der vereinbarten
# Form. Sonst greift er auch bei "Parz. 1, Grundstueck: Liegenschaft
# Nr. 1344" -- und liest die Grundstuecksnummer als Postleitzahl.
PARZELLE = re.compile(
    r'^Parz\. ([A-Za-zÄÖÜ]{0,3}\d+[a-zA-Z]?(?:[./-]\d+)?) · '
    r'\S.*, (\d{4}) \S')

# Welchen Typ ein Feld braucht, wenn es in Pipedrive noch fehlt.
FELDTYPEN = {
    'Parzelle': 'varchar', 'EGRID': 'varchar', 'Gemeinde': 'varchar',
    'Kanton': 'varchar', 'Zone': 'varchar', 'Geschosse': 'double',
    'Baujahr': 'double', 'HNF m²': 'double', 'Grundstück m²': 'double',
    'ÖREB Kataster': 'varchar',
}

# Spalte in der Datenbank -> Feldname in Pipedrive
ZUORDNUNG = {
    'parzelle':    'Parzelle',
    'egrid':       'EGRID',
    'gemeinde':    'Gemeinde',
    'kanton':      'Kanton',
    'zone':        'Zone',
    'geschosse':   'Geschosse',
    'baujahr':     'Baujahr',
    'hnf_delta':   'HNF m²',
    'bebaubar_m2': 'Grundstück m²',
}

# Angelegt wird nur, was vollstaendig ist. Ein halber Deal kostet beim
# Telefonieren mehr Zeit, als er spart: wer anruft, muss nachschlagen,
# was ohnehin in der Datenbank steht.
PFLICHT = ('egrid', 'parzelle', 'address', 'plz', 'gemeinde', 'zone',
           'geschosse', 'bebaubar_m2', 'eigentuemer_name')

ZIEL_PIPELINE = 'Akquise'
ZIEL_PHASE = 'Neu'


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


def parzellenschluessel(text: str) -> str | None:
    """Parzellennummer und Postleitzahl als ein Schlüssel."""
    t = PARZELLE.match((text or '').strip())
    return f'{t.group(1).upper()}@{t.group(2)}' if t else None


def texte(satz: dict) -> str:
    """Alles, was in einem Eintrag als Text steht -- flach."""
    stuecke = []
    for wert in (satz or {}).values():
        if isinstance(wert, str):
            stuecke.append(wert)
        elif isinstance(wert, (list, dict)):
            stuecke.append(json.dumps(wert, ensure_ascii=False))
    return ' '.join(stuecke)


def oereb(objekt: dict) -> str:
    """Der Link, der die Parzelle im Kataster auch wirklich auswählt."""
    nr = (objekt.get('parzelle') or '').strip()
    bfs = (objekt.get('bfs_nr') or '').strip()
    if not nr or not bfs:
        return ''
    return ('https://maps.zh.ch/?locate=parz&locations='
            + urllib.parse.quote(f'{bfs},{nr}')
            + '&topic=OerebKatasterZH')


def titel(p: dict) -> str:
    """Parzellennummer, dann die Adresse der Liegenschaft.

    Dieselbe Form, die alle bestehenden Deals tragen -- sonst landet
    jeder neue Deal beim nächsten Lauf in "Zuordnen".
    """
    ort = ' '.join(str(x) for x in (p.get('plz'), p.get('gemeinde')) if x)
    nr = (p.get('parzelle') or '').strip()
    adresse = (p.get('address') or '').strip()
    hinten = ', '.join(x for x in (adresse, ort) if x)
    if nr and adresse:
        return f'Parz. {nr} · {hinten}'
    if nr:
        return ', '.join(x for x in (f'Parz. {nr}', ort) if x)
    return hinten or 'Ohne Adresse'


def felder(p: dict, schluessel: dict, vorhanden: dict | None = None) -> dict:
    """Die Werte für die eigenen Felder; nur was noch fehlt."""
    raus = {}
    for spalte, name in ZUORDNUNG.items():
        k = schluessel.get(name)
        wert = (p.get(spalte) or '').strip()
        if not k or not wert:
            continue
        if vorhanden is not None and str(vorhanden.get(k) or '').strip():
            continue
        # Eine Null ist keine Angabe. "HNF m² 0" liest sich am Telefon
        # wie "kein Potenzial", gemeint ist aber "noch nicht gerechnet"
        # -- das Feld bleibt lieber leer, bis eine Zahl dasteht.
        if wert in ('0', '0.0') and spalte in ('hnf_delta', 'bebaubar_m2',
                                               'geschosse', 'baujahr'):
            continue
        raus[k] = wert
    k = schluessel.get('ÖREB Kataster')
    link = oereb(p)
    if k and link and not (vorhanden or {}).get(k):
        raus[k] = link
    return raus


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--objekte', required=True)
    p.add_argument('--grenze', type=int, default=50,
                   help='Höchstens so viele neue Deals anlegen')
    p.add_argument('--rueckschreiben',
                   help='Datei für das SQL, das die Deal-Nummern zurückträgt')
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token.')
        sys.exit(1)

    with open(args.objekte, newline='', encoding='utf-8') as f:
        objekte = {z['egrid']: z for z in csv.DictReader(f) if z.get('egrid')}

    deals = alle('/deals', token)
    personen = {x['id']: x for x in alle('/persons', token)}
    orgs = {x['id']: x for x in alle('/organizations', token)}

    # Welche EGRID gehört zu welchem Deal? Sie steht mal im eigenen
    # Feld, mal nur im Fliesstext eines Kontakts.
    # Die Objekte auch über Parzelle und Postleitzahl auffindbar machen:
    # der Eigentümername steht nur in Pipedrive, die EGRID nur bei
    # einem Teil der Deals -- Parzelle und Ort stehen dafür im Titel.
    ueber_parzelle: dict[str, str] = {}
    for e, o in objekte.items():
        nr = (o.get('parzelle') or '').strip().upper()
        plz = (o.get('plz') or '').strip()
        if nr and plz:
            ueber_parzelle.setdefault(f'{nr}@{plz}', e)

    zu_deal: dict[str, dict] = {}
    ohne = []
    ueber_nr = 0
    for d in deals:
        text = texte(d)
        for quelle, kasten in ((d.get('person_id'), personen),
                               (d.get('org_id'), orgs)):
            nr = quelle.get('value') if isinstance(quelle, dict) else quelle
            if nr in kasten:
                text += ' ' + texte(kasten[nr])
        treffer = EGRID.search(text)
        if treffer:
            zu_deal.setdefault(treffer.group(0), d)
            continue
        schluessel = parzellenschluessel(d.get('title') or '')
        e = ueber_parzelle.get(schluessel or '')
        if e:
            zu_deal.setdefault(e, d)
            ueber_nr += 1
        else:
            ohne.append(d)

    beidseitig = [e for e in objekte if e in zu_deal]
    fehlend = [e for e in objekte if e not in zu_deal]
    verwaist = [e for e in zu_deal if e not in objekte]

    def marge(e: str) -> float:
        try:
            return float(objekte[e].get('marge_chf') or 0)
        except ValueError:
            return 0.0

    fehlend.sort(key=marge, reverse=True)


    print(f'# Abgleich Zürich — {len(objekte)} Objekte, {len(deals)} Deals')
    print()
    print(f'- {len(beidseitig)} beidseitig bekannt')
    print(f'- {len(fehlend)} Objekte ohne Deal')
    print(f'- {len(verwaist)} Deals mit EGRID, die die Datenbank nicht kennt')
    print(f'- davon {ueber_nr} über Parzelle und Postleitzahl gefunden')
    print(f'- {len(ohne)} Deals ohne Zuordnung -- unberührt')
    print()

    # Ein Deal ohne Eigentümer ist eine leere Karteikarte: man kann ihn
    # weder anrufen noch anschreiben. Wie viele der fehlenden Objekte
    # überhaupt anrufbar sind, entscheidet, was "anlegen" hier heisst.
    kandidaten, luecken = [], {}
    for e in fehlend:
        o = objekte[e]
        if o.get('kanton') != 'ZH':
            continue
        if o.get('ausgeschlossen') == 't' or \
           o.get('preselection_status') == 'Ausschliessen':
            continue
        try:
            if float(o.get('hnf_delta') or 0) <= 0:
                continue
        except ValueError:
            continue
        fehlt = [f for f in PFLICHT if not (o.get(f) or '').strip()]
        if fehlt:
            for f in fehlt:
                luecken[f] = luecken.get(f, 0) + 1
            continue
        kandidaten.append(e)

    print(f'Davon vollständig genug zum Anlegen: {len(kandidaten)}.')
    print()
    if luecken:
        print('Woran die übrigen ZH-Objekte scheitern:')
        for f, n in sorted(luecken.items(), key=lambda x: -x[1]):
            print(f'- {f} fehlt bei {n}')
        print()

    schluessel = {f['name']: f['key']
                  for f in (get('/dealFields', token).get('data') or [])
                  if f.get('name')}

    # Ein Feld, das es nicht gibt, kann nichts aufnehmen. Fehlt eines,
    # wird es angelegt statt uebersprungen -- sonst faellt die Angabe
    # stillschweigend unter den Tisch.
    fehlende_felder = [n for n in FELDTYPEN if n not in schluessel]
    if fehlende_felder:
        print(f'## Fehlende Felder: {", ".join(fehlende_felder)}')
        print()
        for name in fehlende_felder:
            if not args.schreiben:
                continue
            a = sende('/dealFields', token,
                      {'name': name, 'field_type': FELDTYPEN[name]}, 'POST')
            neu = (a.get('data') or {}).get('key')
            if neu:
                schluessel[name] = neu
                print(f'- `{name}` angelegt')
            else:
                print(f'- `{name}` liess sich nicht anlegen ({a.get("code")})')
        print()

    # ---------------------------------------------------- ergänzen
    ergaenzt = 0
    print('## Bestehende Deals ergänzen')
    print()
    for e in beidseitig:
        d = zu_deal[e]
        neu = felder(objekte[e], schluessel, d)
        if not neu:
            continue
        ergaenzt += 1
        if ergaenzt <= 15:
            namen = {v: k for k, v in schluessel.items()}
            was = ', '.join(f'{namen.get(k, k)} {str(v)[:24]}'
                            for k, v in neu.items())
            print(f'- {d["id"]} `{(d.get("title") or "")[:40]}` — {was}')
        if args.schreiben:
            sende(f'/deals/{d["id"]}', token, neu, 'PUT')
    if ergaenzt > 15:
        print(f'- … und {ergaenzt - 15} weitere')
    if not ergaenzt:
        print('Nichts zu ergänzen -- alle Felder stehen schon.')
    print()

    # ---------------------------------------------------- anlegen
    pipelines = alle('/pipelines', token)
    phasen = alle('/stages', token)
    ziel = next((x for x in pipelines
                 if (x.get('name') or '').strip() == ZIEL_PIPELINE), None)
    ziel_phase = None
    if ziel:
        eigene = [s for s in phasen if s.get('pipeline_id') == ziel['id']]
        ziel_phase = next(
            (s for s in eigene
             if (s.get('name') or '').strip() == ZIEL_PHASE),
            eigene[0] if eigene else None)

    anzulegen = kandidaten[:args.grenze]
    print(f'## Neu anlegen — {len(anzulegen)} von {len(kandidaten)}')
    print()
    if len(kandidaten) > args.grenze:
        print(f'> Nach Marge sortiert; der Rest folgt beim nächsten Lauf.')
        print()

    rueck = []
    angelegt = 0
    for e in anzulegen:
        o = objekte[e]
        t = titel(o)
        if not args.schreiben:
            print(f'- `{t[:55]}` — Marge {marge(e)/1e6:.1f} Mio')
            continue

        org = sende('/organizations', token, {'name': f'{t} [{e}]'}, 'POST')
        org_id = (org.get('data') or {}).get('id')

        person_id = None
        name = (o.get('eigentuemer_name') or o.get('owner_name') or '').strip()
        if name:
            daten = {'name': name, 'org_id': org_id}
            nummer = (o.get('owner_phone') or '').strip()
            if nummer:
                daten['phone'] = [{'value': nummer, 'primary': True}]
            adresse = (o.get('eigentuemer_adresse') or '').strip()
            if adresse:
                daten['address'] = adresse
            person_id = (sende('/persons', token, daten, 'POST')
                         .get('data') or {}).get('id')

        try:
            wert = int(float(o.get('marge_chf') or 0))
        except ValueError:
            wert = 0
        neu = {'title': t, 'value': wert, 'currency': 'CHF',
               'org_id': org_id, **felder(o, schluessel)}
        if person_id:
            neu['person_id'] = person_id
        if ziel and ziel_phase:
            neu['pipeline_id'] = ziel['id']
            neu['stage_id'] = ziel_phase['id']

        antwort = sende('/deals', token, neu, 'POST')
        nr = (antwort.get('data') or {}).get('id')
        if nr:
            angelegt += 1
            rueck.append((e, nr))
            if angelegt <= 20:
                print(f'- Deal {nr} `{t[:50]}`')
        else:
            print(f'- **fehlgeschlagen** `{t[:50]}` — {antwort.get("code")}')
    if angelegt > 20:
        print(f'- … und {angelegt - 20} weitere')
    print()

    if args.rueckschreiben and rueck:
        with open(args.rueckschreiben, 'w', encoding='utf-8') as f:
            for e, nr in rueck:
                f.write('update public.properties set pipedrive_deal_id='
                        f"'{nr}' where egrid = '{e}';\n")
        print(f'{len(rueck)} Deal-Nummern werden zurückgeschrieben.')
        print()

    # ---------------------------------------------------- melden
    if verwaist:
        print('## Deals, deren EGRID die Datenbank nicht kennt')
        print()
        for e in verwaist[:25]:
            d = zu_deal[e]
            print(f'- {d["id"]} `{(d.get("title") or "")[:50]}` — {e}')
        if len(verwaist) > 25:
            print(f'- … und {len(verwaist) - 25} weitere')
        print()

    if args.schreiben:
        print(f'**{ergaenzt} Deals ergänzt, {angelegt} angelegt.**')
    else:
        print('**Probelauf** — es wurde nichts verändert.')


if __name__ == '__main__':
    main()

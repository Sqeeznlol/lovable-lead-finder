#!/usr/bin/env python3
"""Füllt leere Felder bestehender Pipedrive-Deals aus der Datenbank nach.

Die Deals im Konto tragen ihre Angaben nur zu einem kleinen Teil: von
390 Deals sind dreizehn vollständig, bei den übrigen stehen Zone,
Grundstücksfläche, Baujahr und Parzelle leer. Die Angaben sind
vorhanden -- sie stehen in der Datenbank hinter wohntraums.life und
wurden beim Anlegen nur nicht mitgegeben.

Zugeordnet wird in dieser Reihenfolge:

  1. EGRID   -- schweizweit eindeutig, die verlässlichste Verbindung
  2. Parzelle + Gemeinde -- eindeutig innerhalb der Gemeinde
  3. Adresse + Gemeinde  -- letzte Möglichkeit, mit Vorsicht

Geschrieben wird ausschliesslich in Felder, die leer sind. Was jemand
von Hand eingetragen hat, bleibt unangetastet -- eine Eingabe von
Menschenhand ist mehr wert als ein Wert aus dem Import.

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

# Feldname in Pipedrive -> Spalte in der Datenbank
ZUORDNUNG = {
    'Parzelle': 'parzelle',
    'EGRID': 'egrid',
    'Gemeinde': 'gemeinde',
    'Kanton': 'kanton',
    'Zone': 'zone',
    'Grundstück m²': 'bebaubar_m2',
    'Mehr Wohnfläche m²': 'hnf_delta',
    'Baujahr': 'baujahr',
    'Geschosse': 'geschosse',
    'ÖREB Kataster': 'housing_stat_url',
    'EGID': 'gwr_egid',
}

SPALTEN = ('id,egrid,parzelle,address,strassenname,hausnummer,plz,gemeinde,'
           'kanton,zone,area,bebaubar_m2,baujahr,geschosse,hnf_delta,'
           'marge_chf,gwr_egid,housing_stat_url')


def pd_get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def pd_put(pfad: str, token: str, daten: dict) -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(
        url, data=json.dumps(daten).encode(),
        headers={'Content-Type': 'application/json'}, method='PUT')
    try:
        with urllib.request.urlopen(anfrage, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {'success': False, 'code': e.code}


def sb_get(pfad: str, url: str, key: str) -> list:
    anfrage = urllib.request.Request(
        f'{url}/rest/v1/{pfad}',
        headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(anfrage, timeout=120) as r:
        return json.load(r)


def alle_deals(token: str) -> list:
    raus, start = [], 0
    while True:
        a = pd_get('/deals', token, start=start, limit=500,
                   status='all_not_deleted')
        stueck = a.get('data') or []
        if not stueck:
            break
        raus.extend(stueck)
        weiter = (a.get('additional_data') or {}).get('pagination') or {}
        if not weiter.get('more_items_in_collection'):
            break
        start = weiter.get('next_start', start + 500)
    return raus


def schluessel_adresse(text: str) -> str:
    """Adresse auf das reduzieren, was sich vergleichen lässt.

    Schreibweisen gehen auseinander: "Bahnhofstr. 3" und
    "Bahnhofstrasse 3" meinen dasselbe Haus.
    """
    t = (text or '').lower()
    t = t.replace('strasse', 'str').replace('str.', 'str')
    t = re.sub(r'[^a-z0-9]+', '', t)
    return t


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    sb_url = os.environ.get('URL', '').strip()
    sb_key = os.environ.get('KEY', '').strip()
    if not (token and sb_url and sb_key):
        print('Token oder Datenbankzugang fehlen.')
        sys.exit(1)

    felder = pd_get('/dealFields', token).get('data') or []
    nach_name = {f['name']: f for f in felder if f.get('name')}
    deals = alle_deals(token)
    print(f'# Nachfüllen — {len(deals)} Deals im Konto')
    print()

    # Aus jedem Deal die Angaben ziehen, mit denen sich suchen lässt.
    egrid_feld = (nach_name.get('EGRID') or {}).get('key')
    parz_feld = (nach_name.get('Parzelle') or {}).get('key')

    egrids = {d[egrid_feld] for d in deals
              if egrid_feld and d.get(egrid_feld)}
    print(f'{len(egrids)} Deals tragen bereits eine EGRID.')

    # Nicht die ganze Tabelle lesen: 259'000 Zeilen seitenweise zu holen
    # läuft in das Zeitlimit der Datenbank (belegt: HTTP 500). Gefragt
    # wird stattdessen gezielt nach den Angaben, die in den Deals stehen
    # -- ein paar hundert Werte statt einer Viertelmillion Zeilen.
    nach_egrid: dict[str, dict] = {}
    nach_parzelle: dict[tuple, dict] = {}
    nach_adresse: dict[tuple, dict] = {}

    def in_liste(werte: list[str]) -> str:
        """PostgREST erwartet die Werte in Klammern, mit Anführungszeichen."""
        sauber = [str(w).replace('"', '') for w in werte if w]
        return '(' + ','.join(f'"{w}"' for w in sauber) + ')'

    def hole_stapelweise(spalte: str, werte: list[str]) -> list[dict]:
        raus: list[dict] = []
        einmalig = sorted({w for w in werte if w})
        for i in range(0, len(einmalig), 80):
            stapel = einmalig[i:i + 80]
            try:
                raus.extend(sb_get(
                    f'properties?select={SPALTEN}&{spalte}=in.{in_liste(stapel)}'
                    '&limit=500', sb_url, sb_key))
            except Exception as e:
                print(f'> Abfrage über {spalte} fehlgeschlagen: {type(e).__name__}')
                break
        return raus

    gesuchte_egrids = [d[egrid_feld] for d in deals
                       if egrid_feld and d.get(egrid_feld)]
    for z in hole_stapelweise('egrid', gesuchte_egrids):
        if z.get('egrid'):
            nach_egrid.setdefault(z['egrid'], z)

    gesuchte_parzellen = [d[parz_feld] for d in deals
                          if parz_feld and d.get(parz_feld)]
    for z in hole_stapelweise('parzelle', gesuchte_parzellen):
        if z.get('parzelle') and z.get('gemeinde'):
            nach_parzelle.setdefault((z['parzelle'], z['gemeinde']), z)

    # Für Deals ohne Kennnummern bleibt die Adresse. Sie steht an
    # mehreren Stellen und in verschiedenen Formen -- im Titel, im Namen
    # der Organisation, mit und ohne Ort. Gesucht wird mit allen
    # Schreibweisen, die sich daraus ergeben.
    def kandidaten(d: dict) -> list[str]:
        roh: list[str] = []
        titel = (d.get('title') or '').strip()
        org = d.get('org_id') or {}
        org_name = org.get('name', '') if isinstance(org, dict) else ''
        org_name = re.sub(r'^\s*Liegenschaft:\s*', '', org_name)
        org_name = re.sub(r'\s*\[[^\]]*\]\s*$', '', org_name).strip()

        for text in (titel, org_name):
            if not text:
                continue
            roh.append(text)
            # Ort abtrennen, in beiden gebräuchlichen Schreibweisen.
            for trenner in ('·', ',', ' - '):
                if trenner in text:
                    roh.append(text.split(trenner)[0].strip())
            # Führende Postleitzahl entfernen ("8001 Bahnhofstrasse 3").
            roh.append(re.sub(r'^\d{4}\s+', '', text).strip())
        return [r for r in roh if r]

    alle_kandidaten: list[str] = []
    for d in deals:
        alle_kandidaten.extend(kandidaten(d))

    for z in hole_stapelweise('address', alle_kandidaten):
        if z.get('address') and z.get('gemeinde'):
            nach_adresse.setdefault(
                (schluessel_adresse(z['address']), z['gemeinde']), z)

    # Wenn nichts zusammenfindet, liegt es fast immer an der Schreibweise.
    # Ein Blick auf beide Seiten sagt mehr als jede Vermutung.
    print('### Wie die Adressen aussehen')
    print()
    print('| Aus Pipedrive | In der Datenbank |')
    print('|---|---|')
    beispiele_db = [z.get('address') for z in
                    hole_stapelweise('address', alle_kandidaten[:80])][:8]
    for i in range(8):
        links = alle_kandidaten[i] if i < len(alle_kandidaten) else ''
        rechts = beispiele_db[i] if i < len(beispiele_db) else ''
        print(f'| {links} | {rechts} |')
    print()

    print(f'Gefunden: {len(nach_egrid)} über EGRID, {len(nach_parzelle)} über Parzelle, {len(nach_adresse)} über Adresse.')
    print()

    def finde(d: dict) -> tuple[dict | None, str]:
        if egrid_feld and d.get(egrid_feld):
            t = nach_egrid.get(d[egrid_feld])
            if t:
                return t, 'EGRID'
        gem = (nach_name.get('Gemeinde') or {}).get('key')
        gemeinde = d.get(gem) if gem else None
        if parz_feld and d.get(parz_feld) and gemeinde:
            t = nach_parzelle.get((d[parz_feld], gemeinde))
            if t:
                return t, 'Parzelle'
        # Die Gemeinde steht bei den meisten Deals nicht; dann genügt
        # die Adresse allein, sofern sie im Bestand nur einmal vorkommt.
        nach_strasse: dict[str, list[dict]] = {}
        for (schl, gem), z in nach_adresse.items():
            nach_strasse.setdefault(schl, []).append(z)

        for kandidat in kandidaten(d):
            schl = schluessel_adresse(kandidat)
            if gemeinde:
                t = nach_adresse.get((schl, gemeinde))
                if t:
                    return t, 'Adresse und Gemeinde'
            treffer = nach_strasse.get(schl) or []
            if len(treffer) == 1:
                return treffer[0], 'Adresse'
            if len(treffer) > 1:
                return None, f'mehrdeutig ({len(treffer)}×)'
        return None, '—'

    gefunden = 0
    geaendert = 0
    wege: dict[str, int] = {}
    berichte: list[str] = []

    for d in deals:
        treffer, weg = finde(d)
        if not treffer:
            continue
        gefunden += 1
        wege[weg] = wege.get(weg, 0) + 1

        patch: dict = {}
        for name, spalte in ZUORDNUNG.items():
            f = nach_name.get(name)
            if not f:
                continue
            k = f['key']
            # Nur leere Felder füllen: eine Eingabe von Menschenhand ist
            # mehr wert als ein Wert aus dem Import.
            if d.get(k) not in (None, '', 0):
                continue
            wert = treffer.get(spalte)
            if wert in (None, ''):
                continue
            if name in ('Mehr Wohnfläche m²', 'Grundstück m²'):
                wert = round(float(wert))
            patch[k] = wert

        # Der Wert des Deals ist die Marge -- bisher stand überall null.
        if not d.get('value') and treffer.get('marge_chf'):
            patch['value'] = int(treffer['marge_chf'])
            patch['currency'] = 'CHF'

        if not patch:
            continue
        geaendert += 1
        if args.schreiben:
            a = pd_put(f'/deals/{d["id"]}', token, patch)
            ok = 'ok' if a.get('success') else f'Fehler {a.get("code")}'
        else:
            ok = 'Probelauf'
        if len(berichte) < 40:
            berichte.append(
                f'- {d.get("title")} — {len(patch)} Felder ({weg}, {ok})')

    print(f'{gefunden} von {len(deals)} Deals in der Datenbank gefunden.')
    if wege:
        print()
        print('| Zugeordnet über | Deals |')
        print('|---|---:|')
        for weg, n in sorted(wege.items(), key=lambda x: -x[1]):
            print(f'| {weg} | {n} |')
    print()
    print(f'{geaendert} Deals hätten leere Felder zu füllen.')
    print()
    for z in berichte:
        print(z)
    if geaendert > len(berichte):
        print(f'- … und {geaendert - len(berichte)} weitere')
    print()
    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')


if __name__ == '__main__':
    main()

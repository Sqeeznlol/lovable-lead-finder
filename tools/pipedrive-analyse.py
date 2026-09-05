#!/usr/bin/env python3
"""Liest den Aufbau eines Pipedrive-Kontos aus und fasst ihn zusammen.

Nur lesend. Verändert wird nichts -- die Frage ist, ob die vorhandene
Struktur zum Geschäft passt: Eigentümer finden, anrufen, überzeugen,
kaufen, neu bauen, verkaufen.

Angesehen werden Pipelines und Phasen, Deals und Leads samt Alter und
Verteilung, die eigenen Felder und wie viele davon tatsächlich gefüllt
sind, sowie Personen und Organisationen. Gerade der Füllgrad ist
entscheidend: ein Feld, das bei neunzig Prozent leer bleibt, trägt keine
Entscheidung, sondern täuscht eine vor.

Der Token kommt aus der Umgebung und erscheint nirgends in der Ausgabe.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

BASIS = 'https://api.pipedrive.com/v1'


def hole(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{BASIS}{pfad}?{urllib.parse.urlencode(params)}'
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return json.load(r)
    except Exception as e:
        # Die Fehlermeldung könnte den Token enthalten -- deshalb nur der Typ.
        return {'success': False, 'fehler': type(e).__name__, 'pfad': pfad}


def alle(pfad: str, token: str, grenze: int = 5000, **params) -> list:
    """Blättert durch eine Sammlung, bis nichts mehr kommt."""
    raus: list = []
    start = 0
    while len(raus) < grenze:
        antwort = hole(pfad, token, start=start, limit=500, **params)
        stueck = antwort.get('data') or []
        if not stueck:
            break
        raus.extend(stueck)
        weiter = (antwort.get('additional_data') or {}).get('pagination') or {}
        if not weiter.get('more_items_in_collection'):
            break
        start = weiter.get('next_start', start + 500)
    return raus


def tage_her(zeit: str | None) -> int | None:
    if not zeit:
        return None
    for form in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ'):
        try:
            d = datetime.strptime(zeit, form).replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - d).days
        except ValueError:
            continue
    return None


def abschnitt(titel: str) -> None:
    print()
    print(f'## {titel}')
    print()


def main() -> None:
    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    ich = hole('/users/me', token)
    if not ich.get('success'):
        print('Der Token wurde nicht angenommen.')
        print(f'Antwort: {ich.get("fehler") or ich.get("error") or "unbekannt"}')
        sys.exit(1)

    konto = ich.get('data') or {}
    print(f'# Pipedrive — {konto.get("company_name", "?")}')
    print()
    print(f'Angemeldet als {konto.get("name", "?")}, '
          f'Währung {konto.get("currency", "?")}, '
          f'Zeitzone {konto.get("timezone_name", "?")}.')

    # ---------------------------------------------------------- Pipelines
    pipelines = hole('/pipelines', token).get('data') or []
    stufen = hole('/stages', token).get('data') or []
    deals = alle('/deals', token, status='all_not_deleted')
    leads = alle('/leads', token)

    abschnitt('Pipelines und Phasen')
    if not pipelines:
        print('Keine Pipeline vorhanden.')
    for p in pipelines:
        eigene = [s for s in stufen if s.get('pipeline_id') == p.get('id')]
        d_hier = [d for d in deals if d.get('pipeline_id') == p.get('id')]
        print(f'**{p.get("name")}** — {len(eigene)} Phasen, {len(d_hier)} Deals')
        print()
        print('| Phase | Deals | Summe | ältester |')
        print('|---|---:|---:|---:|')
        for s in sorted(eigene, key=lambda x: x.get('order_nr', 0)):
            hier = [d for d in d_hier if d.get('stage_id') == s.get('id')
                    and d.get('status') == 'open']
            wert = sum(float(d.get('value') or 0) for d in hier)
            alter = [tage_her(d.get('add_time')) for d in hier]
            alter = [a for a in alter if a is not None]
            print(f'| {s.get("name")} | {len(hier)} | '
                  f'{wert:,.0f} | {max(alter) if alter else "—"} Tage |')
        print()

    # ------------------------------------------------------------- Deals
    abschnitt('Deals insgesamt')
    nach_status = Counter(d.get('status') for d in deals)
    print('| Status | Anzahl |')
    print('|---|---:|')
    for status, n in nach_status.most_common():
        print(f'| {status} | {n} |')

    offen = [d for d in deals if d.get('status') == 'open']
    if offen:
        alter = sorted(a for a in (tage_her(d.get('add_time')) for d in offen)
                       if a is not None)
        if alter:
            print()
            print(f'Offene Deals: {len(offen)}, '
                  f'Median-Alter {alter[len(alter) // 2]} Tage, '
                  f'ältester {alter[-1]} Tage.')
            liegen = [a for a in alter if a > 90]
            if liegen:
                print(f'Davon {len(liegen)} seit über 90 Tagen ohne Abschluss.')

    # ------------------------------------------------------------- Leads
    abschnitt('Leads')
    print(f'{len(leads)} Leads im Konto.')
    labels = hole('/leadLabels', token).get('data') or []
    print(f'{len(labels)} Labels vergeben.')
    if len(labels) > 30:
        print()
        print('> So viele Labels lassen sich nicht mehr filtern. Wahrscheinlich')
        print('> wird pro Objekt eines angelegt statt pro Kategorie.')
    if labels:
        print()
        print('Die ersten zwanzig:')
        print()
        for l in labels[:20]:
            print(f'- {l.get("name")}')

    if leads:
        alter = sorted(a for a in (tage_her(l.get('add_time')) for l in leads)
                       if a is not None)
        if alter:
            print()
            print(f'Median-Alter {alter[len(alter) // 2]} Tage, '
                  f'ältester {alter[-1]} Tage.')
        ohne_person = sum(1 for l in leads if not l.get('person_id'))
        print(f'{ohne_person} Leads ohne Person — dort ist niemand anzurufen.')

    # ------------------------------------------------------ Eigene Felder
    abschnitt('Eigene Felder und ihr Füllgrad')
    felder = hole('/dealFields', token).get('data') or []
    eigene = [f for f in felder if f.get('edit_flag')]
    print(f'{len(eigene)} eigene Deal-Felder.')
    print()
    if deals and eigene:
        print('| Feld | gefüllt | von |')
        print('|---|---:|---:|')
        for f in eigene:
            k = f.get('key')
            n = sum(1 for d in deals if d.get(k) not in (None, '', 0))
            print(f'| {f.get("name")} | {n} | {len(deals)} |')

    # ------------------------------------------ Personen, Organisationen
    abschnitt('Personen und Organisationen')
    personen = alle('/persons', token, grenze=3000)
    orgs = alle('/organizations', token, grenze=3000)
    print(f'{len(personen)} Personen, {len(orgs)} Organisationen '
          f'(bis 3000 gezählt).')

    ohne_telefon = sum(1 for p in personen if not p.get('phone')
                       or not any(t.get('value') for t in p.get('phone') or []))
    if personen:
        print(f'{ohne_telefon} Personen ohne Telefonnummer.')

    doppelt = Counter(o.get('name') for o in orgs)
    mehrfach = [(n, c) for n, c in doppelt.items() if c > 1]
    if mehrfach:
        print(f'{len(mehrfach)} Organisationsnamen kommen mehrfach vor.')
        for n, c in sorted(mehrfach, key=lambda x: -x[1])[:10]:
            print(f'- {n} ({c}×)')

    # -------------------------------------------------------- Aktivitäten
    abschnitt('Aktivitäten')
    akt = alle('/activities', token, grenze=2000, user_id=0)
    erledigt = sum(1 for a in akt if a.get('done'))
    print(f'{len(akt)} Aktivitäten, davon {erledigt} erledigt.')
    arten = Counter(a.get('type') for a in akt)
    if arten:
        print()
        print('| Art | Anzahl |')
        print('|---|---:|')
        for art, n in arten.most_common(10):
            print(f'| {art} | {n} |')


if __name__ == '__main__':
    main()

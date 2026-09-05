#!/usr/bin/env python3
"""Legt die neuen Pipelines an und ordnet alle Deals und Leads ein.

Die heutigen Phasen benennen Ergebnisse statt Schritte -- "Nicht
Erreichbar", "Nicht INTERESSIERT", "LW ZONE". Ein Deal in "Nicht
erreichbar" wird nie geschlossen, er sitzt dort für immer; deshalb
liegen alle 259 offenen Deals im Mittel seit 458 Tagen still.

Der neue Aufbau trennt zwei Rhythmen:

    Akquise   Neu · Anrufen · Gespräch · Unterlagen
    Post      Brief senden · Brief versandt
    Extern    Studer · Tim

Wohin ein Deal kommt, entscheidet nicht seine alte Phase allein, sondern
was tatsächlich passiert ist. Ob jemand angerufen wurde, steht in den
Aktivitäten -- ein Deal ohne einen einzigen Anruf gehört nach "Neu",
gleich wie seine alte Phase heisst.

Was ein Ergebnis benennt, wird geschlossen statt verschoben: "Nicht
interessiert" ist ein Verlust mit Grund, keine Phase.

Ohne --schreiben verändert der Lauf nichts.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter

PIPEDRIVE = 'https://api.pipedrive.com/v1'

# name, Faulzeit in Tagen
AKQUISE = [('Neu', 14), ('Anrufen', 10), ('Gespräch', 14), ('Unterlagen', 21)]
POST = [('Brief senden', 3), ('Brief versandt', 21)]
# Übergaben an Dritte sind kein Schritt des eigenen Prozesses. Sie gehören
# nicht in die Akquise, sonst verdecken sie dort die eigene Arbeit -- und
# eine Faulzeit wäre sinnlos, weil die Zeit bei jemand anderem läuft.
EXTERN = [('Studer', 0), ('Tim', 0)]

# Alte Phase (Suchmuster, klein) -> was daraus wird.
# ('phase', 'Pipeline', 'Phase')  oder  ('verloren', 'Grund')
#
# Die Reihenfolge entscheidet: "Unterlagen Verschickt" enthält beide
# Wörter und gehört zu den Unterlagen, nicht zur Post. Kurze Namen wie
# "tim" stehen mit Wortgrenze, damit sie nicht in längeren Wörtern
# anschlagen.
REGELN: list[tuple[str, tuple]] = [
    (r'studer', ('phase', 'Extern', 'Studer')),
    (r'\btim\b', ('phase', 'Extern', 'Tim')),
    (r'nicht interessiert', ('verloren', 'Nicht interessiert')),
    (r'kein interesse', ('verloren', 'Nicht interessiert')),
    (r'lw zone', ('verloren', 'Falsche Zone')),
    (r'landwirtschaft', ('verloren', 'Falsche Zone')),
    (r'verkauft', ('verloren', 'Bereits verkauft')),
    (r'unterlagen', ('phase', 'Akquise', 'Unterlagen')),
    (r'verschick', ('phase', 'Post', 'Brief senden')),
    (r'brief', ('phase', 'Post', 'Brief senden')),
    (r'gespr(ä|ae)ch', ('phase', 'Akquise', 'Gespräch')),
    (r'termin', ('phase', 'Akquise', 'Gespräch')),
    # "Nicht Erriecht" steht so im Konto -- Tippfehler, gemeint ist
    # dasselbe wie "Nicht Erreichbar".
    (r'nicht erreich|nicht erriech', ('phase', 'Akquise', 'Anrufen')),
    (r'anderer zeitpunkt', ('phase', 'Akquise', 'Anrufen')),
    (r'prio', ('phase', 'Akquise', 'Anrufen')),
]


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


def regel_fuer(phase: str) -> tuple | None:
    p = (phase or '').lower()
    for muster, ziel in REGELN:
        if re.search(muster, p):
            return ziel
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--schreiben', action='store_true')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token in der Umgebung.')
        sys.exit(1)

    pipelines = get('/pipelines', token).get('data') or []
    stufen = get('/stages', token).get('data') or []
    deals = alle('/deals', token, status='all_not_deleted')
    leads = alle('/leads', token)
    aktivitaeten = alle('/activities', token, user_id=0)

    print(f'# Umzug — {len(deals)} Deals, {len(leads)} Leads')
    print()

    # Wer wurde schon angerufen? Das steht in den Aktivitäten, nicht in
    # der Phase.
    anrufe: Counter = Counter()
    for a in aktivitaeten:
        if a.get('deal_id') and a.get('type') == 'call' and a.get('done'):
            anrufe[a['deal_id']] += 1

    name_pipeline = {p['name']: p for p in pipelines}
    def stufe(pipeline: str, phase: str) -> dict | None:
        p_obj = name_pipeline.get(pipeline)
        if not p_obj:
            return None
        return next((s for s in stufen
                     if s.get('pipeline_id') == p_obj['id']
                     and s.get('name') == phase), None)

    # ------------------------------------------------------- Anlegen
    print('## Pipelines und Phasen')
    print()
    anzulegen: list[str] = []
    for pl, phasen in (('Akquise', AKQUISE), ('Post', POST), ('Extern', EXTERN)):
        if pl not in name_pipeline:
            anzulegen.append(f'Pipeline "{pl}"')
        for phase, tage in phasen:
            if not stufe(pl, phase):
                anzulegen.append(f'  Phase "{pl} → {phase}" (Faulzeit {tage} Tage)')
    if anzulegen:
        for z in anzulegen:
            print(f'- {z}')
    else:
        print('Alles bereits vorhanden.')
    print()

    if args.schreiben:
        for pl, phasen in (('Akquise', AKQUISE), ('Post', POST), ('Extern', EXTERN)):
            if pl not in name_pipeline:
                a = sende('/pipelines', token, {'name': pl}, 'POST')
                if a.get('success'):
                    name_pipeline[pl] = a['data']
                    pipelines.append(a['data'])
            p_obj = name_pipeline.get(pl)
            if not p_obj:
                continue
            for i, (phase, tage) in enumerate(phasen):
                if stufe(pl, phase):
                    continue
                daten = {
                    'name': phase,
                    'pipeline_id': p_obj['id'],
                    'order_nr': i + 1,
                }
                # Faulzeit null heisst: hier läuft die Zeit bei jemand
                # anderem, ein rotes Kärtchen wäre nur Lärm.
                if tage:
                    daten['rotten_flag'] = True
                    daten['rotten_days'] = tage
                a = sende('/stages', token, daten, 'POST')
                if a.get('success'):
                    stufen.append(a['data'])

    # ------------------------------------------------------ Zuordnen
    alte_phase = {s['id']: s.get('name', '') for s in stufen}
    offen = [d for d in deals if d.get('status') == 'open']

    zuordnung: Counter = Counter()
    plan: list[tuple[dict, tuple]] = []
    unklar: Counter = Counter()

    for d in offen:
        phase = alte_phase.get(d.get('stage_id'), '')
        ziel = regel_fuer(phase)

        if ziel is None:
            # Phasen wie "Affoltern" benennen einen Ort, keinen Zustand.
            # Aus dem Namen ist nichts zu holen -- also entscheidet, was
            # tatsächlich geschehen ist: wer angerufen wurde, kommt nach
            # "Anrufen", wer nicht, nach "Neu". Falsch liegen kann das
            # kaum, und liegen bleiben soll nichts.
            unklar[phase or '(ohne Phase)'] += 1
            ziel = ('phase', 'Akquise', 'Anrufen')

        # Wer nie angerufen wurde, gehört nach "Neu" -- unabhängig davon,
        # wie seine alte Phase hiess.
        if ziel[0] == 'phase' and ziel[1] == 'Akquise' and ziel[2] == 'Anrufen':
            if anrufe.get(d['id'], 0) == 0:
                ziel = ('phase', 'Akquise', 'Neu')

        beschriftung = (f'{ziel[1]} → {ziel[2]}' if ziel[0] == 'phase'
                        else f'verloren: {ziel[1]}')
        zuordnung[f'{phase or "(ohne Phase)"}  ⟶  {beschriftung}'] += 1
        plan.append((d, ziel))

    print(f'## Zuordnung — {len(offen)} offene Deals')
    print()
    print('| Von | Nach | Deals |')
    print('|---|---|---:|')
    for text, n in sorted(zuordnung.items(), key=lambda x: -x[1]):
        von, nach = text.split('  ⟶  ')
        print(f'| {von} | {nach} | {n} |')
    print()

    if unklar:
        print('## Ohne Regel — nach Aktivität eingeordnet')
        print()
        print('Diese Phasen benennen keinen Zustand, sondern einen Ort')
        print('oder eine Sammlung. Aus dem Namen ist nichts zu holen, also')
        print('entscheidet, was tatsächlich geschehen ist: wer angerufen')
        print('wurde, kommt nach "Anrufen", wer nicht, nach "Neu".')
        print()
        print('| Phase | Deals |')
        print('|---|---:|')
        for phase, n in unklar.most_common():
            print(f'| {phase} | {n} |')
        print()

    print(f'## Leads — {len(leads)}')
    print()
    print('Leads haben keine Phasen und keinen Wert; für einen Bestand,')
    print('der vor dem Anlegen schon durchgerechnet ist, sind sie der')
    print('falsche Ort. Sie werden als Deal in "Akquise → Neu" angelegt')
    print('und der Lead danach archiviert.')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wurde nichts verändert.')
        return

    # --------------------------------------------------------- Umzug
    print('## Änderungen')
    print()
    verschoben = verloren = fehler = 0
    for d, ziel in plan:
        if ziel[0] == 'verloren':
            a = sende(f'/deals/{d["id"]}', token,
                      {'status': 'lost', 'lost_reason': ziel[1]}, 'PUT')
            if a.get('success'):
                verloren += 1
            else:
                fehler += 1
            continue
        s = stufe(ziel[1], ziel[2])
        if not s:
            fehler += 1
            continue
        a = sende(f'/deals/{d["id"]}', token,
                  {'stage_id': s['id'], 'pipeline_id': s['pipeline_id']}, 'PUT')
        if a.get('success'):
            verschoben += 1
        else:
            fehler += 1

    print(f'- {verschoben} Deals verschoben')
    print(f'- {verloren} Deals mit Grund geschlossen')
    if fehler:
        print(f'- {fehler} fehlgeschlagen')

    neu_stufe = stufe('Akquise', 'Neu')
    aus_leads = 0
    for l in leads:
        if not neu_stufe:
            break
        daten = {
            'title': l.get('title') or 'Ohne Titel',
            'stage_id': neu_stufe['id'],
            'pipeline_id': neu_stufe['pipeline_id'],
        }
        for feld in ('person_id', 'organization_id'):
            if l.get(feld):
                daten['person_id' if feld == 'person_id' else 'org_id'] = l[feld]
        a = sende('/deals', token, daten, 'POST')
        if a.get('success'):
            aus_leads += 1
            sende(f'/leads/{l["id"]}', token, {'is_archived': True}, 'PATCH')
    print(f'- {aus_leads} Leads zu Deals gemacht und archiviert')


if __name__ == '__main__':
    main()

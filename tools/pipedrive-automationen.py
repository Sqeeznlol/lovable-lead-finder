#!/usr/bin/env python3
"""Die vier Regeln, die verhindern, dass Deals liegen bleiben.

Im Konto stehen 227 offene Deals, das mittlere Alter ist 348 Tage, und
193 davon haben seit ueber 90 Tagen keine Bewegung mehr. Das Problem
sind nicht zu wenige Leads, sondern Deals, die niemand mehr anfasst.

Dagegen vier Regeln:

  1. Kein Deal ohne naechsten Schritt -- kommt er nach "Anrufen",
     entsteht eine Anruf-Aufgabe fuer morgen.
  2. Anruf erledigt, Deal steht immer noch in "Anrufen" -- neue Aufgabe
     in drei Tagen.
  3. Dreissig Tage ohne Bewegung -- Kennzeichen "liegt zu lange", damit
     man es sieht statt es zu zaehlen.
  4. Kommt in "Search" eine Telefonnummer dazu, gehoert der Deal nach
     Akquise: dort wird angerufen.

Ob Pipedrive das ueber die Schnittstelle anlegen laesst, haengt am
Tarif. Deshalb fragt dieser Lauf zuerst und sagt, was er vorgefunden
hat -- geraten wird nicht.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PIPEDRIVE = 'https://api.pipedrive.com'


def hole(pfad: str, token: str) -> tuple[int, dict]:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        # Die Adresse enthaelt den Token -- deshalb nur der Code.
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}


def main() -> None:
    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    if not token:
        print('Kein Token.')
        sys.exit(1)

    print('# Automationen — was die Schnittstelle hergibt')
    print()

    wege = [
        '/v1/automations',
        '/api/v2/automations',
        '/v1/workflows',
    ]
    gefunden = None
    for weg in wege:
        code, antwort = hole(weg, token)
        anzahl = len(antwort.get('data') or []) if isinstance(antwort, dict) else 0
        hinweis = (antwort.get('error') or '') if isinstance(antwort, dict) else ''
        print(f'- `{weg}` → HTTP {code}'
              + (f', {anzahl} Eintraege' if code == 200 else '')
              + (f' — {hinweis}' if hinweis else ''))
        if code == 200 and gefunden is None:
            gefunden = (weg, antwort)

    print()
    if not gefunden:
        print('Die Schnittstelle gibt die Automationen nicht her.')
        print('Das ist eine Tarifsache, kein Fehler: sie lassen sich dann')
        print('nur in Pipedrive selbst anlegen (Zahnrad → Automationen).')
        return

    weg, antwort = gefunden
    print(f'Erreichbar unter `{weg}`. Vorhandene Regeln:')
    print()
    for a in (antwort.get('data') or [])[:20]:
        print(f"- {a.get('id')} `{a.get('name')}` — "
              f"{'aktiv' if a.get('is_active') else 'aus'}")
    if not (antwort.get('data') or []):
        print('- (keine)')


if __name__ == '__main__':
    main()

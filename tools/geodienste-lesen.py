#!/usr/bin/env python3
"""Zeigt, welche Geodatensätze ein Kanton über geodienste.ch herausgibt.

geodienste.ch ist die gemeinsame Plattform der Kantone. Das Verzeichnis
nennt je Kanton und Datensatz, ob der Bezug frei ist ("freier Zugang"),
eine Registrierung verlangt oder gar nicht angeboten wird. Für den
Aufbau eines zweiten Kantons ist das die erste Frage: Parzellen aus der
amtlichen Vermessung und Zonen aus der Nutzungsplanung.

Liest die JSON-Antwort auf der Standardeingabe, erwartet das
Kantonskürzel als Argument.
"""
import json
import sys


def main() -> None:
    kanton = (sys.argv[1] if len(sys.argv) > 1 else 'TG').upper()
    daten = json.load(sys.stdin)

    dienste = daten.get('services', daten if isinstance(daten, list) else [])
    treffer = []
    for d in dienste:
        if not isinstance(d, dict):
            continue
        # Je nach Fassung heisst das Feld anders; beide Wege prüfen.
        kantone = d.get('publication_data') or d.get('cantons') or []
        for eintrag in kantone if isinstance(kantone, list) else []:
            if not isinstance(eintrag, dict):
                continue
            if str(eintrag.get('canton', '')).upper() == kanton:
                treffer.append((d.get('topic_title') or d.get('topic') or '?',
                                eintrag.get('publication_status', '?'),
                                eintrag.get('download_url') or ''))

    print(f'### geodienste.ch — Datensätze für {kanton}')
    print()
    if not treffer:
        print('Keine Einträge gefunden — die Struktur der Antwort hat sich')
        print('geändert oder der Kanton ist nicht aufgeführt.')
        return

    print('| Datensatz | Status | Bezug |')
    print('|---|---|---|')
    for titel, status, url in sorted(treffer):
        print(f'| {titel} | {status} | {url or "—"} |')


if __name__ == '__main__':
    main()

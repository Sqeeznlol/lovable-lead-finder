#!/usr/bin/env python3
"""Zählt, welche Zonenbezeichnungen im kaufbaren Bestand vorkommen.

Die Ausschlussregeln arbeiten mit den Wortlauten der Gemeinden, und jede
Gemeinde schreibt anders -- "Zone für öffentliche Bauten", "OeB", "Zone
OE". Diese Auswertung zeigt, was tatsächlich als kaufbar durchkommt, und
ist damit die Grundlage, um die Regeln zu ergänzen statt zu raten.

Liest die JSON-Antwort von PostgREST auf der Standardeingabe.
"""
import collections
import json
import re
import sys


def ohne_klammer(zone: str) -> str:
    # Der Klammerzusatz nennt die Fläche dieser einen Parzelle und macht
    # sonst jede Zeile einzigartig.
    return re.sub(r'\([^)]*\)', '', zone).strip()


def tabelle(titel: str, zaehler: collections.Counter, anzahl: int) -> None:
    print(f'### {titel}')
    print()
    print('| Zone | Anzahl |')
    print('|---|---:|')
    for name, n in zaehler.most_common(anzahl):
        print(f'| {name} | {n} |')
    print()


def main() -> None:
    zeilen = json.load(sys.stdin)
    alle = collections.Counter(ohne_klammer(z['zone']) for z in zeilen if z.get('zone'))
    tabelle(f'Zonen im kaufbaren Bestand ({len(zeilen)} Zeilen Stichprobe)', alle, 60)

    winterthur = collections.Counter(
        ohne_klammer(z['zone'])
        for z in zeilen
        if z.get('zone') and 'Winterthur' in (z.get('gemeinde') or '')
    )
    tabelle('Davon in Winterthur', winterthur, 30)


if __name__ == '__main__':
    main()

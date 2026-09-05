#!/usr/bin/env python3
"""Zählt, welche Zonenbezeichnungen im kaufbaren Bestand vorkommen.

Die Ausschlussregeln arbeiten mit den Wortlauten der Gemeinden, und jede
Gemeinde schreibt anders -- "Zone für öffentliche Bauten", "OeB", "Zone
OE". Diese Auswertung zeigt, was tatsächlich als kaufbar durchkommt, und
ist damit die Grundlage, um die Regeln zu ergänzen statt zu raten.

Liest auf der Standardeingabe mehrere JSON-Antworten von PostgREST,
eine je Zeile oder als zusammenhängender Text -- PostgREST gibt höchstens
1000 Zeilen je Abfrage zurück, weshalb mehrere Seiten geholt werden.
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


def einlesen(text: str) -> list:
    """Mehrere aneinandergehängte JSON-Listen zu einer Liste verbinden."""
    zeilen: list = []
    dekoder = json.JSONDecoder()
    pos = 0
    while pos < len(text):
        while pos < len(text) and text[pos] in ' \t\r\n':
            pos += 1
        if pos >= len(text):
            break
        teil, pos = dekoder.raw_decode(text, pos)
        if isinstance(teil, list):
            zeilen.extend(teil)
    return zeilen


def main() -> None:
    zeilen = einlesen(sys.stdin.read())
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

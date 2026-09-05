#!/usr/bin/env python3
"""Gibt den vollständigen Katalogeintrag eines Themas von geodienste.ch aus.

Die Adressen der Dienste stehen im Katalog. Sie zu raten hat mehrere
Läufe gekostet -- Amtliche Vermessung antwortet unter /db/av_0/deu, die
Nutzungsplanung unter keiner der naheliegenden Varianten. Der Eintrag
selbst nennt sie.

Liest services.json auf der Standardeingabe, erwartet einen Suchbegriff
für den Themennamen als Argument.
"""
import json
import sys


def main() -> None:
    suche = (sys.argv[1] if len(sys.argv) > 1 else 'Nutzungsplanung').lower()
    daten = json.load(sys.stdin)
    themen = daten.get('services', daten if isinstance(daten, list) else [])

    for t in themen:
        if not isinstance(t, dict):
            continue
        titel = str(t.get('topic_title') or t.get('topic') or '')
        if suche not in titel.lower():
            continue

        print(f'### {titel}')
        print()
        print('```')
        # Der Abstract ist lang und hier ohne Wert.
        knapp = {k: v for k, v in t.items()
                 if k not in ('abstract', 'keywords', 'keywords_geocat', 'keywords_gemet')}
        text = json.dumps(knapp, ensure_ascii=False, indent=2)
        print(text[:4000])
        print('```')
        print()
        return

    print(f'Kein Thema gefunden, das "{suche}" enthält.')
    print()
    print('Vorhandene Themen:')
    for t in themen[:80]:
        if isinstance(t, dict):
            print('-', t.get('topic_title') or t.get('topic'))


if __name__ == '__main__':
    main()

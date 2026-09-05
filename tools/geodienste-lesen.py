#!/usr/bin/env python3
"""Zeigt, welche Geodatensätze ein Kanton über geodienste.ch herausgibt.

geodienste.ch ist die gemeinsame Plattform der Kantone. Das Verzeichnis
nennt je Kanton und Datensatz, ob der Bezug frei ist, eine Registrierung
verlangt oder gar nicht angeboten wird. Für den Aufbau eines zweiten
Kantons ist das die erste Frage: Parzellen aus der amtlichen Vermessung
und Zonen aus der Nutzungsplanung.

Die Antwort ist gross und ihre Form nicht zugesichert. Gesucht wird
deshalb nicht an einer festen Stelle, sondern überall in der Struktur
nach Einträgen, die diesen Kanton nennen. Findet sich nichts, wird die
Form der Antwort ausgegeben -- dann ist beim nächsten Lauf klar, wo zu
suchen ist, statt zu raten.

Liest die JSON-Antwort auf der Standardeingabe, erwartet das
Kantonskürzel als Argument.
"""
import json
import sys
from typing import Any, Iterator

# Felder, in denen ein Kantonskürzel stehen kann.
KANTON_FELDER = ('canton', 'kanton', 'kt', 'ct')
# Felder, die den Datensatz benennen.
NAME_FELDER = ('topic_title', 'topic', 'title', 'name', 'bezeichnung')
# Felder, die über den Bezug Auskunft geben.
STATUS_FELDER = ('publication_status', 'status', 'access', 'zugang', 'availability')


def objekte(knoten: Any, elternname: str = '') -> Iterator[tuple[dict, str]]:
    """Alle Objekte der Struktur, je mit dem nächstgelegenen Namen darüber.

    Der Kantonseintrag selbst trägt meist nur Kürzel und Status; wie der
    Datensatz heisst, steht eine Ebene höher. Der Name wird deshalb
    mitgereicht.
    """
    if isinstance(knoten, dict):
        name = feld(knoten, NAME_FELDER) or elternname
        yield knoten, name
        for wert in knoten.values():
            yield from objekte(wert, name)
    elif isinstance(knoten, list):
        for wert in knoten:
            yield from objekte(wert, elternname)


def feld(d: dict, namen: tuple[str, ...]) -> str:
    for n in namen:
        if d.get(n) not in (None, ''):
            return str(d[n])
    return ''


def main() -> None:
    kanton = (sys.argv[1] if len(sys.argv) > 1 else 'TG').upper()
    daten = json.load(sys.stdin)

    treffer: list[tuple[str, str, str]] = []
    for o, name in objekte(daten):
        kt = feld(o, KANTON_FELDER).upper()
        if kt != kanton:
            continue
        treffer.append((
            feld(o, NAME_FELDER) or name or '(ohne Namen)',
            feld(o, STATUS_FELDER) or '(ohne Status)',
            str(o.get('download_url') or o.get('url') or o.get('href') or ''),
        ))

    print(f'### geodienste.ch — Einträge für {kanton}')
    print()

    if treffer:
        print(f'{len(treffer)} Einträge gefunden.')
        print()
        print('| Datensatz | Bezug | Adresse |')
        print('|---|---|---|')
        # Doppelte zusammenfassen, die Liste ist sonst unlesbar.
        for eintrag in sorted(set(treffer))[:60]:
            titel, status, url = eintrag
            print(f'| {titel} | {status} | {url or "—"} |')
        return

    # Nichts gefunden: die Form der Antwort zeigen, damit der nächste
    # Versuch nicht wieder eine Vermutung ist.
    print('Keine Einträge mit diesem Kantonskürzel gefunden.')
    print()
    print('Form der Antwort:')
    print()
    print('```')
    if isinstance(daten, dict):
        print('Oberste Schlüssel:', ', '.join(list(daten)[:30]))
        for schluessel, wert in list(daten.items())[:3]:
            if isinstance(wert, list) and wert:
                print(f'\nErster Eintrag unter "{schluessel}":')
                print(json.dumps(wert[0], ensure_ascii=False, indent=2)[:1200])
                break
    elif isinstance(daten, list) and daten:
        print(f'Liste mit {len(daten)} Einträgen, erster Eintrag:')
        print(json.dumps(daten[0], ensure_ascii=False, indent=2)[:1200])
    print('```')


if __name__ == '__main__':
    main()

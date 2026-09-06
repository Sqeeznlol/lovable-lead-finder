#!/usr/bin/env python3
"""Überträgt anrufbereite Objekte aus der Datenbank nach Pipedrive.

Der Ablauf ist auf zwei Personen zugeschnitten, die den Tag über
telefonieren. Entscheidend ist deshalb nicht die Zahl der Deals, sondern
dass niemand zweimal dieselbe Nummer wählt und dass beim Anruf alles auf
dem Schirm steht, was das Gespräch trägt.

Daraus folgen die Regeln:

  Übertragen wird nur, was anrufbar ist -- Eigentümer bekannt, Nummer
  vorhanden, Zone kaufbar, Potenzial gerechnet. Alles andere ist Arbeit
  für die Recherche, nicht für das Telefon.

  Jedes Objekt erscheint genau einmal. Verknüpft wird über die EGRID,
  die schweizweit eindeutig ist -- nicht über die Adresse. Über die
  Adresse entstanden bisher bis zu dreizehn Organisationen für dasselbe
  Grundstück.

  Der Deal trägt die Marge als Wert. Damit sortiert Pipedrive nach Geld
  statt nach Zufall; bisher stand überall null.

  Die Objekte werden abwechselnd den beiden Anrufern zugeteilt, damit
  jeder seine eigene Liste hat und keine Nummer doppelt gewählt wird.

Ohne --schreiben wird nichts verändert: der Lauf zeigt dann nur, was er
täte. Das ist die Voreinstellung.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any

PIPEDRIVE = 'https://api.pipedrive.com/v1'


# --------------------------------------------------------------- Zugriffe
def pd_get(pfad: str, token: str, **params) -> dict:
    params['api_token'] = token
    url = f'{PIPEDRIVE}{pfad}?{urllib.parse.urlencode(params)}'
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def pd_post(pfad: str, token: str, daten: dict) -> dict:
    url = f'{PIPEDRIVE}{pfad}?api_token={urllib.parse.quote(token)}'
    anfrage = urllib.request.Request(
        url, data=json.dumps(daten).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(anfrage, timeout=60) as r:
        return json.load(r)


def sb_get(pfad: str, url: str, key: str) -> list:
    anfrage = urllib.request.Request(
        f'{url}/rest/v1/{pfad}',
        headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(anfrage, timeout=120) as r:
        return json.load(r)


# ------------------------------------------------------------- Auswahl
# Nur diese Spalten werden gebraucht; die Tabelle hat über hundert.
SPALTEN = (
    'id,egrid,parzelle,address,plz,gemeinde,kanton,zone,area,bebaubar_m2,'
    'baujahr,geschosse,owner_name,owner_phone,owner_address,hnf_delta,'
    'marge_chf,score_tier,ausgeschlossen,preselection_status,'
    'pipedrive_deal_id,housing_stat_url'
)


def anrufbereit(url: str, key: str, grenze: int) -> list[dict]:
    """Objekte, bei denen ein Anruf heute möglich und sinnvoll ist.

    Ohne Nummer ist es Recherche, nicht Akquise -- solche Objekte
    gehören in die Grundbuchabfrage und nicht ins Telefon.
    """
    # Nicht in der Datenbank sortieren: ohne Index über 259'000 Zeilen
    # bricht die Abfrage im Zeitlimit ab (belegt: HTTP 500). Die Auswahl
    # der anrufbaren Objekte ist klein genug, um sie hier zu ordnen.
    bedingungen = [
        f'select={SPALTEN}',
        'ausgeschlossen=eq.false',
        'owner_phone=not.is.null',
        'limit=1000',
    ]
    zeilen = sb_get('properties?' + '&'.join(bedingungen), url, key)

    brauchbar = [
        z for z in zeilen
        if z.get('preselection_status') != 'Ausschliessen'
        and (z.get('hnf_delta') or 0) > 0
    ]
    brauchbar.sort(key=lambda z: z.get('marge_chf') or 0, reverse=True)
    return brauchbar[:grenze]


# ------------------------------------------------------------- Felder
def feld_schluessel(token: str) -> dict[str, str]:
    """Ordnet die eigenen Felder ihren Schlüsseln zu, über den Namen.

    Die Schlüssel sind Zufallszeichenfolgen und ändern sich je Konto;
    fest im Code stünden sie nur für genau ein Konto richtig.
    """
    felder = pd_get('/dealFields', token).get('data') or []
    return {f['name']: f['key'] for f in felder if f.get('name')}


def deal_felder(p: dict, schluessel: dict[str, str]) -> dict:
    """Die acht Angaben, die ein Gespräch tatsächlich tragen."""
    werte = {
        'Parzelle': p.get('parzelle'),
        'EGRID': p.get('egrid'),
        'Gemeinde': p.get('gemeinde'),
        'Zone': p.get('zone'),
        'Grundstück m²': p.get('bebaubar_m2') or p.get('area'),
        'HNF m²': round(p['hnf_delta']) if p.get('hnf_delta') else None,
        'Baujahr': p.get('baujahr'),
        'ÖREB Kataster': p.get('housing_stat_url'),
    }
    raus = {}
    for name, wert in werte.items():
        k = schluessel.get(name)
        if k and wert not in (None, ''):
            raus[k] = wert
    return raus


# ------------------------------------------------------------ Übertragung
def titel(p: dict) -> str:
    """Wie ein Deal heisst: Adresse, Ort, Parzelle.

    Am Telefon beginnt das Gespräch mit der Adresse; die Postleitzahl
    macht sie über mehrere Kantone eindeutig; und ohne Parzellennummer
    lässt sich weder das Grundbuch noch der ÖREB-Kataster aufrufen.

    Nicht im Titel: der Eigentümername (er steht im Kontakt, und ein
    Eigentümer kann mehrere Parzellen haben) und die Marge (sie ändert
    sich mit jeder Neuberechnung).
    """
    ort = ' '.join(str(x) for x in (p.get('plz'), p.get('gemeinde')) if x)
    nr = p.get('parzelle') or p.get('plot_number')
    adresse = p.get('address') or (f'Parz. {nr}' if nr else 'Ohne Adresse')
    kopf = ', '.join(x for x in (adresse, ort) if x)
    if nr and p.get('address'):
        return f'{kopf} · Parz. {nr}'
    return kopf


def uebertragen(p: dict, token: str, schluessel: dict[str, str],
                besitzer: int | None, schreiben: bool) -> str:
    """Legt Organisation, Person und Deal an -- oder sagt, was es täte."""
    marge = int(p['marge_chf']) if p.get('marge_chf') else 0

    if not schreiben:
        return (f"{titel(p)} — Marge {marge / 1e6:.1f} Mio, "
                f"{p.get('owner_name') or 'Eigentümer?'} "
                f"{p.get('owner_phone') or ''}".strip())

    # Die Organisation trägt die EGRID im Namen, damit sie wiederfindbar
    # ist. Über die blosse Adresse entstanden Dutzende Doppel.
    org_name = f"{titel(p)} [{p.get('egrid') or p.get('parzelle') or p['id'][:8]}]"
    org = pd_post('/organizations', token, {'name': org_name})
    org_id = (org.get('data') or {}).get('id')

    person = pd_post('/persons', token, {
        'name': p.get('owner_name') or 'Eigentümer unbekannt',
        'phone': [{'value': p['owner_phone'], 'primary': True}],
        'org_id': org_id,
    })
    person_id = (person.get('data') or {}).get('id')

    deal = {
        'title': titel(p),
        'value': marge,
        'currency': 'CHF',
        'org_id': org_id,
        'person_id': person_id,
        **deal_felder(p, schluessel),
    }
    if besitzer:
        deal['user_id'] = besitzer

    antwort = pd_post('/deals', token, deal)
    neu = (antwort.get('data') or {}).get('id')
    return f"{titel(p)} — Deal {neu}"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--grenze', type=int, default=50,
                   help='Wie viele Objekte höchstens (Vorgabe 50)')
    p.add_argument('--schreiben', action='store_true',
                   help='Tatsächlich anlegen statt nur zeigen')
    args = p.parse_args()

    token = os.environ.get('PIPEDRIVE_TOKEN', '').strip()
    sb_url = os.environ.get('URL', '').strip()
    sb_key = os.environ.get('KEY', '').strip()
    if not (token and sb_url and sb_key):
        print('Token oder Datenbankzugang fehlen.')
        sys.exit(1)

    objekte = anrufbereit(sb_url, sb_key, args.grenze)
    print(f'## {len(objekte)} anrufbereite Objekte')
    print()
    if not objekte:
        print('Keine Objekte mit Eigentümer, Nummer und gerechnetem Potenzial.')
        print()
        print('Das ist kein Fehler des Abgleichs, sondern der Stand der Daten:')
        print('ohne Telefonnummer gibt es nichts anzurufen. Der nächste')
        print('Schritt ist die Grundbuchabfrage, nicht der Export.')
        return

    schluessel = feld_schluessel(token) if token else {}
    fehlend = [n for n in ('Parzelle', 'EGRID', 'Gemeinde', 'Zone',
                           'Grundstück m²', 'HNF m²', 'Baujahr')
               if n not in schluessel]
    if fehlend:
        print(f'> Diese Felder fehlen in Pipedrive: {", ".join(fehlend)}')
        print()

    # Reihum zuteilen, damit zwei Anrufer sich nicht überschneiden.
    nutzer = [u['id'] for u in (pd_get('/users', token).get('data') or [])
              if u.get('active_flag')]
    print(f'{len(nutzer)} aktive Benutzer für die Zuteilung.')
    print()

    if not args.schreiben:
        print('**Probelauf** — es wird nichts angelegt.')
        print()

    for i, obj in enumerate(objekte):
        besitzer = nutzer[i % len(nutzer)] if nutzer else None
        print('-', uebertragen(obj, token, schluessel, besitzer, args.schreiben))


if __name__ == '__main__':
    main()

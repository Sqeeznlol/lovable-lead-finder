# Bereitet das Gebäude- und Wohnungsregister (GWR) eines Kantons für
# die Datenbank auf -- auf dem Runner statt in der Datenbank, weil dort
# der Platz knapp ist (1107 MB = nur-lesen). Ein Zwischenlager mit dem
# ganzen Register, wie beim Thurgau, passt neben 206'594 neuen
# Zürcher Parzellen nicht mehr hinein.
#
# Eingabe: das entpackte Register von public.madd.bfs.admin.ch/<kt>.zip
# (Tabulator, Kopfzeile; Spalten wie im Ablauf "Kanton laden"
# nachgesehen: EGID, EGRID, GGDENR, GGDENAME, GSTAT, GKAT, GBAUJ, GASTW,
# GANZWHG, GAREA; Eingänge: EGID, EDID, STRNAME, DEINR, DPLZ4).
#
# Ausgabe:
#   egid.csv     egid, egrid           -- jedes Gebäude mit Parzelle
#   parzelle.csv egrid und je Parzelle zusammengefasst:
#     Adresse, PLZ und Baujahr des grössten Hauses (danach sucht man
#     die Liegenschaft), höchste Geschosszahl, Wohnungen und
#     Grundfläche aufsummiert, Anzahl Gebäude, Objektart, Zustand.
#
# Gezählt werden nur bestehende Gebäude und solche im Bau. Ein
# abgebrochenes Haus mit Baujahr 1890 würde sonst das Baujahr einer
# heute leeren Parzelle bestimmen.
#
# Aufruf: python3 gwr_zh.py <ordner> <egid.csv> <parzelle.csv>
import csv, os, sys
from collections import defaultdict

ZAEHLT = {'1003', '1004'}   # im Bau, bestehend


def lesen(pfad):
    with open(pfad, newline='', encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t')
        kopf = [k.strip().lower() for k in next(r)]
        for z in r:
            yield dict(zip(kopf, z))


def zahl(s, art=float):
    try:
        return art(s) if s not in ('', None) else None
    except ValueError:
        return None


def objektart(gkat, wohnungen, kodes):
    # Die Wörter so, dass die Filter der Vorauswahl greifen
    # ("einfamilien", "mehrfamilien", "wohngebäude mit", "ohne wohn").
    if gkat in ('1010', '1020'):
        if wohnungen == 1:
            return 'Einfamilienhaus'
        if wohnungen and wohnungen >= 2:
            return 'Mehrfamilienhaus'
    return kodes.get(('GKAT', gkat))


def main():
    ordner, ziel_egid, ziel_parz = sys.argv[1:4]
    datei = lambda name: os.path.join(ordner, name)

    kodes = {}
    for k in lesen(datei('kodes_codes_codici.csv')):
        kodes[(k['cmerkm'], k['cecodid'])] = k['codtxtld']

    adresse = {}
    for e in lesen(datei('eingang_entree_entrata.csv')):
        # Haupteingang zuerst; ein anderer nur, wenn es keinen gibt.
        if e['egid'] not in adresse or e.get('edid') == '0':
            adresse[e['egid']] = (e.get('strname', ''), e.get('deinr', ''), e.get('dplz4', ''))

    je = defaultdict(list)
    n_geb = n_egid = 0
    with open(ziel_egid, 'w', newline='') as f:
        w = csv.writer(f)
        for g in lesen(datei('gebaeude_batiment_edificio.csv')):
            n_geb += 1
            egrid = g.get('egrid', '').strip()
            if not egrid:
                continue
            # Die Zuordnung Gebäude -> Parzelle gilt für jedes Gebäude,
            # auch abgebrochene: alte Listen führen sie noch.
            w.writerow([g['egid'], egrid])
            n_egid += 1
            if g.get('gstat') in ZAEHLT:
                je[egrid].append(g)

    with open(ziel_parz, 'w', newline='') as f:
        w = csv.writer(f)
        for egrid, gebs in je.items():
            gross = max(gebs, key=lambda g: zahl(g.get('garea')) or 0)
            wohnungen = sum(zahl(g.get('ganzwhg'), int) or 0 for g in gebs) or None
            geschosse = max((zahl(g.get('gastw'), int) or 0 for g in gebs), default=0) or None
            flaeche = sum(zahl(g.get('garea')) or 0 for g in gebs) or None
            strasse, nr, plz = adresse.get(gross['egid'], ('', '', ''))
            w.writerow([
                egrid, gross['egid'], gross.get('ggdenr', ''), gross.get('ggdename', ''),
                zahl(gross.get('gbauj'), int) or '', geschosse or '', wohnungen or '',
                flaeche or '', len(gebs), strasse, nr, plz,
                objektart(gross.get('gkat'), wohnungen, kodes) or '',
                kodes.get(('GKAT', gross.get('gkat')), ''),
                kodes.get(('GSTAT', gross.get('gstat')), ''),
            ])

    print(f'Gebäude im Register: {n_geb}, mit EGRID: {n_egid}, '
          f'Parzellen mit bestehendem Gebäude: {len(je)}')


if __name__ == '__main__':
    main()

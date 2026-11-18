# Das Gebäuderegister je Parzelle zusammengefasst, gerechnet auf dem
# Runner. Bis zum 18. November lud «Kanton laden» das ganze Register in
# drei Tabellen der Datenbank (gwr_gebaeude, gwr_eingang, gwr_kodes) und
# fasste dort mit einer Anweisung von bis zu 30 Minuten zusammen. Dabei
# legte jeder Lauf die Tabellen neu an, ohne Zeilenschutz: genau die
# Lücke, die am 15. November geschlossen wurde, wäre wieder offen
# gewesen.
#
# Zusammengefasst wird, wie am Telefon gefragt wird: Adresse und Baujahr
# des grössten Hauses (danach sucht man die Liegenschaft), die höchste
# Geschosszahl, Wohnungen und Grundfläche aufsummiert. Es zählen nur
# Gebäude, die stehen oder kommen (1001 projektiert bis 1004 bestehend);
# ein abgebrochenes Haus gibt weder Adresse noch Baujahr. Summiert werden
# nur bestehende und solche im Bau.
#
# Eingabe: das entpackte Register von public.madd.bfs.admin.ch/<kt>.zip.
# Ausgabe: eine Zeile je EGRID. Ausgegeben werden nur Zählungen.
#
# Aufruf: python3 gwr_parzellen.py <ordner> <aus.csv>
import csv, os, sys
from collections import Counter

ZAEHLT = {'1001', '1002', '1003', '1004'}
STEHT = {'1003', '1004'}
# Wer zuerst die Adresse gibt: was steht, vor dem, was kommt.
VORRANG = {'1004': 0, '1003': 1, '1002': 2, '1001': 3}
NOETIG = ['egid', 'egrid', 'lparz', 'ggdenr', 'ggdename', 'gstat', 'gkat', 'gbauj', 'gastw', 'ganzwhg', 'garea', 'gkode', 'gkodn']
SPALTEN = ['egrid', 'parzelle', 'egid', 'adresse', 'plz', 'ort', 'gemeinde', 'bfs_nr', 'baujahr', 'geschosse',
           'wohnungen', 'flaeche', 'anzahl', 'geb_status', 'gebaeudeart', 'e', 'n']


def lesen(pfad):
    with open(pfad, newline='', encoding='utf-8') as f:
        r = csv.reader(f, delimiter='\t')
        kopf = [k.strip().lower() for k in next(r)]
        yield kopf
        for z in r:
            yield dict(zip(kopf, z))


def ganz(s):
    try:
        return int(float(s)) if s not in ('', None) else None
    except ValueError:
        return None


def main(ordner, aus):
    datei = lambda name: os.path.join(ordner, name)
    zeilen = lesen(datei('gebaeude_batiment_edificio.csv'))
    kopf = next(zeilen)
    fehlt = [k for k in NOETIG if k not in kopf]
    if fehlt:
        sys.exit(f'FEHLT im Register: {", ".join(fehlt)}. Vorhanden: {", ".join(kopf)}')

    kodes = {}
    for k in list(lesen(datei('kodes_codes_codici.csv')))[1:]:
        kodes[(k.get('cmerkm'), k.get('cecodid'))] = k.get('codtxtld')

    eingang = {}
    for e in list(lesen(datei('eingang_entree_entrata.csv')))[1:]:
        egid = e.get('egid')
        # Der Haupteingang (edid 0) gibt die Adresse; fehlt er, der erste.
        if egid and (egid not in eingang or e.get('edid') == '0'):
            eingang[egid] = e

    je = {}
    status = Counter()
    for g in zeilen:
        status[g.get('gstat') or 'leer'] += 1
        egrid = (g.get('egrid') or '').strip()
        if not egrid or g.get('gstat') not in ZAEHLT:
            continue
        je.setdefault(egrid, []).append(g)

    with open(aus, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(SPALTEN)
        mit_adresse = 0
        for egrid in sorted(je):
            bauten = je[egrid]
            haupt = min(bauten, key=lambda g: (VORRANG[g['gstat']], -(ganz(g.get('garea')) or 0)))
            stehen = [g for g in bauten if g['gstat'] in STEHT]
            e = eingang.get(haupt['egid'], {})
            strasse = ' '.join(t for t in ((e.get('strname') or '').strip(), (e.get('deinr') or '').strip()) if t)
            mit_adresse += bool(strasse)
            summe = lambda feld: sum(ganz(g.get(feld)) or 0 for g in stehen) or None
            geschosse = [ganz(g.get('gastw')) for g in stehen if ganz(g.get('gastw'))]
            w.writerow([
                egrid, (haupt.get('lparz') or '').strip(), haupt['egid'], strasse,
                (e.get('dplz4') or '').strip(), (e.get('dplzname') or '').strip(),
                (haupt.get('ggdename') or '').strip(), ganz(haupt.get('ggdenr')) or '',
                ganz(haupt.get('gbauj')) or '', max(geschosse) if geschosse else '',
                summe('ganzwhg') or '', summe('garea') or '', len(stehen) or '',
                kodes.get(('GSTAT', haupt['gstat']), '') or '', kodes.get(('GKAT', haupt.get('gkat')), '') or '',
                haupt.get('gkode') or '', haupt.get('gkodn') or '',
            ])
    print(f'Gebäude nach Status: {dict(sorted(status.items()))}')
    print(f'{len(je)} Parzellen mit Gebäude, {mit_adresse} davon mit Adresse')


if __name__ == '__main__':
    main(*sys.argv[1:3])

#!/usr/bin/env python3
"""
Bereitet eigene Fotos für die Check-Seiten vor (docs/fotos.md).

Liest die Einträge aus src/lib/check-fotos.json und je Eintrag das
Original <ordner>/<id>.jpg (auch .jpeg, .png, .webp, .tif). Schreibt nach
public/fotos/:

  <id>-800.webp, <id>-1600.webp, <id>-800.avif, <id>-1600.avif
  <id>-teilen.jpg   1200 x 630, für das Vorschaubild beim Teilen

Warum so:
  * Die Kameradaten fallen weg, auch GPS und Seriennummer: ein Handyfoto
    verrät sonst, wo und womit es aufgenommen wurde. Gedreht wird vorher
    nach der Angabe der Kamera, damit nichts quer steht.
  * In jede Datei kommen die Bildangaben nach IPTC (als XMP): Titel,
    Beschreibung, Urheber, Bildnachweis, Rechte, Ort, Aufnahmetag und die
    Seite mit den Rechten. Google zeigt Urheber, Bildnachweis und Rechte
    in der Bildersuche aus genau diesen Feldern.
  * Breite und Höhe schreibt das Werkzeug zurück in check-fotos.json; die
    Seite setzt sie ans <img>, damit beim Laden nichts springt.

Ein Eintrag mit fehlenden Angaben bricht ab, bevor eine Datei entsteht:
dieselben Regeln wie fotoPruefen() in src/lib/check-fotos.ts.

Aufruf: python3 -I tools/fotos_vorbereiten.py <ordner-mit-originalen>
"""
import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

from PIL import Image, ImageOps

WURZEL = Path(__file__).resolve().parent.parent
LISTE = WURZEL / 'src' / 'lib' / 'check-fotos.json'
ZIEL = WURZEL / 'public' / 'fotos'
BREITEN = (800, 1600)
TEILEN = (1200, 630)
# Wo die Rechte stehen: das Impressum der Hauptfassung (seo-marken.ts, RATGEBER_HEIMAT).
RECHTE_SEITE = 'https://www.hauschecker.ch/#impressum'
KANTONE = {'ZH': 'Zürich', 'ZG': 'Zug', 'LU': 'Luzern', 'TG': 'Thurgau', 'SZ': 'Schwyz', 'AG': 'Aargau', 'SG': 'St. Gallen', 'BE': 'Bern'}
ENDUNGEN = ('.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff')


def pruefen(f: dict) -> list[str]:
    fehler = []
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)+', f.get('id', '')):
        fehler.append('id: klein, mit Bindestrichen, mindestens zwei Wörter')
    alt = f.get('alt', '').strip()
    if len(alt) < 25:
        fehler.append('alt: mindestens ein ganzer Satz')
    if re.match(r'(bild|foto|image|photo)\b', alt, re.I):
        fehler.append('alt: nicht mit «Bild» oder «Foto» beginnen')
    if not f.get('titel', '').strip():
        fehler.append('titel fehlt')
    if not f.get('gemeinde', '').strip() or not re.fullmatch(r'[A-Z]{2}', f.get('kanton', '')):
        fehler.append('Ort: Gemeinde und Kantonskürzel')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', f.get('aufgenommen', '')):
        fehler.append('aufgenommen: JJJJ-MM-TT')
    if not f.get('urheber', '').strip():
        fehler.append('urheber fehlt')
    return fehler


def xmp(f: dict) -> bytes:
    """Die IPTC-Angaben als XMP-Paket."""
    rechte = f"© {f['aufgenommen'][:4]} {f['urheber']}"
    alt = lambda t: f'<rdf:Alt><rdf:li xml:lang="x-default">{escape(t)}</rdf:li></rdf:Alt>'
    attr = {
        'photoshop:Credit': f['urheber'],
        'photoshop:Headline': f['titel'],
        'photoshop:City': f['gemeinde'],
        'photoshop:State': KANTONE.get(f['kanton'], f['kanton']),
        'photoshop:Country': 'Schweiz',
        'photoshop:DateCreated': f['aufgenommen'],
        'Iptc4xmpCore:CountryCode': 'CH',
        'xmpRights:Marked': 'True',
        'xmpRights:WebStatement': RECHTE_SEITE,
    }
    teile = ' '.join(f'{k}={quoteattr(v)}' for k, v in attr.items())
    return (
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"'
        ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"'
        ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"'
        ' xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"'
        ' xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"'
        f' {teile}>'
        f'<dc:title>{alt(f["titel"])}</dc:title>'
        f'<dc:description>{alt(f["alt"])}</dc:description>'
        f'<dc:creator><rdf:Seq><rdf:li>{escape(f["urheber"])}</rdf:li></rdf:Seq></dc:creator>'
        f'<dc:rights>{alt(rechte)}</dc:rights>'
        f'<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:LicensorURL>{escape(RECHTE_SEITE)}</plus:LicensorURL></rdf:li></rdf:Seq></plus:Licensor>'
        '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
    ).encode('utf-8')


def original(ordner: Path, fid: str) -> Path | None:
    for e in ENDUNGEN:
        for p in (ordner / f'{fid}{e}', ordner / f'{fid}{e.upper()}'):
            if p.exists():
                return p
    return None


def main(ordner: str) -> None:
    liste = json.loads(LISTE.read_text(encoding='utf-8'))
    fehler = {f.get('id', '?'): pruefen(f) for f in liste}
    fehler = {k: v for k, v in fehler.items() if v}
    if fehler:
        for k, v in fehler.items():
            print(f'{k}: ' + '; '.join(v))
        sys.exit('Abbruch: Angaben in check-fotos.json ergänzen.')
    ZIEL.mkdir(parents=True, exist_ok=True)
    quelle = Path(ordner)
    for f in liste:
        p = original(quelle, f['id'])
        if not p:
            sys.exit(f'{f["id"]}: kein Original in {quelle}')
        roh = Image.open(p)
        gps = bool(roh.getexif().get_ifd(0x8825)) if hasattr(roh, 'getexif') else False
        bild = ImageOps.exif_transpose(roh).convert('RGB')
        icc = roh.info.get('icc_profile')
        paket = xmp(f)
        f['breite'], f['hoehe'] = bild.size
        geschrieben = []
        for b in BREITEN:
            klein = bild if bild.width <= b else bild.resize((b, round(bild.height * b / bild.width)), Image.LANCZOS)
            for art, opt in (('webp', {'quality': 82, 'method': 6}), ('avif', {'quality': 60})):
                ziel = ZIEL / f"{f['id']}-{b}.{art}"
                klein.save(ziel, art.upper(), xmp=paket, icc_profile=icc, **opt)
                geschrieben.append(f'{ziel.name} {ziel.stat().st_size // 1024} KB')
        teilen = ImageOps.fit(bild, TEILEN, Image.LANCZOS)
        ziel = ZIEL / f"{f['id']}-teilen.jpg"
        teilen.save(ziel, 'JPEG', quality=85, optimize=True, progressive=True, xmp=paket, icc_profile=icc)
        geschrieben.append(f'{ziel.name} {ziel.stat().st_size // 1024} KB')
        print(f"{f['id']}: {f['breite']} x {f['hoehe']}, Kameradaten entfernt{' (mit GPS)' if gps else ''}")
        for g in geschrieben:
            print(f'   {g}')
    LISTE.write_text(json.dumps(liste, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(liste)} Fotos; Grösse in {LISTE.relative_to(WURZEL)} eingetragen.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

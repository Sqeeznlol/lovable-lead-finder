"""Luftbilder der Bühne einmal holen und klein ablegen (public/buehne/<marke>-<breite>.webp).

Gemessen am 15. November (Lighthouse, Handy): das Luftbild kam bei jedem Besuch live
vom WMS des Bundes, 507 von 873 KB der Startseite, und war das grösste Element
(LCP 7.4 s). Als WebP von der eigenen Domain: Handy 800 px, Computer 1600 px.

Aufruf (nach einer neuen Marke mit Luftbild): python3 -I tools/buehnenbilder.py <liste.json>
Die Liste schreibt:
  npx tsx -e "import {MARKEN} from './src/lib/check-marken'; import {buehnenBildQuelle} from './src/lib/check-gestaltung';
    console.log(JSON.stringify(MARKEN.filter(m => buehnenBildQuelle(m)).map(m => ({id: m.id, url: buehnenBildQuelle(m)}))))" > liste.json
"""
import io, json, sys, urllib.request
from pathlib import Path
from PIL import Image

liste = json.loads(Path(sys.argv[1]).read_text())
ziel = Path('public/buehne')
ziel.mkdir(parents=True, exist_ok=True)
for m in liste:
    with urllib.request.urlopen(m['url'], timeout=60) as r:
        roh = r.read()
    bild = Image.open(io.BytesIO(roh)).convert('RGB')
    for breite in (800, 1600):
        b = bild if bild.width == breite else bild.resize((breite, round(bild.height * breite / bild.width)), Image.LANCZOS)
        pfad = ziel / f"{m['id']}-{breite}.webp"
        b.save(pfad, 'WEBP', quality=72, method=6)
        print(m['id'], breite, f"{pfad.stat().st_size // 1024} KB (Quelle {len(roh) // 1024} KB)")

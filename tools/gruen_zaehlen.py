"""Zaehlt, wie viel einer PNG-Datei gruene Flaeche ist -- ohne Pillow.

Gebraucht vom Ablauf "Auswerten -> kartendienst": Der Kataster des Bundes
malt bei kleinem Zoom Bauzonen gruen statt Grenzlinien. Ab welchem Zoom
er Linien zeigt, wird so gemessen statt geschaetzt.
Ausgabe: Anteil deckender Pixel und Anteil gruener Pixel in Prozent.
"""
import struct, sys, zlib

def lesen(pfad):
    d = open(pfad, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'kein PNG'
    i, idat, w = 8, b'', None
    while i < len(d):
        n, typ = struct.unpack('>I4s', d[i:i + 8]); inhalt = d[i + 8:i + 8 + n]; i += 12 + n
        if typ == b'IHDR': w, h, tiefe, farbe = struct.unpack('>IIBB', inhalt[:10])
        elif typ == b'PLTE': pal = [tuple(inhalt[j:j + 3]) for j in range(0, n, 3)]
        elif typ == b'tRNS': trns = list(inhalt)
        elif typ == b'IDAT': idat += inhalt
    kanaele = {6: 4, 2: 3, 3: 1, 4: 2, 0: 1}[farbe]
    assert tiefe == 8, f'Tiefe {tiefe} nicht unterstuetzt'
    roh, bpp, zeile = zlib.decompress(idat), kanaele, w * kanaele
    vor, pos, pixel = bytearray(zeile), 0, []
    for _ in range(h):
        f, z = roh[pos], bytearray(roh[pos + 1:pos + 1 + zeile]); pos += 1 + zeile
        for x in range(zeile):
            a = z[x - bpp] if x >= bpp else 0; b = vor[x]; c = vor[x - bpp] if x >= bpp else 0
            if f == 1: z[x] = (z[x] + a) & 255
            elif f == 2: z[x] = (z[x] + b) & 255
            elif f == 3: z[x] = (z[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                z[x] = (z[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        vor = z
        for x in range(0, zeile, kanaele):
            if farbe == 6: pixel.append(tuple(z[x:x + 4]))
            elif farbe == 2: pixel.append((*z[x:x + 3], 255))
            elif farbe == 3:
                k = z[x]; al = trns[k] if 'trns' in dir() and k < len(trns) else 255
                pixel.append((*pal[k], al))
            elif farbe == 4: pixel.append((z[x], z[x], z[x], z[x + 1]))
            else: pixel.append((z[x], z[x], z[x], 255))
    return pixel

px = lesen(sys.argv[1])
deckend = [p for p in px if p[3] > 30]
gruen = [p for p in deckend if p[1] > p[0] + 25 and p[1] > p[2] + 25]
print(f'deckend {100 * len(deckend) / len(px):5.1f} %   gruen {100 * len(gruen) / len(px):5.1f} %')

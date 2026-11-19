/**
 * Eigene Fotos (docs/fotos.md): jedes mit Alt-Text, Urheber, Rechten und
 * Ort, alle Dateien da, die Bildangaben in der Datei, keine Kameradaten.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bildObjekt, FOTO_BREITEN, FOTOS, fotoDatei, fotoNachId, fotoPruefen, fotoTeilen, type Foto } from '../check-fotos';
import { MARKEN } from '../check-marken';

const BEISPIEL: Foto = { id: 'einfamilienhaus-garten-meilen', alt: 'Einfamilienhaus mit Satteldach und grossem Garten an einem sonnigen Hang',
  titel: 'Einfamilienhaus mit Garten in Meilen', gemeinde: 'Meilen', kanton: 'ZH', aufgenommen: '2026-11-19', urheber: 'Bauraum', breite: 3000, hoehe: 2000 };

describe('Eigene Fotos', () => {
  it('die Regeln für einen Eintrag', () => {
    expect(fotoPruefen(BEISPIEL)).toEqual([]);
    expect(fotoPruefen({ ...BEISPIEL, id: 'IMG_4711' }).length).toBe(1);
    expect(fotoPruefen({ ...BEISPIEL, alt: 'Bild von einem Haus mit Garten und Bäumen' }).length).toBe(1);
    expect(fotoPruefen({ ...BEISPIEL, alt: 'Haus' }).length).toBe(1);
    expect(fotoPruefen({ ...BEISPIEL, breite: 0 }).length).toBe(1);
  });

  it('das ImageObject nennt Urheber, Rechte und Ort', () => {
    const o = bildObjekt(BEISPIEL, 'https://www.hauschecker.ch', 'https://www.hauschecker.ch/#impressum');
    expect(o).toMatchObject({ '@type': 'ImageObject', creditText: 'Bauraum', copyrightNotice: '© 2026 Bauraum', caption: BEISPIEL.alt,
      width: 1600, height: 1067, contentUrl: 'https://www.hauschecker.ch/fotos/einfamilienhaus-garten-meilen-1600.webp' });
  });

  it('jeder Eintrag ist vollständig, mit allen Dateien, Bildangaben drin, Kameradaten draussen', () => {
    for (const f of FOTOS) {
      expect(fotoPruefen(f), f.id).toEqual([]);
      const dateien = [...FOTO_BREITEN.flatMap(b => [fotoDatei(f, b, 'webp'), fotoDatei(f, b, 'avif')]), fotoTeilen(f)];
      for (const d of dateien) {
        const pfad = `public${d}`;
        expect(existsSync(pfad), pfad).toBe(true);
        const roh = readFileSync(pfad);
        expect(roh.includes(Buffer.from(`<rdf:li>${f.urheber}</rdf:li>`)), `${pfad}: Urheber`).toBe(true);
        expect(roh.includes(Buffer.from('xmpRights:WebStatement')), `${pfad}: Rechte`).toBe(true);
        expect(roh.includes(Buffer.from('Exif\0\0')), `${pfad}: Kameradaten`).toBe(false);
      }
    }
  });

  it('jede Marke mit Foto zeigt eines, das es gibt, auf einer Bühne mit Bild', () => {
    for (const m of MARKEN.filter(x => x.design.foto)) {
      expect(fotoNachId(m.design.foto), m.id).not.toBeNull();
      expect(['luftbild', 'geteilt'], m.id).toContain(m.design.buehne);
    }
  });
});

/**
 * Die Marken (Julian, 7. November: "20 verschiedene Designs und
 * andere Namen"; 13. November: 23 Domains gekauft, je eine Seite mit
 * dem genauen Namen -- seither 28 Marken). Eine neue Marke soll nicht unbemerkt unlesbar,
 * doppelt oder mit einer Schrift kommen, die es nicht gibt.
 */
import { describe, expect, it } from 'vitest';
import { GEKAUFT, MARKEN, markeFuerHost } from '@/lib/check-marken';
import { readFileSync } from 'node:fs';
import { buehnenBild, grundton, markenAttribute, markenStil, schriftAdresse } from '@/lib/check-gestaltung';

// Am 7. November bei fonts.googleapis.com abgefragt: alle mit 400 bis 700.
const SCHRIFTEN = new Set(['Urbanist', 'Figtree', 'Manrope', 'Sora', 'Public Sans', 'Newsreader', 'Albert Sans', 'Fraunces',
  'Source Sans 3', 'Lora', 'IBM Plex Sans', 'Outfit', 'Schibsted Grotesk', 'Instrument Sans', 'Plus Jakarta Sans', 'Red Hat Display',
  'Work Sans', 'Lexend', 'Onest', 'DM Sans', 'Hanken Grotesk', 'Libre Franklin', 'Source Serif 4', 'Bricolage Grotesque']);

// Kontrast nach WCAG 2.1.
function leuchte(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function kontrast(a: string, b: string): number {
  const [x, y] = [leuchte(a), leuchte(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const DUNKEL_PAPIER = '#0E1315';
const HELL_PAPIER = '#FAF9F7';

const ANZAHL = 28;

describe('Marken', () => {
  it('sind 28, mit eindeutiger Kennung und eindeutigen Domains', () => {
    expect(MARKEN).toHaveLength(ANZAHL);
    expect(new Set(MARKEN.map(m => m.id)).size).toBe(ANZAHL);
    const alle = MARKEN.flatMap(m => m.domains);
    expect(new Set(alle).size).toBe(alle.length);
    for (const d of alle) expect(d).toMatch(/^[a-z0-9-]+\.ch$/);
    // Am 7. November vergeben -- nie eintragen.
    for (const vergeben of ['grundstueckwert.ch', 'meineparzelle.ch', 'mfhcheck.ch', 'parzellencheck.ch']) expect(alle).not.toContain(vergeben);
  });

  it('jede Marke sieht anders aus: keine zwei mit gleicher Farbe oder gleicher Schrift samt Aufbau', () => {
    expect(new Set(MARKEN.map(m => m.farbe.toUpperCase())).size).toBe(ANZAHL);
    const kombi = MARKEN.map(m => `${m.design.schrift}|${m.design.buehne}`);
    expect(new Set(kombi).size).toBe(ANZAHL);
    // Alle fünf Aufbauten und beide Grundtöne kommen vor.
    expect(new Set(MARKEN.map(m => m.design.buehne)).size).toBe(5);
    expect(MARKEN.some(m => m.design.dunkel)).toBe(true);
  });

  it('jede gekaufte Domain hat ihre eigene Marke, die genau so heisst (Julian, 13. November)', () => {
    expect(GEKAUFT).toHaveLength(23);
    const flach = (s: string) => s.toLowerCase().replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/[^a-z0-9]/g, '');
    const marken = GEKAUFT.map(d => markeFuerHost(d));
    expect(new Set(marken.map(m => m?.id)).size, 'je Domain eine andere Marke').toBe(23);
    GEKAUFT.forEach((d, i) => expect(flach(marken[i]!.name.join('')), d).toBe(flach(d.replace(/\.ch$/, ''))));
  });

  it('nutzt nur Schriften, die es bei Google Fonts gibt', () => {
    for (const m of MARKEN) {
      expect(SCHRIFTEN.has(m.design.schrift), m.id).toBe(true);
      if (m.design.titelSchrift) expect(SCHRIFTEN.has(m.design.titelSchrift), m.id).toBe(true);
      expect(schriftAdresse(m)).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=[A-Za-z0-9+]+:wght@400;500;600;700(&family=[A-Za-z0-9+]+:wght@400;500;600;700)?&display=swap$/);
    }
  });

  it('bleibt lesbar: Knopftext, Etiketten und Markenfarbe auf dem Grund', () => {
    for (const m of MARKEN) {
      const papier = m.design.dunkel ? DUNKEL_PAPIER : (m.design.papier ?? HELL_PAPIER);
      expect(kontrast(m.aufFarbe ?? '#FFFFFF', m.farbe), `${m.id}: Knopftext`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(m.farbe, m.hell), `${m.id}: Etikett`).toBeGreaterThanOrEqual(4.5);
      // Die Farbe steht auch als Schrift auf dem Grund (Wortmarke, Zahlen der Reserve).
      expect(kontrast(m.farbe, papier), `${m.id}: Farbe auf Grund`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('Luftbild nur mit Ort, und der Ort liegt in der Schweiz (LV95)', () => {
    for (const m of MARKEN) {
      const braucht = m.design.buehne === 'luftbild' || m.design.buehne === 'geteilt';
      expect(!!m.design.ort, m.id).toBe(braucht);
      if (m.design.ort) {
        const [e, n] = m.design.ort;
        expect(e).toBeGreaterThan(2485000); expect(e).toBeLessThan(2834000);
        expect(n).toBeGreaterThan(1075000); expect(n).toBeLessThan(1296000);
        expect(buehnenBild(m)).toMatch(/^https:\/\/wms\.geo\.admin\.ch\/.*LAYERS=ch\.swisstopo\.swissimage/);
      } else {
        expect(buehnenBild(m)).toBeNull();
      }
    }
  });

  it('dunkle Seiten bekommen ihren Grund aus dem CSS, nicht aus einer festen Farbe', () => {
    for (const m of MARKEN.filter(x => x.design.dunkel)) {
      expect((markenStil(m) as Record<string, string>)['--papier'], m.id).toBeUndefined();
      expect(markenAttribute(m)['data-dunkel']).toBe('');
    }
  });

  it('schreibt Schweizer Hochdeutsch: kein ß, keine Gedankenstriche, nichts "Neutrales"', () => {
    for (const m of MARKEN) {
      const text = [m.etikett, m.titel, m.satz, m.aufruf, m.ueber, m.analyse, ...m.vorteile, ...m.name].join('\n');
      expect(text, m.id).not.toMatch(/ß|–|—| -- /);
      expect(text, m.id).not.toMatch(/neutral|unabhängig/i);
    }
  });

  it('iPhone: Safari-Leiste in der Farbe des Grunds, dunkel wie im CSS', () => {
    const css = readFileSync('src/pages/check.css', 'utf8');
    const dunkel = css.match(/data-dunkel\]\{--papier: *(#[0-9A-Fa-f]{6})/)?.[1];
    for (const m of MARKEN) {
      expect(grundton(m), m.id).toBe(m.design.dunkel ? dunkel : (m.design.papier ?? HELL_PAPIER));
    }
  });
});

describe('Vorschläge der Adresssuche', () => {
  it('ohne "#" und ohne lange Kennung (Julian, 8. November)', async () => {
    const { vorschlagText } = await import('@/lib/check-daten');
    expect(vorschlagText('Bahnhofstrasse # <b>3920 Zermatt</b>', 'address')).toBeNull();
    expect(vorschlagText('Bahnhofstrasse 1 <b>8610 Uster</b>', 'address')).toBe('Bahnhofstrasse 1 8610 Uster');
    expect(vorschlagText('<b>Fällanden                                         </b> 2725 (CH 5456 3977 8444)', 'parcel')).toBe('Parzelle 2725, Fällanden');
    expect(vorschlagText('<b>Disentis/Mustér  </b> 1234 (CH 9861 2326 7942)', 'parcel')).toBe('Parzelle 1234, Disentis/Mustér');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GEKAUFT, markeFuerHost } from '@/lib/check-marken';
import { ARTIKEL } from '@/lib/ratgeber';
import { hauptadresse, markenSeite, MARKEN_LIVE, RATGEBER_HEIMAT, sitemap, vercelUmleitungen } from '@/lib/seo-marken';

const index = readFileSync('index.html', 'utf8').replace('<div id="root"></div>', '<div id="root"></div>');

describe('Was Google von den Check-Seiten sieht', () => {
  it('vercel.json enthält die Umleitungen je Marke (sonst: npx tsx tools/vercel-marken.ts)', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(v.rewrites.slice(0, vercelUmleitungen().length)).toEqual(vercelUmleitungen());
    // Die allgemeine Seite heisst im Bau app.html (vite.config.ts), sonst gewinnt "/" gegen jede Umleitung.
    expect(v.rewrites.at(-1).destination).toBe('/app.html');
  });
  it('jede gekaufte Domain hat ihre Seite', () => {
    for (const d of GEKAUFT) expect(MARKEN_LIVE).toContain(markeFuerHost(d));
  });
  it('keine Spur der internen App, kein noindex, Hauptadresse mit www', () => {
    for (const m of MARKEN_LIVE) {
      const html = markenSeite(index, m);
      expect(html).not.toMatch(/CRM|Pipedrive|Aurora|Off-Market|noindex/);
      expect(html).toContain(`<link rel="canonical" href="${hauptadresse(m)}/" />`);
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html).toContain(`<h1>`);
    }
  });
  it('Ratgeber zeigt auf eine Hauptfassung und steht nur in deren Sitemap', () => {
    const m = MARKEN_LIVE.find(x => hauptadresse(x) !== RATGEBER_HEIMAT)!;
    expect(markenSeite(index, m, ARTIKEL[0])).toContain(`href="${RATGEBER_HEIMAT}/ratgeber/${ARTIKEL[0].slug}"`);
    expect(sitemap(m, '2026-11-15')).not.toContain('/ratgeber/');
    const heim = MARKEN_LIVE.find(x => hauptadresse(x) === RATGEBER_HEIMAT)!;
    expect(sitemap(heim, '2026-11-15')).toContain(`/ratgeber/${ARTIKEL[0].slug}`);
  });
});

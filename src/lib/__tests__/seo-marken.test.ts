import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GEKAUFT, markeFuerHost } from '@/lib/check-marken';
import { ARTIKEL } from '@/lib/ratgeber';
import { hauptadresse, heizungsMarke, markenSeite, MARKEN_LIVE, RATGEBER_HEIMAT, sitemap, vercelUmleitungen } from '@/lib/seo-marken';

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
    expect(sitemap(heim, '2026-11-15')).toContain(`${RATGEBER_HEIMAT}/heizung`);
    const h = markenSeite(index, heizungsMarke(m), undefined, '/heizung');
    expect(h).toContain(`href="${RATGEBER_HEIMAT}/heizung"`);
    expect(h).toContain('<h1>Ihre Heizung ersetzen?');
  });
});

describe('Gemeinde-Seiten', () => {
  const zahlen = [
    { bfs: 198, name: 'Uster', kanton: 'ZH', n365: 153, n90: 50, seit: '2025-11-15', arten: { neubau: 31, umbau: 43, waermepumpe: 18, solar: 13, abbruch: 22 }, wohnbauten: { n: 5005, vor1980: 2504, fossil: 3521 } },
    { bfs: 1508, name: 'Oberdorf (NW)', kanton: 'NW', n365: 6, n90: 6, seit: '2026-10-14', arten: { neubau: 1, umbau: 2, waermepumpe: 0, solar: 1, abbruch: 0 }, wohnbauten: null },
    { bfs: 2869, name: 'Oberdorf (BL)', kanton: 'BL', n365: 5, n90: 5, seit: '2026-10-14', arten: { neubau: 0, umbau: 1, waermepumpe: 0, solar: 0, abbruch: 0 }, wohnbauten: null },
  ];
  it('Adressen ohne Doppel, Texte nur mit vorhandenen Zahlen, ehrlicher Zeitraum', async () => {
    const { mitAdressen, satz, kennzahlen } = await import('@/lib/gemeinde-seiten');
    const g = mitAdressen(zahlen);
    expect(g.map(x => x.slug)).toEqual(['uster', 'oberdorf-nw', 'oberdorf-bl']);
    const heute = new Date('2026-11-15T12:00:00Z');
    expect(satz(g[0], heute)).toBe("In Uster wurden in den letzten zwölf Monaten 153 Baugesuche publiziert, 50 davon in den letzten drei Monaten. 50 % der 5'005 Wohngebäude sind vor 1980 gebaut. Prüfen Sie, was auf Ihrem Grundstück möglich ist.");
    expect(satz(g[1], heute)).toBe('In Oberdorf wurden seit dem 14. Oktober 2026 6 Baugesuche publiziert. Prüfen Sie, was auf Ihrem Grundstück möglich ist.');
    expect(kennzahlen(g[1], heute).map(k => k.titel)).not.toContain('Wohngebäude');
  });
  it('feste Seite mit Hauptadresse auf was-kann-ich-bauen.ch und Umleitung nur dort', async () => {
    const { mitAdressen, GEMEINDE_HEIMAT } = await import('@/lib/gemeinde-seiten');
    const { gemeindeSeite } = await import('@/lib/seo-marken');
    const m = markeFuerHost('was-kann-ich-bauen.ch')!;
    const html = gemeindeSeite(index, m, mitAdressen(zahlen)[0]);
    expect(html).toContain(`<link rel="canonical" href="${GEMEINDE_HEIMAT}/gemeinde/uster" />`);
    expect(html).toContain('<h1>Bauen in Uster: Bauzone, Ausnützung und Baugesuche</h1>');
    const r = vercelUmleitungen().filter(x => x.source === '/gemeinde/:ort');
    expect(r).toHaveLength(1);
    expect(r[0].destination).toBe(`/marken/${m.id}/gemeinde/:ort.html`);
  });
});

describe('Was KI-Leser ohne JavaScript bekommen', () => {
  const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x => JSON.parse(x[1]));
  it('Startseite: Ablauf, Quellen und alle Fragen im HTML, dazu FAQPage', async () => {
    const { FRAGEN } = await import('@/lib/check-inhalt');
    const m = MARKEN_LIVE[0];
    const html = markenSeite(index, m, undefined, undefined, { ausfuehrlich: true });
    for (const [f] of FRAGEN) expect(html).toContain(`<h3>${f.replace(/&/g, '&amp;')}</h3>`);
    expect(html).toContain("<h2>So funktioniert's</h2>");
    const [daten] = ld(html);
    const faq = daten['@graph'].find((x: { '@type': string }) => x['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(FRAGEN.length);
    expect(html).not.toMatch(/CRM|Pipedrive|Aurora|Off-Market|noindex/);
  });
  it('Ratgeber als Article mit Datum, Unterseiten ohne doppelte Fragen', () => {
    const [a] = ld(markenSeite(index, MARKEN_LIVE[0], ARTIKEL[0]));
    expect(a['@type']).toBe('Article');
    expect(a.datePublished).toBe('2026-11-07');
    expect(a.url).toBe(`${RATGEBER_HEIMAT}/ratgeber/${ARTIKEL[0].slug}`);
    const h = markenSeite(index, heizungsMarke(MARKEN_LIVE[0]), undefined, '/heizung');
    expect(h).not.toContain('FAQPage');
    expect(ld(h)).toHaveLength(1);
  });
  it('llms.txt je Marke mit Hauptfassungen, Umleitung je Domain', async () => {
    const { llms } = await import('@/lib/seo-marken');
    const t = llms(MARKEN_LIVE[0]);
    expect(t).toMatch(/^# /);
    expect(t).toContain(`${RATGEBER_HEIMAT}/ratgeber/${ARTIKEL[0].slug}`);
    expect(t).toContain('## Häufige Fragen');
    for (const m of MARKEN_LIVE) expect(vercelUmleitungen().some(r => r.source === '/llms.txt' && r.destination === `/marken/${m.id}/llms.txt`)).toBe(true);
  });
});

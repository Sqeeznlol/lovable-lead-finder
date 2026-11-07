import { describe, expect, it } from 'vitest';
import { ARTIKEL, artikelNachSlug, zumCheck } from '@/lib/ratgeber';

describe('Ratgeber', () => {
  it('führt auf der Marken-Domain zur Startseite, sonst zur Vorschau, und nimmt die Werbekennungen mit', () => {
    const facebook = '?utm_source=facebook&utm_campaign=zh-60plus&fbclid=abc';
    const a = new URL(zumCheck({ aufMarkenDomain: true, markeId: 'hauschecker', suche: facebook, slug: 'haus-zu-gross' }), 'https://hauschecker.ch');
    expect(a.pathname).toBe('/');
    expect(Object.fromEntries(a.searchParams)).toEqual({ utm_source: 'facebook', utm_campaign: 'zh-60plus', fbclid: 'abc', utm_content: 'ratgeber-haus-zu-gross' });

    const b = new URL(zumCheck({ aufMarkenDomain: false, markeId: 'hauschecker', suche: '', slug: 'haus-zu-gross' }), 'https://www.wohntraums.life');
    expect(b.pathname).toBe('/check/hauschecker');
    expect(b.searchParams.get('utm_content')).toBe('ratgeber-haus-zu-gross');

    // Eine Anzeige mit eigenem utm_content behält ihn.
    const c = new URL(zumCheck({ aufMarkenDomain: true, markeId: 'x', suche: '?utm_content=bild-uster', slug: 'haus-zu-gross' }), 'https://x.ch');
    expect(c.searchParams.get('utm_content')).toBe('bild-uster');
  });

  it('jeder Artikel hat eine eindeutige Adresse, Quellen und einen Kasten zum Check', () => {
    const slugs = ARTIKEL.map(a => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ARTIKEL) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(artikelNachSlug(a.slug)).toBe(a);
      expect(a.quellen.length).toBeGreaterThan(0);
      for (const q of a.quellen) expect(q.url).toMatch(/^https:\/\//);
      expect(a.abschnitte.some(x => x.kasten)).toBe(true);
    }
    expect(artikelNachSlug('gibt-es-nicht')).toBeNull();
  });

  it('schreibt Schweizer Hochdeutsch: kein ß, keine Gedankenstriche, nichts "Neutrales"', () => {
    for (const a of ARTIKEL) {
      const text = [a.rubrik, a.titel, a.lead, ...a.abschnitte.flatMap(x => [x.titel, ...x.absaetze]), a.kasten.titel, a.kasten.satz, a.kasten.knopf].join('\n');
      expect(text).not.toMatch(/ß|–|—/);
      // Wir vermitteln und kaufen selbst; "neutral" oder "unabhängig" wäre irreführend (UWG Art. 3 Abs. 1 lit. b).
      expect(text).not.toMatch(/neutral|unabhängig/i);
    }
  });
});

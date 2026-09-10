import { describe, it, expect, vi, afterEach } from 'vitest';
import { FENSTER, oeffne, benenneEigenenTab } from '../fenster';

describe('oeffne', () => {
  const alt = window.open;
  afterEach(() => { window.open = alt; });

  it('benutzt für dieselbe Rolle immer denselben Tab', () => {
    const gerufen: [string, string][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).open = (u: string, n: string) => { gerufen.push([u, n]); return null; };

    oeffne('https://map.geo.tg.ch/a', FENSTER.portal);
    oeffne('https://map.geo.tg.ch/b', FENSTER.portal);
    oeffne('https://www.wohntraums.life/', FENSTER.app);

    // Zwei Portalaufrufe, aber derselbe Fenstername: der Browser
    // ersetzt den Inhalt, statt einen zweiten Tab zu öffnen.
    expect(gerufen.map(g => g[1]))
      .toEqual(['bauraum-portal', 'bauraum-portal', 'bauraum-app']);
    expect(new Set(gerufen.map(g => g[1])).size).toBe(2);
  });

  it('nennt nie "_blank" -- das wäre jedes Mal ein neuer Tab', () => {
    const namen: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).open = (_u: string, n: string) => { namen.push(n); return null; };
    oeffne('https://x.test', FENSTER.portal);
    expect(namen).not.toContain('_blank');
  });
});

describe('Der eigene Tab', () => {
  it('gibt sich selbst einen Namen -- sonst findet ihn niemand wieder', () => {
    window.name = '';
    benenneEigenenTab();
    expect(window.name).toBe(FENSTER.app);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FENSTER, oeffne, benenneEigenenTab } from '../fenster';

/**
 * Jeder Klick auf einen fremden Link muss vorne etwas zeigen. Mit festen
 * Tabnamen lud jeder zweite Klick still im Hintergrund (18. November,
 * gemessen in der Objektansicht: «Projekt ansehen», PDF, Register,
 * Grundbuch).
 */
describe('Fremde Seiten', () => {
  const alt = window.open;
  afterEach(() => { window.open = alt; });

  it('öffnen jedes Mal einen neuen Tab', () => {
    expect([FENSTER.portal, FENSTER.karte, FENSTER.suche, FENSTER.extern]).toEqual(['_blank', '_blank', '_blank', '_blank']);
  });

  it('aus einem Knopf: neuer Tab ohne Zugriff zurück auf diese Seite', () => {
    const gerufen: unknown[][] = [];
    (window as unknown as { open: (...a: unknown[]) => null }).open = (...a: unknown[]) => { gerufen.push(a); return null; };
    oeffne('https://map.geo.admin.ch/');
    expect(gerufen).toEqual([['https://map.geo.admin.ch/', '_blank', 'noopener']]);
  });

  it('keine Stelle setzt wieder einen festen Tabnamen', () => {
    const dateien: string[] = [];
    const gehe = (d: string) => readdirSync(d).forEach(n => {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== '__tests__') gehe(p); } else if (/\.tsx?$/.test(n)) dateien.push(p);
    });
    gehe('src');
    const fest = dateien.filter(p => p !== join('src', 'lib', 'fenster.ts'))
      .filter(p => /target=["'{`](?!_blank|\{?FENSTER\.)|window\.open\([^)]*,\s*['"](?!_blank)/.test(readFileSync(p, 'utf8')));
    expect(fest).toEqual([]);
  });
});

describe('Der eigene Tab', () => {
  it('gibt sich selbst einen Namen -- sonst findet ihn das Lesezeichen nicht', () => {
    window.name = '';
    benenneEigenenTab();
    expect(window.name).toBe(FENSTER.app);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Julian, 22. November: «mach Nachbarschaft und Arrondierung zusammen».
 * Ein Reiter «Arrondierung»: oben die Nachbarn jeder Parzelle, darunter
 * die Kundenfonds. Alte Links auf /nachbarschaft führen dorthin.
 */
const index = readFileSync('src/pages/Index.tsx', 'utf8');
const arrondierung = readFileSync('src/components/Arrondierung.tsx', 'utf8');

describe('Nachbarschaft und Arrondierung in einem Reiter', () => {
  it('die Navigation kennt nur noch «Arrondierung»', () => {
    expect(index).toContain("{ id: 'arrondierung', label: 'Arrondierung'");
    expect(index).not.toMatch(/\{ id: 'nachbarschaft'/);
    expect(index).not.toMatch(/const TABS = \[[^\]]*'nachbarschaft'/);
  });

  it('ein alter Link auf /nachbarschaft führt zur Arrondierung', () => {
    expect(index).toMatch(/FRUEHER[^=]*= \{ nachbarschaft: 'arrondierung' \}/);
    expect(index).toContain('navigate(`/${FRUEHER[bereich]}${window.location.search}`, { replace: true })');
  });

  it('oben die Nachbarn einer Parzelle, darunter die Kundenfonds', () => {
    const suche = arrondierung.indexOf('<NachbarnSuche />');
    const fonds = arrondierung.indexOf('titel="Kundenfonds"');
    expect(suche).toBeGreaterThan(0);
    expect(fonds).toBeGreaterThan(suche);
  });

  it('die Prüfung öffnet den Reiter, nicht mehr den alten', () => {
    const t = readFileSync('tools/reiter-pruefen.cjs', 'utf8');
    expect(t).toMatch(/'arrondierung'/);
    expect(t).not.toMatch(/'nachbarschaft'/);
  });
});

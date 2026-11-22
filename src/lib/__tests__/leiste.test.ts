import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Die linke Leiste (22. November, Julian: «manchmal verschwindet das links
 * beim Scrollen»): ihr rollbarer Teil darf nur senkrecht rollen. Sonst
 * schiebt ein schräges Wischen auf dem Trackpad alle Symbole seitlich aus
 * dem Bild, gemessen 165 px.
 */
describe('Linke Leiste', () => {
  const index = readFileSync('src/pages/Index.tsx', 'utf8');
  it('rollt nur senkrecht', () => {
    const nav = index.match(/<nav className="([^"]*)" aria-label="Hauptnavigation">/)![1];
    expect(nav).toContain('overflow-y-auto');
    expect(nav).toContain('overflow-x-hidden');
  });
});

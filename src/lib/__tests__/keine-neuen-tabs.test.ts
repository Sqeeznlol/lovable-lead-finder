/**
 * Der Bildschirm mit zehn offenen Tabs war der Beleg, dass "zwei Tabs,
 * nicht zwanzig" beim letzten Mal nur an einer einzigen Stelle
 * umgesetzt war. Dieser Test liest alle Quellen und laesst keine
 * zweite Stelle mehr durch.
 *
 * Er prueft zwei Dinge, die beide je fuer sich einen neuen Tab
 * aufmachen:
 *   1. target="_blank" und window.open(..., '_blank')
 *   2. rel="noopener" an einem benannten Ziel -- damit erzeugt der
 *      Browser laut HTML-Spezifikation einen neuen Kontext und schlaegt
 *      den Namen gar nicht erst nach.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function quellen(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : quellen(pfad);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : [];
  });
}

const dateien = quellen('src').filter(p => !p.includes('/ui/'));

describe('Tabs', () => {
  it('findet ueberhaupt Quellen', () => {
    expect(dateien.length).toBeGreaterThan(20);
  });

  it('macht nirgends einen namenlosen Tab auf', () => {
    const schuldige = dateien.filter(p => {
      const t = readFileSync(p, 'utf8');
      // Gesucht ist die Verwendung, nicht das Wort: in fenster.ts steht
      // im Kommentar, warum es "_blank" hier nicht mehr gibt.
      return /target=["{ ]*["']_blank/.test(t) || /,\s*['"]_blank['"]\s*\)/.test(t);
    });
    expect(schuldige).toEqual([]);
  });

  it('setzt kein rel="noopener" an ein benanntes Ziel', () => {
    const schuldige: string[] = [];
    for (const p of dateien) {
      const zeilen = readFileSync(p, 'utf8').split('\n');
      zeilen.forEach((z, i) => {
        if (!z.includes('target={FENSTER.')) return;
        const umfeld = [zeilen[i - 1] ?? '', z, zeilen[i + 1] ?? ''].join(' ');
        if (/rel="no(opener|referrer)/.test(umfeld)) schuldige.push(`${p}:${i + 1}`);
      });
    }
    expect(schuldige).toEqual([]);
  });
});

/**
 * Julian, 7. November: "alles Akquise ... separiert im Git ... dann weg
 * von der Webseite". Die Akquise ist ein eigenes Programm (Zweig
 * "akquise", später das Repository bauraum-akquise). Dieser Wächter
 * wird rot, wenn ein Teil davon auf die Webseite zurückkehrt -- statt
 * dass es jemand beim nächsten Blick auf die Seite merken muss.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function quellen(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : quellen(pfad);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : [];
  });
}

describe('Akquise getrennt von der Webseite', () => {
  it('keine Reiter der Akquise und keine öffentlichen Akquise-Seiten', () => {
    const index = readFileSync('src/pages/Index.tsx', 'utf8');
    for (const reiter of ['uebersicht', 'master', 'nummern', 'pipedrive', 'gebaeudesuche', 'akquise', 'telsuche', 'phones', 'masterimport']) {
      expect(index).not.toContain(`'${reiter}'`);
    }
    const app = readFileSync('src/App.tsx', 'utf8');
    // Geprüft werden Importe und Elemente, nicht Kommentare.
    expect(app).not.toMatch(/pages\/(Check|Ratgeber|Anfrage|SwipePage)|<(Check|Ratgeber|Anfrage|SwipePage)\b|EigentuemerLookup|AuskunftAusLesezeichen/);
  });

  it('nichts auf der Webseite fragt Eigentümer ab, sucht Nummern oder schiebt nach Pipedrive', () => {
    const verboten = /use-eigentuemer-lookup|lib\/portal|tel-search|pipedrive-push|sms-confirmation|navigate\(`\/akquise/;
    const treffer = quellen('src').filter(p => verboten.test(readFileSync(p, 'utf8')));
    expect(treffer).toEqual([]);
  });

  it('Erweiterung, Akquise-Funktionen und Pipedrive-Abläufe liegen nicht mehr hier', () => {
    for (const pfad of ['extension', 'supabase/functions/tel-search', 'supabase/functions/pipedrive-push',
      'supabase/functions/sms-confirmation', 'supabase/functions/daily-digest', '.github/workflows/pipedrive.yml',
      '.github/workflows/extension.yml', 'public/bauraum-erweiterung.zip']) {
      expect(existsSync(pfad), pfad).toBe(false);
    }
  });
});

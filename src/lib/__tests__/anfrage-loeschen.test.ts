import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Leads löschen nur mit Passwort (Julian, 21. November: «darf aber keiner
 * sehen das Passwort»). Wird rot, wenn das Passwort im Klartext in den
 * Code, eine Migration oder einen Ablauf gerät, oder wenn die Seite selbst
 * löscht statt über die Prüfung der Datenbank.
 */
const SQL = readFileSync('supabase/migrations/20261121120000_anfrage_loeschen.sql', 'utf8');
const dateien = (ordner: string): string[] => readdirSync(ordner, { withFileTypes: true })
  .flatMap(d => (d.isDirectory() ? dateien(`${ordner}/${d.name}`) : [`${ordner}/${d.name}`]));

describe('Leads löschen', () => {
  it('in der Migration steht nur der Prüfwert, und nur die Funktion liest ihn', () => {
    expect(SQL).toMatch(/values \('lead_loeschen', '\$2a\$10\$[./A-Za-z0-9]{53}'\)/);
    expect(SQL).toMatch(/revoke all on public\.geheimnis from public, anon, authenticated/);
    expect(SQL).toMatch(/crypt\(p_passwort, pw\) <> pw/);
    expect(SQL).toMatch(/n >= 5/);
  });

  it('das Passwort steht nirgends im Klartext', () => {
    // Das Wort selbst darf in Befehlen klein vorkommen (delete from), gross geschrieben nirgends.
    const verdaechtig = [...dateien('src'), ...dateien('supabase'), ...dateien('tools'), ...dateien('.github')]
      .filter(f => /\.(ts|tsx|sql|cjs|js|yml|sh|py)$/.test(f) && !f.endsWith('anfrage-loeschen.test.ts'))
      .filter(f => /['"`]DELETE['"`]/.test(readFileSync(f, 'utf8')));
    expect(verdaechtig).toEqual([]);
  });

  it('die Seite löscht nur über die Funktion, mit verdecktem Feld', () => {
    const seite = readFileSync('src/components/LeadDetail.tsx', 'utf8');
    expect(seite).toMatch(/rpc\('anfrage_loeschen'/);
    expect(seite).toMatch(/type="password"/);
    expect(seite).not.toMatch(/from\('anfrage'\)\.delete/);
  });
});

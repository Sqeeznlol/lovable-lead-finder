/**
 * Die Anmeldung ist weg -- und soll nicht an einer Stelle
 * zurueckkommen, die niemand mehr ansieht.
 *
 * Es waren drei Masken, nicht eine: der Torwaechter vor der ganzen
 * Anwendung, eine zweite Maske auf /swipe und der Passwort-Riegel vor
 * dem Admin-Bereich. Wer nur die erste entfernt, haelt die Arbeit fuer
 * getan und findet die zweite erst auf dem Telefon. Dieser Test liest
 * alle Quellen und laesst keine davon wieder durch.
 *
 * Was er nicht prueft: ob die Datenbank den Zugriff ohne Anmeldung
 * zulaesst. Das entscheiden ihre Regeln, nicht dieser Quelltext --
 * siehe `supabase/migrations/20260905230000_zugang_beschraenken.sql`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function quellen(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : quellen(pfad);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : [];
  });
}

// Die fertigen Bausteine unter ui/ bringen eigene Felder mit; dort
// steht kein Anmeldeformular dieser Anwendung.
const dateien = quellen('src').filter(p => !p.includes('/ui/'));

/** Die Dateien, die die Anmeldung getragen haben. */
const ENTFERNT = [
  'src/components/Anmeldung.tsx',
  'src/components/AuthPage.tsx',
  'src/components/Torwaechter.tsx',
  'src/components/AdminSchloss.tsx',
  'src/hooks/use-auth.tsx',
];

describe('keine Anmeldung', () => {
  it('findet ueberhaupt Quellen', () => {
    expect(dateien.length).toBeGreaterThan(20);
  });

  it('hat keine der Anmelde-Dateien wieder', () => {
    expect(ENTFERNT.filter(p => existsSync(p))).toEqual([]);
  });

  it('fragt nirgends nach einem Passwort', () => {
    const schuldige = dateien.filter(p =>
      /type=["{ ]*["']password/.test(readFileSync(p, 'utf8')),
    );
    expect(schuldige).toEqual([]);
  });

  it('meldet niemanden an oder ab', () => {
    const schuldige = dateien.filter(p => {
      const t = readFileSync(p, 'utf8');
      // Gesucht ist der Aufruf, nicht das Wort: in protokoll.ts steht
      // im Kommentar, warum es die Anmeldung hier nicht mehr gibt.
      return /\bsignIn\s*\(|\bsignOut\s*\(|\bsignUp\s*\(/.test(t)
        || /signInWithPassword|auth\.signOut/.test(t);
    });
    expect(schuldige).toEqual([]);
  });

  it('haengt nichts mehr am Anmelde-Haken', () => {
    const schuldige = dateien.filter(p => {
      const t = readFileSync(p, 'utf8');
      return /from ['"]@\/hooks\/use-auth['"]/.test(t) || /\buseAuth\s*\(/.test(t);
    });
    expect(schuldige).toEqual([]);
  });
});

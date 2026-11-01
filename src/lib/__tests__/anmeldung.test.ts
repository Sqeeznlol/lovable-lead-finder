/**
 * Die Anmeldung ist zurück -- und soll nicht an einer Stelle wieder
 * verschwinden, die niemand ansieht. Am 31. Oktober stand hier der
 * umgekehrte Wächter (keine-anmeldung.test.ts). Die Entscheidung hat
 * sich gedreht, der Wächter mit ihr.
 *
 * Geprüft wird, was man am Quelltext prüfen kann: dass alle Seiten
 * hinter dem Torwächter stehen, dass der Admin-Bereich die Rolle
 * verlangt, und dass die Anmeldungen nur der Admin lesen darf. Ob die
 * Datenbank ohne Anmeldung noch Daten herausgibt, entscheiden ihre
 * Regeln -- siehe 20260905230000_zugang_beschraenken.sql.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geraetName } from '@/lib/geraet';
import { kennungZuAdresse } from '@/lib/kennung';

describe('Anmeldung', () => {
  it('die ganze Anwendung steht hinter dem Torwächter', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/<AuthProvider>/);
    expect(app).toMatch(/<Torwaechter>[\s\S]*<Routes>[\s\S]*<\/Torwaechter>/);
  });

  it('der Admin-Bereich verlangt die Admin-Rolle', () => {
    expect(readFileSync('src/pages/Index.tsx', 'utf8')).toMatch(/<AdminZugang>/);
    expect(readFileSync('src/components/AdminZugang.tsx', 'utf8')).toMatch(/isAdmin/);
  });

  it('die Anmeldungen liest nur der Admin, und schreiben kann sie niemand direkt', () => {
    const m = readFileSync('supabase/migrations/20261101120000_anmeldung.sql', 'utf8');
    expect(m).toMatch(/create policy anmeldung_lesen on public\.anmeldung\s+for select to authenticated\s+using \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
    expect(m).not.toMatch(/on public\.anmeldung\s+for (insert|update|delete|all)/i);
    expect(m).toMatch(/security definer/);
  });

  it('macht aus dem Benutzernamen eine Adresse', () => {
    expect(kennungZuAdresse('AUI')).toBe('aui@wohntraums.life');
    expect(kennungZuAdresse(' Sqeezn ')).toBe('sqeezn@wohntraums.life');
    expect(kennungZuAdresse('x@y.ch')).toBe('x@y.ch');
  });

  it('benennt das Gerät nach System und Browser', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
    const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    const macChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    expect(geraetName(iphone, true)).toBe('iPhone · Safari');
    expect(geraetName(edge, false)).toBe('Windows · Edge');
    // Ein iPad gibt sich als Mac aus; nur der Touch verrät es.
    expect(geraetName(macSafari, true)).toBe('iPad · Safari');
    expect(geraetName(macSafari, false)).toBe('Mac · Safari');
    expect(geraetName(macChrome, false)).toBe('Mac · Chrome');
  });
});

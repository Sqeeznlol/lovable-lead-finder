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
import { geraetGenau, geraetName } from '@/lib/geraet';
import { kennungZuAdresse } from '@/lib/kennung';

describe('Anmeldung', () => {
  it('die ganze Anwendung steht hinter dem Torwächter -- bis auf die drei öffentlichen Seiten', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/<AuthProvider>/);
    expect(app).toMatch(/<Torwaechter>[\s\S]*<Route path="\/" element=\{<Index \/>\}[\s\S]*<\/Torwaechter>/);
    // Ausserhalb des Torwächters stehen genau diese drei, und nur die Anfrage-Seite.
    const aussen = app.replace(/<Torwaechter>[\s\S]*<\/Torwaechter>/, '');
    const offen = [...aussen.matchAll(/<Route path="([^"]+)" element=\{<(\w+)/g)].map(m => `${m[1]} ${m[2]}`);
    // /fonds (Wohntraums) hat eine eigene Anmeldung statt des Torwächters --
    // erlaubt nur, solange die Seite ohne Konto nichts als die Maske zeigt.
    expect(offen).toEqual(['/bewertung Anfrage', '/potenzial Anfrage', '/investor Anfrage', '/fonds FondsSeite', '/fonds/:bereich FondsSeite']);
    const fonds = readFileSync('src/pages/Fonds.tsx', 'utf8');
    expect(fonds).toMatch(/if \(!user\) return <Anmeldung konto="fonds"/);
    expect(fonds.indexOf('if (!user)')).toBeLessThan(fonds.indexOf('<FondsOberflaeche'));
  });

  it('die öffentliche Seite liest nichts aus der Datenbank, sie fügt nur ein', () => {
    const seite = readFileSync('src/pages/Anfrage.tsx', 'utf8');
    expect(seite.match(/\.from\('(\w+)'\)/g)).toEqual([".from('anfrage')"]);
    expect(seite).toMatch(/\.from\('anfrage'\)\.insert\(/);
    expect(seite).not.toMatch(/\.select\(|\.rpc\(/);
    const m = readFileSync('supabase/migrations/20261101240000_anfrage.sql', 'utf8');
    expect(m).toMatch(/for insert to anon, authenticated/);
    expect(m).toMatch(/for select to authenticated/);
    expect(m).not.toMatch(/for (select|update|delete|all) to anon/);
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

  it('Gerätenamen setzt nur der Admin, und das Protokoll bleibt ohne Schreibregel', () => {
    const m = readFileSync('supabase/migrations/20261101200000_anmeldung_ort_geraet.sql', 'utf8');
    expect(m).toMatch(/on public\.geraet_benennung\s+for all to authenticated\s+using \(public\.has_role\(auth\.uid\(\), 'admin'\)\)\s+with check \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/);
    expect(m).not.toMatch(/on public\.anmeldung\s+for (insert|update|delete|all)/i);
    // Die Adresse kommt weiterhin vom Rand, nicht aus einem Parameter.
    expect(m).toMatch(/current_setting\('request\.headers'/);
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

describe('Gerät genau', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const android = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

  it('nennt beim iPhone die iOS-Version, die Safari-Version und den Bildschirm', () => {
    expect(geraetGenau(iphone, true, {}, { w: 390, h: 844 })).toBe('iPhone · iOS 18.1 · Safari 18 · 390×844');
  });

  it('erkennt Windows 11 nur an den Hinweisen des Browsers', () => {
    expect(geraetGenau(win, false, { platformVersion: '15.0.0' }, { w: 1920, h: 1080 })).toBe('Windows 11 · Chrome 131 · 1080×1920');
    expect(geraetGenau(win, false, { platformVersion: '10.0.0' }, null)).toBe('Windows 10 · Chrome 131');
    expect(geraetGenau(win, false, {}, null)).toBe('Windows · Chrome 131');
  });

  it('setzt beim Android das Modell aus den Hinweisen ein', () => {
    expect(geraetGenau(android, true, { model: 'SM-S918B' }, null)).toBe('Android 14 · SM-S918B · Chrome 131');
  });
});

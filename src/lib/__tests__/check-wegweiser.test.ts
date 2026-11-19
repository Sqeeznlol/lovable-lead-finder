/**
 * Der Wegweiser der Check-Seiten (Julian, 19. November): der nächste
 * Schritt gleich unter den Zahlen, eine Angabe je Bild, E-Mail freiwillig,
 * das PDF erst am Schluss, Tipps mit Herkunft.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TIPPS, tippsFuer } from '../check-tipps';
import { MARKEN } from '../check-marken';
import { wohnadresseOk } from '../check-daten';

const seite = readFileSync('src/pages/Check.tsx', 'utf8');

describe('Tipps und Tricks', () => {
  it('jeder Tipp nennt, wo er nachzulesen ist', () => {
    for (const t of TIPPS) {
      expect(t.quellen.length + (t.ratgeber ? 1 : 0), t.titel).toBeGreaterThan(0);
      for (const q of t.quellen) expect(q.url, t.titel).toMatch(/^https:\/\/[a-z0-9.-]+\.(ch|admin\.ch)\//);
    }
  });
  it('kein Gedankenstrich, kein scharfes S, keine leeren Sätze', () => {
    for (const t of TIPPS) {
      expect(`${t.titel} ${t.text}`, t.titel).not.toMatch(/[–—ß]/);
      expect(t.text.length, t.titel).toBeGreaterThan(60);
    }
  });
  it('Tipps eines Kantons nur bei einer Parzelle dort, vor der Suche keine', () => {
    for (const m of MARKEN) {
      expect(tippsFuer(m.schwerpunkt, false).filter(t => t.kanton)).toEqual([]);
      expect(tippsFuer(m.schwerpunkt, true, 'ZG').filter(t => t.kanton && t.kanton !== 'ZG')).toEqual([]);
      expect(tippsFuer(m.schwerpunkt, true).length).toBeLessThanOrEqual(6);
    }
    expect(tippsFuer('haus', true, 'ZH')[0].titel).toBe('Öl oder Gas ersetzen im Kanton Zürich');
    expect(tippsFuer('haus', true, 'LU').map(t => t.titel)).toContain('Öl oder Gas ersetzen im Kanton Luzern');
  });
  it('jede Marke zeigt Tipps', () => {
    for (const m of MARKEN) expect(tippsFuer(m.schwerpunkt).length, m.id).toBeGreaterThanOrEqual(2);
  });
});

describe('Angaben und Bericht', () => {
  it('Name, Adresse, Telefon, dann die E-Mail freiwillig', () => {
    const reihe = [...seite.matchAll(/\{ k: '(\w+)', frage:/g)].map(m => m[1]);
    expect(reihe).toEqual(['name', 'adresse', 'telefon', 'email']);
    expect(seite).toContain("email: kontakt.email.trim() || null");
    expect(seite).toMatch(/email: !kontakt\.email\.trim\(\) \|\| mailOk/);
    expect(seite).toContain('angaben.wohnadresse =');
  });
  it('die Wohnadresse braucht Strasse oder Ort und eine Zahl', () => {
    expect(wohnadresseOk('Seestrasse 12, 8810 Horgen')).toBe(true);
    expect(wohnadresseOk('Dorf 3')).toBe(true);
    expect(wohnadresseOk('Horgen')).toBe(false);
    expect(wohnadresseOk('12345')).toBe(false);
  });
  it('das PDF gibt es erst nach den Angaben, nicht als Druck der Seite', () => {
    expect(seite).not.toContain('window.print()');
    const pdf = seite.indexOf('Bericht als PDF herunterladen');
    expect(pdf).toBeGreaterThan(seite.indexOf('{schritt === 3 && ('));
    expect(seite.match(/pdfLaden\(\)/g)?.length).toBe(1);
  });
  it('der nächste Schritt steht vor den Einzelheiten', () => {
    expect(seite.indexOf('className={`tafel wegweiser')).toBeLessThan(seite.indexOf('tafel einzelheiten'));
    expect(seite.indexOf('tafel kurz')).toBeLessThan(seite.indexOf('className={`tafel wegweiser'));
  });
});

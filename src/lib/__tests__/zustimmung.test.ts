import { beforeEach, describe, expect, it } from 'vitest';
import { darfWerben, setzeZustimmung, zustimmung } from '../zustimmung';

describe('Cookie-Zustimmung', () => {
  beforeEach(() => localStorage.clear());
  it('fragt, solange nichts gewählt ist', () => {
    expect(zustimmung()).toBeNull();
    expect(darfWerben()).toBe(false);
  });
  it('Werbung nur nach «Einverstanden»', () => {
    setzeZustimmung('noetig');
    expect(darfWerben()).toBe(false);
    setzeZustimmung('alle');
    expect(darfWerben()).toBe(true);
  });
  it('fragt nach einem Jahr neu und nach «Cookie-Einstellungen» sofort', () => {
    const t = Date.UTC(2026, 10, 15);
    setzeZustimmung('alle', t);
    expect(zustimmung(t + 364 * 864e5)).toBe('alle');
    expect(zustimmung(t + 366 * 864e5)).toBeNull();
    setzeZustimmung(null);
    expect(zustimmung()).toBeNull();
  });
  it('übersteht Unsinn im Speicher', () => {
    localStorage.setItem('pc-zustimmung', '{kaputt');
    expect(zustimmung()).toBeNull();
    localStorage.setItem('pc-zustimmung', JSON.stringify({ wahl: 'alles', am: Date.now() }));
    expect(zustimmung()).toBeNull();
  });
});

describe('Meta-Pixel', () => {
  it('lädt nur nach «Einverstanden»', async () => {
    const quelle = (await import('node:fs')).readFileSync('src/lib/meta-pixel.ts', 'utf8');
    // Die einzige öffentliche Funktion prüft die Zustimmung, bevor sie lädt.
    expect(quelle).toMatch(/export function pixel[\s\S]*?!darfWerben\(\)\) return;[\s\S]*?laden\(/);
  });
});

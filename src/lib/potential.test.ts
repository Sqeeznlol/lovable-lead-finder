import { describe, it, expect } from 'vitest';
import {
  calculatePotential,
  potentialScore,
  potentialTier,
  resolveAz,
  DEFAULT_POTENTIAL_CONFIG,
} from './potential';

describe('resolveAz', () => {
  it('bevorzugt die Ausnützungsziffer am Objekt', () => {
    expect(resolveAz({ zone: 'W3', ausnuetzung: 0.9 })).toEqual({ az: 0.9, quelle: 'objekt' });
  });
  it('fällt auf die Zonentabelle zurück', () => {
    expect(resolveAz({ zone: 'W3' })).toEqual({ az: 0.6, quelle: 'zone' });
  });
  it('normalisiert Zonen-Schreibweisen', () => {
    expect(resolveAz({ zone: 'w4g ' }).az).toBe(0.8);
    expect(resolveAz({ zone: 'W3 (3 Vollgeschosse)' }).az).toBe(0.6);
  });
  it('liefert null ohne Zone', () => {
    expect(resolveAz({}).az).toBeNull();
  });
});

describe('calculatePotential', () => {
  it('rechnet Reserve und Investition für ein klassisches Ausbau-Objekt', () => {
    const r = calculatePotential({
      zone: 'W3', area: 1200, gebaeudeflaeche: 150, geschosse: 2, baujahr: 1955,
    });
    // 1200 * 0.6 = 720 zulässig, 150 * 2 = 300 Bestand
    expect(r.gfZulaessig).toBe(720);
    expect(r.gfBestand).toBe(300);
    expect(r.reserveGf).toBe(420);
    expect(r.reserveQuote).toBeCloseTo(0.583, 2);
    expect(r.hnfDelta).toBe(336);          // 420 * 0.8
    expect(r.investition).toBe(420 * 3200);
    expect(r.erloes).toBe(336 * 9500);
    expect(r.marge).toBe(336 * 9500 - 420 * 3200);
    expect(r.confidence).toBe('mittel');
    expect(r.killer).toHaveLength(0);
  });

  it('kappt die Reserve bei überbauten Parzellen und markiert sie', () => {
    const r = calculatePotential({ zone: 'W2', area: 500, gebaeudeflaeche: 200, geschosse: 3 });
    expect(r.ueberbaut).toBe(true);
    expect(r.reserveGf).toBe(0);
    expect(r.killer).toContain('Bestand überschreitet Zone (Besitzstand)');
  });

  it('nimmt ohne Geschossangabe konservativ 2 Vollgeschosse an', () => {
    const r = calculatePotential({ zone: 'W3', area: 1000, gebaeudeflaeche: 100 });
    expect(r.gfBestand).toBe(200);
    expect(r.confidence).toBe('tief');
    expect(r.assumptions.join(' ')).toContain('2 Vollgeschosse');
  });

  it('meldet Denkmalschutz und ISOS als Killer', () => {
    const r = calculatePotential({
      zone: 'W4', area: 2000, gebaeudeflaeche: 200, geschosse: 2,
      denkmalschutz: 'kommunal', isos: 'A',
    });
    expect(r.killer).toContain('Denkmalschutz');
    expect(r.killer).toContain('ISOS-Ortsbild');
  });

  it('liefert null-Werte statt Fantasiezahlen, wenn Daten fehlen', () => {
    const r = calculatePotential({ area: null, gebaeudeflaeche: null });
    expect(r.reserveGf).toBeNull();
    expect(r.investition).toBeNull();
    expect(r.confidence).toBe('keine');
  });
});

describe('potentialScore', () => {
  it('bewertet grosse ungenutzte Reserve hoch', () => {
    const gut = potentialScore({ zone: 'W4', area: 3000, gebaeudeflaeche: 200, geschosse: 2, baujahr: 1950 });
    const schlecht = potentialScore({ zone: 'W2', area: 400, gebaeudeflaeche: 180, geschosse: 2, baujahr: 2015 });
    expect(gut).toBeGreaterThan(schlecht);
    expect(gut).toBeGreaterThan(70);
  });

  it('zieht Killer-Kriterien ab', () => {
    const base = { zone: 'W4', area: 3000, gebaeudeflaeche: 200, geschosse: 2, baujahr: 1950 };
    expect(potentialScore({ ...base, denkmalschutz: 'kantonal' })).toBeLessThan(potentialScore(base));
  });

  it('gibt 0 zurück, wenn nichts berechenbar ist', () => {
    expect(potentialScore({})).toBe(0);
  });

  it('bleibt im Bereich 0–100', () => {
    const s = potentialScore({ zone: 'W7', area: 20000, gebaeudeflaeche: 50, geschosse: 1, baujahr: 1900 });
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('potentialTier', () => {
  it('mappt Scores auf Tiers', () => {
    expect(potentialTier(85)).toBe('A');
    expect(potentialTier(55)).toBe('B');
    expect(potentialTier(35)).toBe('C');
    expect(potentialTier(10)).toBe('D');
  });
});

describe('Konfiguration', () => {
  it('respektiert abweichende Baukosten', () => {
    const p = { zone: 'W3', area: 1000, gebaeudeflaeche: 100, geschosse: 2 };
    const teuer = calculatePotential(p, { ...DEFAULT_POTENTIAL_CONFIG, baukostenProM2GF: 5000 });
    expect(teuer.investition).toBe(400 * 5000);
  });
});

// Paritätstest: dieselben Zeilen wurden gegen die SQL-Migration
// (supabase/migrations/20260825190000_potenzial_berechnung.sql) auf einer
// lokalen Postgres-16-Instanz gerechnet. Frontend und Datenbank müssen
// dieselben Zahlen liefern, sonst driften Liste und Karte auseinander.
describe('Parität zur SQL-Berechnung', () => {
  const faelle = [
    { p: { zone: 'W3 (3 Vollgeschosse)', area: 1200, gebaeudeflaeche: 150, geschosse: 2, baujahr: 1955 }, reserveGf: 420, score: 69 },
    { p: { zone: 'W2', area: 500, gebaeudeflaeche: 200, geschosse: 3, baujahr: 1970 }, reserveGf: 0, score: 0 },
    { p: { zone: 'W3', area: 1000, gebaeudeflaeche: 100, baujahr: 1980 }, reserveGf: 400, score: 61 },
    { p: { zone: 'W4', area: 2000, gebaeudeflaeche: 200, geschosse: 2, baujahr: 1910, denkmalschutz: 'kantonal' }, reserveGf: 1100, score: 64 },
  ];

  it.each(faelle)('stimmt mit Postgres überein: $p.zone', ({ p, reserveGf, score }) => {
    expect(calculatePotential(p).reserveGf).toBe(reserveGf);
    expect(potentialScore(p)).toBe(score);
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculatePotential,
  potentialScore,
  potentialTier,
  resolveAz,
  parseZone,
  istVorhanden,
  istAusgeschlossen,
  ausschlussGrund,
  DEFAULT_POTENTIAL_CONFIG,
} from './potential';

/** Zonentabellen-Modus: Ziffer im Namen als AZ lesen (für die W3-Kurzformen). */
const ALS_AZ = { ...DEFAULT_POTENTIAL_CONFIG, zifferAlsBmz: false };

describe('resolveAz', () => {
  it('bevorzugt die Ausnützungsziffer am Objekt', () => {
    const r = resolveAz({ zone: 'W3', ausnuetzung: 0.9 });
    expect(r.az).toBe(0.9);
    expect(r.quelle).toBe('objekt');
  });
  it('fällt auf die Zonentabelle zurück', () => {
    const r = resolveAz({ zone: 'W3' });
    expect(r.az).toBe(0.6);
    expect(r.quelle).toBe('zone');
  });
  it('normalisiert Zonen-Schreibweisen', () => {
    expect(resolveAz({ zone: 'w4g ' }).az).toBe(0.8);
    expect(resolveAz({ zone: 'W3 (3 Vollgeschosse)' }).az).toBe(0.6);
  });

  it('liest die Ziffer aus dem ZH-Freitext als BMZ', () => {
    // "Wohnzone 1.6" -> BMZ 1.6 : 3.2 m Geschosshöhe = AZ 0.5
    const r = resolveAz({ zone: 'Wohnzone 1.6 (rechtskräftig, 8460m², 95%)' });
    expect(r.az).toBeCloseTo(0.5, 3);
    expect(r.quelle).toBe('zone');
  });

  it('rechnet "Wohnzone 2/50" aus Geschossen und Überbauungsziffer', () => {
    expect(resolveAz({ zone: 'Wohnzone 2/50' }).az).toBeCloseTo(1.0, 3);
  });

  it('vergibt für Nicht-Bauzonen keine Ausnützung', () => {
    expect(resolveAz({ zone: 'Kantonale Landwirtschaftszone' }).az).toBeNull();
    expect(resolveAz({ zone: 'Wald' }).az).toBeNull();
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
    // HNF nach Praxisformel: 720 / 2 VG x 2.66 anrechenbare x 0.77 = 737 m²,
    // abzüglich Bestand 300 x 0.77 = 231 m²
    expect(r.hnfNeu).toBe(737);
    expect(r.hnfBestand).toBe(231);
    expect(r.hnfDelta).toBe(506);
    expect(r.investition).toBe(420 * 3200);
    // Erlös und Marge rechnen mit der ungerundeten HNF (506.352 m²)
    expect(r.erloes).toBeCloseTo(506.352 * 9500, 0);
    expect(r.marge).toBeCloseTo(506.352 * 9500 - 420 * 3200, 0);
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
  it('bewertet grosse erreichbare HNF hoch', () => {
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
    { p: { zone: 'W3 (3 Vollgeschosse)', area: 1200, gebaeudeflaeche: 150, geschosse: 2, baujahr: 1955 }, reserveGf: 420, score: 71 },
    { p: { zone: 'W2', area: 500, gebaeudeflaeche: 200, geschosse: 3, baujahr: 1970 }, reserveGf: 0, score: 0 },
    { p: { zone: 'W3', area: 1000, gebaeudeflaeche: 100, baujahr: 1980 }, reserveGf: 400, score: 62 },
    { p: { zone: 'W4', area: 2000, gebaeudeflaeche: 200, geschosse: 2, baujahr: 1910, denkmalschutz: 'kantonal' }, reserveGf: 1100, score: 73 },
    // ZH-Freitext: BMZ 1.6 : 3.2 m = AZ 0.5
    { p: { zone: 'Wohnzone 1.6 (rechtskräftig, 8460m², 95%)', area: 1200, gebaeudeflaeche: 150, geschosse: 2, baujahr: 1955, denkmalschutz: 'nicht vorhanden' }, reserveGf: 300, score: 67 },
    // Geschosse/Überbauungsziffer: 2 x 50% = AZ 1.0
    { p: { zone: 'Wohnzone 2/50', area: 1200, gebaeudeflaeche: 150, geschosse: 2, baujahr: 1955, denkmalschutz: 'nicht vorhanden' }, reserveGf: 900, score: 89 },
  ];

  it.each(faelle)('stimmt mit Postgres überein: $p.zone', ({ p, reserveGf, score }) => {
    expect(calculatePotential(p).reserveGf).toBe(reserveGf);
    expect(potentialScore(p)).toBe(score);
  });
});


describe('parseZone (ZH-Freitext)', () => {
  it('ignoriert den Klammerzusatz mit den Zonenflächen', () => {
    // Das "8460m²" gehört zur Zone, nicht zum Grundstück — darf nicht als Ziffer gelesen werden.
    expect(parseZone('Wohnzone 1.6 (rechtskräftig, 8460m², 95%)').ziffer).toBe(1.6);
  });
  it('erkennt Geschosse im Namen', () => {
    expect(parseZone('3-geschossige Wohnzone 2.5').geschosse).toBe(3);
    expect(parseZone('2-geschossige Wohnzone, dicht 1.9').ziffer).toBe(1.9);
  });
  it('erkennt Geschosse/Überbauungsziffer', () => {
    const z = parseZone('Wohnzone 2/50');
    expect(z.geschosse).toBe(2);
    expect(z.ueberbauungsziffer).toBe(50);
  });
  it('markiert Nicht-Bauzonen', () => {
    expect(parseZone('Kantonale Landwirtschaftszone').keineBauzone).toBe(true);
    expect(parseZone('Wald').keineBauzone).toBe(true);
    expect(parseZone('Wohnzone 2.0').keineBauzone).toBe(false);
  });
  it('erkennt die Kurzform weiterhin', () => {
    expect(parseZone('W4G').kurz).toBe('W4G');
  });
});

describe('istVorhanden', () => {
  it('liest "nicht vorhanden" als leer', () => {
    // 94% der Zeilen tragen diesen Text — sonst gälte fast jedes Objekt als geschützt.
    expect(istVorhanden('nicht vorhanden')).toBe(false);
    expect(istVorhanden('Kein Denkmalschutzobjekt im Perimeter')).toBe(false);
    expect(istVorhanden(null)).toBe(false);
    expect(istVorhanden('vorhanden')).toBe(true);
    expect(istVorhanden('Kantonal geschützt')).toBe(true);
  });

  it('setzt kein Killer-Kriterium für "nicht vorhanden"', () => {
    const r = calculatePotential({
      zone: 'Wohnzone 2.0', area: 2000, gebaeudeflaeche: 200, geschosse: 2,
      denkmalschutz: 'nicht vorhanden', isos: 'nicht vorhanden',
    });
    expect(r.killer).not.toContain('Denkmalschutz');
    expect(r.killer).not.toContain('ISOS-Ortsbild');
  });

  it('markiert Nicht-Bauzonen als Killer', () => {
    const r = calculatePotential({ zone: 'Wald', area: 5000, gebaeudeflaeche: 100, geschosse: 1 });
    expect(r.killer).toContain('Keine Bauzone');
  });
});

describe('istAusgeschlossen', () => {
  it('schliesst Nicht-Bauzonen und geschützte Objekte aus', () => {
    expect(istAusgeschlossen({ zone: 'Kantonale Landwirtschaftszone' })).toBe(true);
    expect(istAusgeschlossen({ zone: 'Wald' })).toBe(true);
    expect(istAusgeschlossen({ zone: 'Wohnzone 2.0', denkmalschutz: 'vorhanden' })).toBe(true);
  });
  it('lässt normale Wohnzonen drin', () => {
    expect(istAusgeschlossen({ zone: 'Wohnzone 2.0', denkmalschutz: 'nicht vorhanden' })).toBe(false);
  });
  it('nennt den Grund', () => {
    expect(ausschlussGrund({ zone: 'Wald' })).toBe('Keine Bauzone');
    expect(ausschlussGrund({ zone: 'Wohnzone 2.0' })).toBeNull();
  });
});

describe('Nicht-Bauzone: Wortgrenzen', () => {
  it('erkennt echte Waldzonen', () => {
    expect(parseZone('Wald').keineBauzone).toBe(true);
    expect(parseZone('Waldzone').keineBauzone).toBe(true);
    expect(parseZone('Übriges Gebiet, Wald').keineBauzone).toBe(true);
  });
  it('lässt sich von Namen mit "wald" nicht täuschen', () => {
    // Die Gemeinde Wald (ZH) und Flurnamen wie Waldegg sind keine Waldzonen.
    expect(parseZone('Wohnzone 2.0 Waldegg').keineBauzone).toBe(false);
    expect(parseZone('Kernzone Waldhof').keineBauzone).toBe(false);
  });
});

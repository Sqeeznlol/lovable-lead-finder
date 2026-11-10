import { describe, expect, it } from 'vitest';
import { azAnnahme, zusammenRechnen, type ZusammenDaten } from './arrondierung-zusammen';

const leer: ZusammenDaten = {
  flaeche: null, gebaeude: null, baujahr: null, wohnungen: null, gf_heute: null, zone: null, umriss: null,
  haupt_flaeche: null, haupt_gebaeude: null, haupt_baujahr: null, haupt_wohnungen: null, haupt_gf_heute: null, haupt_zone: null, haupt_umriss: null,
};

describe('zusammenRechnen', () => {
  it('zählt beide Seiten zusammen und rechnet HNF als 80 % der Geschossfläche', () => {
    const r = zusammenRechnen({ ...leer, haupt_flaeche: 1000, haupt_gf_heute: 600, flaeche: 500, gf_heute: 150 }, 0.8, 10);
    expect(r.fl).toBe(1500);
    expect(r.gfHeute).toBe(750);
    expect(r.hnfHeute).toBe(600);
    expect(r.gfMoeglich).toBe(1200); // unter 3000 m² kein Bonus
    expect(r.mehrHnf).toBe(360);
    expect(r.azHeute).toBeCloseTo(0.5);
  });
  it('gibt den Bonus erst ab 3000 m² zusammen', () => {
    const r = zusammenRechnen({ ...leer, haupt_flaeche: 2500, flaeche: 500 }, 1, 10);
    expect(r.areal).toBe(true);
    expect(r.gfMoeglich).toBe(3300);
  });
  it('meldet nie ein negatives Mehr, wenn heute schon mehr gebaut ist', () => {
    expect(zusammenRechnen({ ...leer, haupt_flaeche: 100, haupt_gf_heute: 900 }, 0.5, 0).mehrHnf).toBe(0);
  });
  it('nimmt die Ausnützung nach Zonenart an', () => {
    expect(azAnnahme('Zentrumszonen')).toBe(1.3);
    expect(azAnnahme('Mischzonen')).toBe(1.0);
    expect(azAnnahme('Wohnzonen')).toBe(0.8);
    expect(azAnnahme(null)).toBe(0.8);
  });
  it('nimmt die Ausnützung der eigenen Liegenschaft, wenn sie höher ist (Amriswil 1,55)', () => {
    expect(azAnnahme('Mischzonen', 5496 / 3554)).toBe(1.55);
    expect(azAnnahme('Wohnzonen', 0.3)).toBe(0.8);
  });
});

import { describe, it, expect } from 'vitest';
import { aggregateByParzelle, masterRowToImportJson, type MasterRow } from './master-import';

const zeile = (r: Partial<MasterRow>): MasterRow => ({ address: 'Teststrasse 1', ...r });

describe('aggregateByParzelle', () => {
  it('addiert Gebäudeflächen und Wohnungen derselben Parzelle', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', gebaeudeflaeche: 200, wohnungen: 4, area: 3000 }),
      zeile({ egrid: 'CH1', gebaeudeflaeche: 150, wohnungen: 3, area: 3000 }),
      zeile({ egrid: 'CH1', gebaeudeflaeche: 100, wohnungen: 2, area: 3000 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].gebaeudeflaeche).toBe(450);
    expect(out[0].wohnungen).toBe(9);
    expect(out[0].gebaeude_anzahl).toBe(3);
  });

  it('addiert die Grundstücksfläche NICHT — sie gilt für die ganze Parzelle', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', area: 3000, gebaeudeflaeche: 200 }),
      zeile({ egrid: 'CH1', area: 3000, gebaeudeflaeche: 150 }),
    ]);
    expect(out[0].area).toBe(3000);
  });

  it('nimmt das älteste Baujahr und die höchste Geschosszahl', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', baujahr: 1980, geschosse: 2 }),
      zeile({ egrid: 'CH1', baujahr: 1955, geschosse: 4 }),
      zeile({ egrid: 'CH1', baujahr: 1970, geschosse: 3 }),
    ]);
    expect(out[0].baujahr).toBe(1955);
    expect(out[0].geschosse).toBe(4);
  });

  it('füllt leere Felder aus den Geschwisterzeilen auf', () => {
    // In den echten Listen steht die Zone oft nur an einer der Zeilen.
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', zone: null, gemeinde: 'Truttikon' }),
      zeile({ egrid: 'CH1', zone: 'Wohnzone 2.0', gemeinde: null }),
    ]);
    expect(out[0].zone).toBe('Wohnzone 2.0');
    expect(out[0].gemeinde).toBe('Truttikon');
  });

  it('überschreibt vorhandene Werte nicht', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', zone: 'Wohnzone 2.0' }),
      zeile({ egrid: 'CH1', zone: 'Kernzone' }),
    ]);
    expect(out[0].zone).toBe('Wohnzone 2.0');
  });

  it('lässt verschiedene Parzellen getrennt', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', gebaeudeflaeche: 200 }),
      zeile({ egrid: 'CH2', gebaeudeflaeche: 150 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(r => r.gebaeude_anzahl)).toEqual([1, 1]);
  });

  it('lässt Zeilen ohne EGRID unangetastet', () => {
    // Ohne EGRID lässt sich keine Parzelle sicher zuordnen.
    const out = aggregateByParzelle([
      zeile({ egrid: null, gebaeudeflaeche: 200 }),
      zeile({ egrid: '', gebaeudeflaeche: 150 }),
      zeile({ egrid: undefined, gebaeudeflaeche: 100 }),
    ]);
    expect(out).toHaveLength(3);
  });

  it('kommt mit fehlenden Zahlen zurecht', () => {
    const out = aggregateByParzelle([
      zeile({ egrid: 'CH1', gebaeudeflaeche: null, wohnungen: null }),
      zeile({ egrid: 'CH1', gebaeudeflaeche: 150, wohnungen: null }),
    ]);
    expect(out[0].gebaeudeflaeche).toBe(150);
    expect(out[0].wohnungen).toBeNull();
  });
});

describe('masterRowToImportJson', () => {
  it('macht leere Strings zu null, damit sie gute Daten nicht überschreiben', () => {
    const j = masterRowToImportJson(zeile({ egrid: 'CH1', gemeinde: '  ', zone: '' }));
    expect(j.gemeinde).toBeNull();
    expect(j.zone).toBeNull();
  });

  it('wandelt Zahlenfelder sauber um', () => {
    const j = masterRowToImportJson(zeile({ area: '1200' as never, baujahr: 1955, geschosse: null }));
    expect(j.area).toBe(1200);
    expect(j.baujahr).toBe(1955);
    expect(j.geschosse).toBeNull();
  });

  it('verwirft unbrauchbare Zahlen statt NaN zu senden', () => {
    const j = masterRowToImportJson(zeile({ area: 'keine Angabe' as never }));
    expect(j.area).toBeNull();
  });

  it('setzt Vorgaben für Kanton, Gebäudestatus und Adresse', () => {
    const j = masterRowToImportJson({ address: '', parzelle: '914' });
    expect(j.address).toBe('Parzelle 914');
    expect(j.kanton).toBe('ZH');
    expect(j.geb_status).toBe('Bestehend');
  });
})

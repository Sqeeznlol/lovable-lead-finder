import { describe, it, expect } from 'vitest';
import { aggregateByParzelle, masterRowToImportJson, ParzellenSammler, type MasterRow } from './master-import';

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
  it('lässt leere Felder ganz weg, statt sie als null zu senden', () => {
    // Fehlende Schlüssel liest die Datenbank als NULL. Bei über einer
    // Million Zeilen spart das Weglassen die halbe Übertragungsmenge.
    const j = masterRowToImportJson(zeile({ egrid: 'CH1', gemeinde: '  ', zone: '' }));
    expect('gemeinde' in j).toBe(false);
    expect('zone' in j).toBe(false);
    expect(j.egrid).toBe('CH1');
  });

  it('wandelt Zahlenfelder sauber um', () => {
    const j = masterRowToImportJson(zeile({ area: '1200' as never, baujahr: 1955, geschosse: null }));
    expect(j.area).toBe(1200);
    expect(j.baujahr).toBe(1955);
    expect('geschosse' in j).toBe(false);
  });

  it('verwirft unbrauchbare Zahlen statt NaN zu senden', () => {
    const j = masterRowToImportJson(zeile({ area: 'keine Angabe' as never }));
    expect('area' in j).toBe(false);
  });

  it('setzt Vorgaben für Kanton, Gebäudestatus und Adresse', () => {
    const j = masterRowToImportJson({ address: '', parzelle: '914' });
    expect(j.address).toBe('Parzelle 914');
    expect(j.kanton).toBe('ZH');
    expect(j.geb_status).toBe('Bestehend');
  });
})


describe('ParzellenSammler', () => {
  it('führt dieselbe Parzelle über Dateigrenzen hinweg zusammen', () => {
    // Genau der Fall der echten Listen: dieselbe Parzelle steht in mehreren
    // Dateien, jede mit einem anderen Teil der Information.
    const sammler = new ParzellenSammler();
    sammler.add([zeile({ egrid: 'CH1', gebaeudeflaeche: 200, area: 3000 })]);
    sammler.add([zeile({ egrid: 'CH1', zone: 'Wohnzone 2.0', baujahr: 1960 })]);
    sammler.add([zeile({ egrid: 'CH1', gemeinde: 'Truttikon' })]);

    const out = sammler.ergebnis();
    expect(out).toHaveLength(1);
    expect(out[0].zone).toBe('Wohnzone 2.0');
    expect(out[0].baujahr).toBe(1960);
    expect(out[0].gemeinde).toBe('Truttikon');
    expect(out[0].area).toBe(3000);
    expect(sammler.eingelesen).toBe(3);
    expect(sammler.parzellen).toBe(1);
  });

  it('zählt Gebäude und addiert deren Flächen', () => {
    const sammler = new ParzellenSammler();
    sammler.add([
      zeile({ egrid: 'CH1', gebaeudeflaeche: 200, wohnungen: 4 }),
      zeile({ egrid: 'CH1', gebaeudeflaeche: 150, wohnungen: 3 }),
    ]);
    sammler.add([zeile({ egrid: 'CH1', gebaeudeflaeche: 100, wohnungen: 2 })]);

    const out = sammler.ergebnis();
    expect(out[0].gebaeudeflaeche).toBe(450);
    expect(out[0].wohnungen).toBe(9);
    expect(out[0].gebaeude_anzahl).toBe(3);
  });

  it('hält Zeilen ohne EGRID auseinander', () => {
    const sammler = new ParzellenSammler();
    sammler.add([zeile({ egrid: null }), zeile({ egrid: '' })]);
    sammler.add([zeile({ egrid: undefined })]);
    expect(sammler.ergebnis()).toHaveLength(3);
  });

  it('überschreibt nie einen bereits vorhandenen Wert', () => {
    const sammler = new ParzellenSammler();
    sammler.add([zeile({ egrid: 'CH1', zone: 'Wohnzone 2.0' })]);
    sammler.add([zeile({ egrid: 'CH1', zone: 'Kernzone' })]);
    expect(sammler.ergebnis()[0].zone).toBe('Wohnzone 2.0');
  });
});

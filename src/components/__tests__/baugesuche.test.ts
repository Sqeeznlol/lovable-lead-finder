import { describe, expect, it } from 'vitest';
import { filtern, type Gesuch } from '../Baugesuche';

const g = (id: string, tag: string, x: Partial<Gesuch> = {}): Gesuch => ({
  id, publiziert_am: tag, gemeinde: 'Zürich', adresse: `Weg ${id}`, parzelle_nr: null, egrid: null,
  beschreibung: 'Umbau', bauherrschaft: null, parzelle_id: null, nachbar_egrids: null, erfasst_am: tag, quelle: 'zh-statistik', ...x,
});
const heute = new Date('2026-11-01T12:00:00Z');

describe('Baugesuche filtern', () => {
  const alle = [g('a', '2026-10-31', { parzelle_id: 'p1' }), g('b', '2026-10-20', { gemeinde: 'Kloten', beschreibung: 'Neubau MFH' }), g('c', '2026-10-30')];
  it('nach Zeitraum', () => {
    expect(filtern(alle, new Set(), 'alle', 7, '', heute).map(x => x.id)).toEqual(['a', 'c']);
    expect(filtern(alle, new Set(), 'alle', 0, '', heute).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('nur im Bestand oder nur mit Gelegenheit', () => {
    expect(filtern(alle, new Set(), 'bestand', 0, '', heute).map(x => x.id)).toEqual(['a']);
    expect(filtern(alle, new Set(['c']), 'gelegenheit', 0, '', heute).map(x => x.id)).toEqual(['c']);
  });
  it('Suchwort in Gemeinde oder Vorhaben, ohne Gross/klein', () => {
    expect(filtern(alle, new Set(), 'alle', 0, 'kloten', heute).map(x => x.id)).toEqual(['b']);
    expect(filtern(alle, new Set(), 'alle', 0, 'mfh', heute).map(x => x.id)).toEqual(['b']);
  });
});

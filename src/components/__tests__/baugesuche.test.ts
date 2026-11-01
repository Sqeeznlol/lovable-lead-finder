import { describe, expect, it } from 'vitest';
import { belege, filtern, type Gesuch } from '../Baugesuche';

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

describe('Baugesuche belege', () => {
  it('Publikation, Daten und Quelle, wenn vorhanden', () => {
    const b = belege(g('x', '2026-10-30', { publikation_nr: 'BP-ZH01-0000063847', publikation_id: '002c93ff-b600-4881-a70e-4fd3289e2092', quelle_url: 'https://daten.statistik.zh.ch/q.csv' }));
    expect(b.map(x => x.titel)).toEqual(['Publikation im Amtsblatt', 'Publikation als PDF', 'Quelle']);
    expect(b[0].url).toBe('https://amtsblatt.zh.ch/#!/search/publications/detail/002c93ff-b600-4881-a70e-4fd3289e2092');
    expect(b[1].url).toBe('https://amtsblatt.zh.ch/api/v1/publications/002c93ff-b600-4881-a70e-4fd3289e2092/pdf');
  });
  it('ohne Publikation keine erfundenen Links', () => {
    expect(belege(g('y', '2026-10-30'))).toEqual([]);
  });
});

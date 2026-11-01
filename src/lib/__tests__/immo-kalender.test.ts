import { describe, expect, it } from 'vitest';
import { ANLAESSE, ical, inTagen, ordnen, zeitraum, type Anlass } from '@/lib/immo-kalender';

const a = (von: string | null, bis: string | null = null): Anlass => ({
  name: 'X', art: 'messe', von, bis, ort: 'Zürich', haus: null, adresse: null, land: 'CH', url: 'https://x.ch', fuer: '', quelle: null, bemerkung: '',
});

describe('Immo-Kalender', () => {
  it('jeder Anlass mit Datum hat eine Quelle, Ende nicht vor Beginn', () => {
    for (const x of ANLAESSE) {
      if (x.von) expect(x.quelle, x.name).toBeTruthy();
      if (x.von && x.bis) expect(x.bis >= x.von, x.name).toBe(true);
      expect(x.url.startsWith('https://'), x.name).toBe(true);
    }
  });
  it('Vergangenes fällt weg, Laufendes bleibt, ohne Datum separat', () => {
    const o = ordnen([a('2026-10-01', '2026-10-02'), a('2026-10-31', '2026-11-02'), a('2027-01-13'), a(null)], '2026-11-01');
    expect(o.datiert.map(x => x.von)).toEqual(['2026-10-31', '2027-01-13']);
    expect(o.offen).toHaveLength(1);
    expect([...o.monate.keys()]).toEqual(['2026-10', '2027-01']);
  });
  it('Zeitraum lesbar', () => {
    expect(zeitraum(a('2027-01-13', '2027-01-14'))).toMatch(/^13\.–14\. Jan/);
    expect(zeitraum(a('2027-10-28'))).toMatch(/^28\. Okt/);
    expect(zeitraum(a(null))).toBe('Datum offen');
    expect(inTagen(a('2026-11-03'), '2026-11-01')).toBe(2);
  });
  it('iCal ganztägig, Ende am Tag danach', () => {
    const t = ical(a('2027-01-13', '2027-01-14'));
    expect(t).toContain('DTSTART;VALUE=DATE:20270113');
    expect(t).toContain('DTEND;VALUE=DATE:20270115');
  });
});

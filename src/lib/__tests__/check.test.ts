import { describe, expect, it } from 'vitest';
import { MARKEN, markeFuerHost } from '@/lib/check-marken';
import { haeuserAus, herkunft, leadAngaben, prioritaet, ueberbauung } from '@/lib/check-daten';

describe('Marken der Check-Seiten', () => {
  it('erkennt die Marke am Hostnamen, auch mit www und Port', () => {
    expect(markeFuerHost('parzellenchecker.ch')?.id).toBe('parzellenchecker');
    expect(markeFuerHost('www.hauschecker.ch')?.id).toBe('hauschecker');
    expect(markeFuerHost('WasDarfIchBauen.ch:443')?.id).toBe('wasdarfichbauen');
    expect(markeFuerHost('wohntraums.life')).toBeNull();
    expect(markeFuerHost('127.0.0.1')).toBeNull();
  });
  it('jede Domain gehört zu genau einer Marke', () => {
    const alle = MARKEN.flatMap(m => m.domains);
    expect(new Set(alle).size).toBe(alle.length);
  });
});

describe('Lead', () => {
  it('heiss nur mit Eigentum, Absicht verkaufen oder bauen und 12 Monaten', () => {
    expect(prioritaet({ eigentuemer: 'erbengemeinschaft', absicht: 'verkaufen', zeitraum: '12' })).toBe('heiss');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'bauen', zeitraum: '12' })).toBe('heiss');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '36' })).toBe('warm');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'informieren', zeitraum: '12' })).toBe('normal');
    expect(prioritaet({ eigentuemer: 'nein', absicht: 'verkaufen', zeitraum: '12' })).toBe('normal');
  });
  it('nimmt nur Werbeherkunft aus der Adresse, nichts anderes', () => {
    expect(herkunft('?utm_source=google&utm_campaign=zh-verkaufen&gclid=abc&x=1')).toEqual({ utm_source: 'google', utm_campaign: 'zh-verkaufen', gclid: 'abc' });
  });
  it('Gebäude: nur diese Parzelle, ohne Abbruch, bestehende zuerst; Überbauung aus bestehenden', () => {
    // Bodenacherstrasse 79, Benglen, am 6. November beim Bund
    const h = haeuserAus([
      { egid: 192122563, egrid: 'CH545639778444', strname_deinr: 'Bodenacherstrasse 79a', gstat: 1001, ganzwhg: 5, gastw: 3 },
      { egid: 96093, egrid: 'CH545639778444', strname_deinr: 'Bodenacherstrasse 79', gstat: 1004, garea: 237, ganzwhg: 16, gbauj: 1973, genh1: 7520 },
      { egid: 1, egrid: 'CH545639778444', gstat: 1007, garea: 999 },
      { egid: 2, egrid: 'CH000000000000', gstat: 1004, garea: 50 },
    ], 'CH545639778444');
    expect(h.map(x => x.egid)).toEqual([96093, 192122563]);
    expect(ueberbauung({ flaeche: 2119, haeuser: h })).toEqual({ flaeche: 237, anteil: 11 });
    const a = leadAngaben({ marke: 'parzellenchecker', domain: 'parzellenchecker.ch', herkunft: { utm_source: 'meta' },
      antwort: { eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '12' },
      befund: { adresse: 'Bodenacherstrasse 79', nummer: '2725', egrid: 'CH545639778444', kanton: 'ZH', gemeinde: 'Fällanden', zone: 'Wohnzonen', flaeche: 2119, teile: [], haeuser: h } });
    expect(a).toMatchObject({ quelle: 'check', prioritaet: 'heiss', gebaeude: 1, wohnungen: 16, baujahr: 1973, projekt: true, utm_source: 'meta' });
    expect(JSON.stringify(a).length).toBeLessThan(2000);
  });
});

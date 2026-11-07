import { describe, expect, it } from 'vitest';
import { betragLesen, kategorie } from '../gespraech';

const g = (x: Partial<Parameters<typeof kategorie>[0]>) =>
  kategorie({ erreicht: true, verkaufsabsicht: null, ablehnungsgrund: null, kauft_selbst: false, ...x });

describe('Gespräch: Kategorie für die Reaktivierung', () => {
  it('nicht erreicht oder ohne Antwort bleibt offen', () => {
    expect(g({ erreicht: false, verkaufsabsicht: 'nein' })).toBe('offen');
    expect(g({})).toBe('offen');
  });
  it('wer verkaufen will, ist ein Deal', () => expect(g({ verkaufsabsicht: 'ja' })).toBe('deal'));
  it('Tims vier Fälle: kein Interesse, Bewertung, später, Makler', () => {
    expect(g({ verkaufsabsicht: 'nein', ablehnungsgrund: 'kein interesse' })).toBe('kein interesse');
    expect(g({ verkaufsabsicht: 'nein', ablehnungsgrund: 'bewertung' })).toBe('bewertung');
    expect(g({ verkaufsabsicht: 'nur bei preis' })).toBe('bewertung');
    expect(g({ verkaufsabsicht: 'spaeter' })).toBe('spaeter');
    expect(g({ verkaufsabsicht: 'nein', ablehnungsgrund: 'zeitpunkt' })).toBe('spaeter');
    expect(g({ verkaufsabsicht: 'nein', ablehnungsgrund: 'makler' })).toBe('makler');
  });
  it('wer selbst kauft, wird Investor -- vor allem anderen', () => {
    expect(g({ verkaufsabsicht: 'nein', kauft_selbst: true })).toBe('investor');
  });
});

describe('Betrag aus dem Gespräch', () => {
  it('liest Franken, Tausendertrennzeichen und Millionen', () => {
    expect(betragLesen("1'250'000")).toBe(1250000);
    expect(betragLesen('CHF 850 000')).toBe(850000);
    expect(betragLesen('1,2 Mio.')).toBe(1200000);
    expect(betragLesen('3m')).toBe(3000000);
    expect(betragLesen('')).toBeNull();
    expect(betragLesen('viel')).toBeNull();
  });
});

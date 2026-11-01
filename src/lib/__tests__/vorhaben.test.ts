import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { fristText, inMonaten, kaeuferAbgleich, schrittNr, titelVon } from '../vorhaben';
import { parallel } from '../parallel';

const heute = new Date('2026-11-01T12:00:00');

describe('Vorhaben', () => {
  it('Zeitraum: sechs Monate ab heute', () => {
    expect(inMonaten(6, heute)).toBe('2027-05-01');
  });
  it('Frist in Monaten, kurz vor Schluss in Tagen, danach vorbei', () => {
    expect(fristText('2027-05-01', heute)).toBe('bis Mai 2027 · noch 6 Monate');
    expect(fristText('2026-11-20', heute)).toBe('bis November 2026 · noch 19 Tage');
    expect(fristText('2026-10-01', heute)).toBe('bis Oktober 2026 · Frist vorbei');
    expect(fristText(null, heute)).toBeNull();
  });
  it('Schritte in Reihenfolge', () => {
    expect(schrittNr('eingegangen')).toBe(0);
    expect(schrittNr('akquise')).toBe(4);
    expect(titelVon('pausiert')).toBe('Pausiert');
  });
  it('Käufer: Treffer nach Gemeinde und Objektart, ohne Profil keiner', () => {
    const la = [
      { gemeinde: 'Zürich', kategorie: 'Mehrfamilienhaus', n: 7 },
      { gemeinde: 'Zürich', kategorie: 'Einfamilienhaus', n: 2 },
      { gemeinde: 'Kloten', kategorie: 'Mehrfamilienhaus', n: 3 },
    ];
    const inv = (id: string, lagen: string[] | null, objekttypen: string[] | null) => ({ id, name: id, lagen, objekttypen, budget_max_chf: null });
    const r = kaeuferAbgleich([inv('a', ['zürich'], ['MFH']), inv('b', null, ['MFH']), inv('c', null, null), inv('d', ['Uster'], null)], la);
    expect(r.map(x => [x.investor.id, x.treffer])).toEqual([['b', 10], ['a', 7]]);
  });
  it('parallel: alle genau einmal, höchstens n zugleich', async () => {
    let jetzt = 0, max = 0; const gesehen: number[] = [];
    await parallel([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, async x => {
      jetzt++; max = Math.max(max, jetzt); await new Promise(r => setTimeout(r, 5)); gesehen.push(x); jetzt--;
    });
    expect(gesehen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(max).toBe(3);
  });
});

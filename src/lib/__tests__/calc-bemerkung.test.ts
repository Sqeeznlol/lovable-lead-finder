import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lernen, vorschlag } from '@/lib/angebot';
import { alleRueckmeldungen, rueckmeldungenAusBemerkungen, type Bemerkung, type KalkulationKurz } from '@/lib/calc-ablauf';

/**
 * Bemerkungen zum Preis (Julian, 20. November: «wie so ein Chatfenster ...
 * 4,1 Millionen weil das und das, dass auch Aurora lernt»). Wird rot, wenn
 * das Fenster aus Entwurf oder Ablauf verschwindet oder eine Kalkulation
 * doppelt ins Lernen geht.
 */
const b = (x: Partial<Bemerkung>): Bemerkung => ({
  id: crypto.randomUUID(), kalkulation_id: 'a', erstellt_am: '2026-11-20T10:00:00Z', user_id: null, name: 'TEST',
  urteil: 'zu_tief', preis_chf: 4_100_000, text: 'Fläche mehr wert als die Miete', empfehlung_chf: 1_410_000, kanton: 'ZH', test: false, ...x,
});
const k = (x: Partial<KalkulationKurz>): KalkulationKurz => ({
  id: 'k', erstellt_am: '2026-11-19T10:00:00Z', adresse: 'TEST', plz: null, gemeinde: null, kanton: 'ZH', kontakt: null, test: false,
  empfehlung_chf: 1_000_000, zustand: 'gesendet', preis_chf: 1_100_000, eingereicht_am: null, frist_am: null, gesendet_am: null,
  verlauf: [], vorlage: null, preis_urteil: 'zu_tief', preis_grund: 'Seesicht', ...x,
});

describe('Bemerkungen zum Preis', () => {
  it('je Kalkulation zählt das jüngste Urteil mit Preis, Testdaten und Urteile ohne Preis nie', () => {
    const r = rueckmeldungenAusBemerkungen([
      b({ erstellt_am: '2026-11-20T09:00:00Z', preis_chf: 3_000_000 }),
      b({}),
      b({ kalkulation_id: 'b', urteil: null }),
      b({ kalkulation_id: 'c', test: true }),
      b({ kalkulation_id: 'd', preis_chf: null }),
    ], new Set());
    expect(r).toEqual([expect.objectContaining({ empfehlung: 1_410_000, preis: 4_100_000, urteil: 'zu_tief', grund: 'Fläche mehr wert als die Miete' })]);
  });

  it('was durch den Ablauf geboten ist, geht vor; die offene Kalkulation lernt nicht von sich selbst', () => {
    const r = alleRueckmeldungen([k({ id: 'k' })], [b({ kalkulation_id: 'k' }), b({ kalkulation_id: 'a' }), b({ kalkulation_id: 'offen' })], 'offen');
    expect(r.map(x => x.preis).sort()).toEqual([1_100_000, 4_100_000]);
  });

  it('drei Urteile ergeben einen Vorschlag neben der Empfehlung', () => {
    const r = rueckmeldungenAusBemerkungen(['a', 'b', 'c'].map(id => b({ kalkulation_id: id, preis_chf: 2_820_000 })), new Set());
    expect(vorschlag(1_000_000, lernen(r, 'ZH'))).toBe(2_000_000);
  });

  it('das Fenster steht unter dem Entwurf und unter dem Ablauf, die Datenbank misst selbst', () => {
    expect(readFileSync('src/components/calc/Rechnung.tsx', 'utf8')).toMatch(/<Bemerkungen kalkulationId=\{entwurf\.id\}/);
    expect(readFileSync('src/components/calc/Ablauf.tsx', 'utf8')).toMatch(/<Bemerkungen kalkulationId=\{k\.id\}/);
    const sql = readFileSync('supabase/migrations/20261120120000_kalkulation_bemerkung.sql', 'utf8');
    expect(sql).toMatch(/grant insert \(kalkulation_id, name, urteil, preis_chf, text\)/);
    expect(sql).toMatch(/new\.empfehlung_chf := k\.empfehlung_chf/);
    expect(readFileSync('tools/kalkulation-probe.sh', 'utf8')).toMatch(/_kalkulation_bemerkung\.sql/);
  });
});

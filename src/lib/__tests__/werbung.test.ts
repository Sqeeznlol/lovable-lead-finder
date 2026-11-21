import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KAMPAGNEN, rat, zusammen, type WerbungTag } from '@/lib/werbung';

/** Der Tracker der Google-Anzeigen (21. November) folgt den Regeln des Werbeplans. */
const tag = (x: Partial<WerbungTag>): WerbungTag => ({ tag: '2026-11-24', kampagne: 'zone', besuche: 0, ergebnisse: 0, kontakte: 0, leads: 0, kosten_chf: null, klicks: null, ...x });

describe('Google Ads je Kampagne', () => {
  it('die Regeln des Werbeplans', () => {
    expect(rat({ besuche: 40, ergebnisse: 30, leads: 2, kosten: 200, klicks: 40 })).toBe('Budget verdoppeln');
    expect(rat({ besuche: 40, ergebnisse: 30, leads: 1, kosten: 300, klicks: 40 })).toBe('Text oder Suchbegriffe verbessern');
    expect(rat({ besuche: 40, ergebnisse: 30, leads: 1, kosten: 450, klicks: 40 })).toBe('Stoppen');
    expect(rat({ besuche: 160, ergebnisse: 90, leads: 0, kosten: 300, klicks: 160 })).toMatch(/^Stoppen oder Zielseite ändern/);
    expect(rat({ besuche: 12, ergebnisse: 0, leads: 0, kosten: null, klicks: null })).toMatch(/^Seite prüfen/);
  });

  it('summiert je Kampagne, Kosten nur wo eingetragen', () => {
    const z = zusammen([tag({ besuche: 10, ergebnisse: 6, leads: 1, kosten_chf: 20 }), tag({ tag: '2026-11-25', besuche: 5, ergebnisse: 3, kosten_chf: 10 }), tag({ kampagne: 'erbe', besuche: 3, ergebnisse: 1 })]);
    expect(z.map(x => x.kampagne)).toEqual(KAMPAGNEN.map(k => k.id));
    expect(z[0]).toMatchObject({ besuche: 15, leads: 1, kosten: 30, jeLead: 30, rat: 'Budget verdoppeln' });
    expect(z.find(x => x.kampagne === 'erbe')).toMatchObject({ besuche: 3, kosten: null, jeLead: null });
  });

  it('dieselben Kampagnen wie in der Importdatei, und die Datenbank zählt Testdaten nie', () => {
    const sql = readFileSync('supabase/migrations/20261121150000_werbung.sql', 'utf8');
    for (const k of KAMPAGNEN) expect(sql).toContain(`'${k.id}'`);
    expect(sql).toMatch(/name !~\* 'test'/);
    expect(sql).toMatch(/quelle = 'google' and kampagne is not null/);
  });
});

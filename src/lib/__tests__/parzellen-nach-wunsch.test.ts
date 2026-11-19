import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geoAdminLink, WOHNEN, wunschCsv, ZONE_KURZ, type WunschParzelle } from '@/lib/parzellen-nach-wunsch';

/**
 * Parzellen nach Wunsch (19. November). Wird rot, wenn eine Parzelle das
 * Kriterium nicht erfüllt, eine doppelt steht oder der Reiter verschwindet.
 * Die Zahlen je Gemeinde sind am 19. November auf dem Runner gezählt; je
 * Gemeinde ergaben alle Parzellen der Vermessung die Gemeindefläche.
 */
// Die zweite Lieferung ersetzt den Inhalt des Ordners ganz; sie zählt.
const SQL = readFileSync('supabase/migrations/20261119200000_parzellen_nach_wunsch_mehr.sql', 'utf8');
const ZEILE = /^\s*\('(CH\d{12})','(OW|NW|BE|SZ|UR|LU)',(\d+),'([^']+)','([^']+)',(\d+),'([^']+)',([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/gm;
const zeilen = [...SQL.matchAll(ZEILE)].map(m => ({
  egrid: m[1], kanton: m[2], bfs: +m[3], gemeinde: m[4], nummer: m[5], flaeche: +m[6], zone: m[7], anteil: +m[8], e: +m[9], n: +m[10],
}));

describe('Parzellen nach Wunsch: der erste Ordner', () => {
  it('alle 2895 Parzellen, je Gemeinde so viele wie gezählt', () => {
    const GEZAEHLT = {
      Sarnen: 152, Stans: 105, Stansstad: 58, Hergiswil: 57, Ennetbürgen: 38, Buochs: 44,
      Nidau: 47, 'Muri bei Bern': 156,
      'Ingenbohl (Brunnen)': 134, Einsiedeln: 146, Küssnacht: 188, Schwyz: 193, Arth: 102,
      Altdorf: 125,
      Ebikon: 146, Horw: 172, Kriens: 285, Meggen: 91, Luzern: 656,
    };
    const je = Object.fromEntries(Object.keys(GEZAEHLT).map(g => [g, zeilen.filter(z => z.gemeinde === g).length]));
    expect(je).toEqual(GEZAEHLT);
    expect(zeilen).toHaveLength(2895);
    expect(new Set(zeilen.map(z => z.egrid)).size).toBe(2895);
  });

  it('die zweite Lieferung ersetzt den Ordner ganz, in einem Zug', () => {
    expect(SQL).toMatch(/^begin;$/m);
    expect(SQL).toMatch(/delete from public\.wunsch_parzelle where ordner_id = '6a1f0c3e/);
    expect(SQL).toMatch(/^commit;$/m);
  });

  it('jede über 3000 m², mindestens zur Hälfte in der Bauzone, mit bekannter Zonenart und Punkt in der Gemeinde', () => {
    for (const z of zeilen) {
      // Gespeichert gerundet: Parzelle 1137 in Ennetbürgen hat 3000.21 m² und steht darum mit 3000 da.
      expect(z.flaeche, z.egrid).toBeGreaterThanOrEqual(3000);
      expect(z.anteil, z.egrid).toBeGreaterThanOrEqual(0.5);
      expect(ZONE_KURZ[z.zone], z.zone).toBeDefined();
      // Grob von Nidau bis Einsiedeln in LV95: ein vertauschtes Paar fiele hier auf.
      expect(z.e).toBeGreaterThan(2580000); expect(z.e).toBeLessThan(2712000);
      expect(z.n).toBeGreaterThan(1180000); expect(z.n).toBeLessThan(1227000);
    }
    expect(SQL).toMatch(/on conflict \(ordner_id, egrid\) do nothing/);
    expect(readFileSync('supabase/migrations/20261119180000_parzellen_nach_wunsch.sql', 'utf8'))
      .toMatch(/revoke all on public\.wunsch_ordner, public\.wunsch_parzelle from anon/);
  });

  it('CSV mit Strichpunkt und Link auf die Karte des Bundes', () => {
    const p: WunschParzelle = { egrid: 'CH000000000000', kanton: 'NW', bfs: 1509, gemeinde: 'TEST', nummer: '1', flaeche: 3100, zone: 'Wohnzonen', bauzone_anteil: 1, e: 2670185.4, n: 1200990.6, lat: 0, lon: 0 };
    expect(geoAdminLink(p)).toContain('E=2670185&N=1200991');
    const csv = wunschCsv([p]).split('\r\n');
    expect(csv[0].split(';')[0]).toBe('Kanton');
    expect(csv[1]).toContain('NW;TEST;1;CH000000000000;3100;Wohnzone;100 %');
    expect(WOHNEN.has('Arbeitszonen')).toBe(false);
  });

  it('der Reiter steht in Aurora und in der Prüfung aller Reiter', () => {
    const index = readFileSync('src/pages/Index.tsx', 'utf8');
    expect(index).toMatch(/\{ id: 'wunsch', label: 'Parzellen nach Wunsch'/);
    expect(index).toMatch(/nachladen\(\(\) => import\('@\/components\/ParzellenNachWunsch'\)/);
    expect(readFileSync('tools/reiter-pruefen.cjs', 'utf8')).toMatch(/'wunsch'/);
  });
});

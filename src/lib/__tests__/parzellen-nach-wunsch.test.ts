import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { favoritAus, geoAdminLink, ohneFavoriten, STAND, WOHNEN, wunschCsv, ZONE_KURZ, type WunschParzelle } from '@/lib/parzellen-nach-wunsch';

/**
 * Parzellen nach Wunsch (19. November). Wird rot, wenn eine Parzelle das
 * Kriterium nicht erfüllt, eine doppelt steht oder der Reiter verschwindet.
 * Die Zahlen je Gemeinde sind am 19. November auf dem Runner gezählt; je
 * Gemeinde ergaben alle Parzellen der Vermessung die Gemeindefläche.
 */
// Die dritte Lieferung ersetzt den Inhalt beider Ordner ganz; sie zählt (Julian: «nur erschlossenes Bauland für Wohnen»).
const SQL = readFileSync('supabase/migrations/20261119220000_parzellen_nach_wunsch_erschlossen.sql', 'utf8');
const ERSCHLOSSEN = '6a1f0c3e-5b7d-4e1a-9c2f-3d8b0e4a7f19', OFFEN = '9c4e2b71-3a5f-4d08-b6e2-7f1a0c5d8e42';
const ZEILE = /^\s*\('([0-9a-f-]{36})','(CH\d{12})','(OW|NW|BE|SZ|UR|LU)',(\d+),'([^']+)','([^']+)',(\d+),'([^']+)',([\d.]+),([\d.]+),([\d.]+),[\d.]+,[\d.]+,(true|false),'([^']+)'\)/gm;
const zeilen = [...SQL.matchAll(ZEILE)].map(m => ({
  ordner: m[1], egrid: m[2], kanton: m[3], bfs: +m[4], gemeinde: m[5], nummer: m[6], flaeche: +m[7], zone: m[8], anteil: +m[9], e: +m[10], n: +m[11],
  bebaut: m[12] === 'true', nachweis: m[13],
}));

describe('Parzellen nach Wunsch: der erste Ordner', () => {
  it('je Gemeinde so viele wie am 19. November gezählt, keine doppelt', () => {
    // [erschlossen, unbebaut ohne Nachweis]
    const GEZAEHLT: Record<string, [number, number]> = {
      Sarnen: [40, 1], Stans: [24, 6], Stansstad: [24, 1], Hergiswil: [23, 4], Ennetbürgen: [12, 5], Buochs: [12, 0],
      Nidau: [16, 6], 'Muri bei Bern': [47, 16],
      'Ingenbohl (Brunnen)': [44, 11], Einsiedeln: [41, 14], Küssnacht: [54, 13], Schwyz: [63, 19], Arth: [39, 10],
      Altdorf: [42, 0],
      Ebikon: [65, 8], Horw: [86, 29], Kriens: [93, 32], Meggen: [50, 12], Luzern: [284, 62],
    };
    const je = Object.fromEntries(Object.keys(GEZAEHLT).map(g => [g, [ERSCHLOSSEN, OFFEN].map(o => zeilen.filter(z => z.gemeinde === g && z.ordner === o).length)]));
    expect(je).toEqual(GEZAEHLT);
    expect(zeilen).toHaveLength(1059 + 249);
    expect(new Set(zeilen.map(z => z.egrid)).size).toBe(zeilen.length);
  });

  it('nur für Wohnen, und jede erschlossene mit Nachweis; die unbebauten ohne Nachweis im eigenen Ordner', () => {
    for (const z of zeilen) {
      expect(WOHNEN.has(z.zone), z.egrid).toBe(true);
      if (z.ordner === ERSCHLOSSEN) expect(z.nachweis, z.egrid).toMatch(/^(erschlossen laut Kanton|Wohnhaus im Gebäuderegister)/);
      else expect([z.bebaut, z.nachweis]).toEqual([false, 'unbebaut, Erschliessung bei der Gemeinde erfragen']);
    }
    // Ein Wohnhaus belegt die Erschliessung nur dort, wo der Kanton keinen Stand liefert; amtlich gibt es ihn in OW und UR.
    expect(zeilen.filter(z => ['OW', 'UR'].includes(z.kanton) && z.ordner === ERSCHLOSSEN && z.nachweis.startsWith('erschlossen laut Kanton')).length).toBe(39 + 41);
    expect(SQL).not.toMatch(/'nicht erschlossen'/);
  });

  it('die dritte Lieferung ersetzt beide Ordner ganz, in einem Zug', () => {
    expect(SQL).toMatch(/^begin;$/m);
    expect(SQL).toMatch(/delete from public\.wunsch_parzelle\s+where ordner_id in \('6a1f0c3e/);
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

describe('Parzellen nach Wunsch: Favoriten (20. November)', () => {
  const p: WunschParzelle = { egrid: 'CH000000000001', kanton: 'OW', bfs: 1407, gemeinde: 'TEST', nummer: '7', flaeche: 3200, zone: 'Wohnzonen', bauzone_anteil: 1, e: 2661000, n: 1194000, lat: 46.9, lon: 8.2 };

  it('was ausfindig gemacht wird, steht nicht mehr in der Filterliste', () => {
    const andere = { ...p, egrid: 'CH000000000002' };
    expect(ohneFavoriten([p, andere], [{ egrid: p.egrid }])).toEqual([andere]);
  });

  it('der Favorit nimmt die Angaben der Parzelle mit, nicht nur die EGRID', () => {
    const f = favoritAus(p, '  TEST  ');
    expect(f).toMatchObject({ egrid: p.egrid, gemeinde: 'TEST', nummer: '7', flaeche: 3200, von: 'TEST', lat: 46.9 });
    expect(STAND.map(([w]) => w)).toEqual(['suchen', 'gefunden', 'kontaktiert', 'interesse', 'kein_interesse']);
  });

  it('nur für Angemeldete, nie ohne Anmeldung oder für Fondsleitungen; Knopf und Ansicht stehen im Reiter', () => {
    const sql = readFileSync('supabase/migrations/20261120150000_wunsch_favorit.sql', 'utf8');
    expect(sql).toMatch(/revoke all on public\.wunsch_favorit from public, anon, authenticated/);
    expect(sql.match(/not public\.ist_fondsmanager\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    const seite = readFileSync('src/components/ParzellenNachWunsch.tsx', 'utf8');
    expect(seite).toMatch(/Ausfindig machen/);
    expect(seite).toMatch(/ohneFavoriten\(/);
    expect(seite).toMatch(/<WunschFavoriten /);
  });
});

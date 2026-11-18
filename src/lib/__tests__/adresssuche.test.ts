import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { adressSuche, alsAdressTreffer, mitHausnummer, nummerPasst, strassePasst } from '@/lib/adresssuche';

/**
 * 18. November: Die Adresssuche des Bundes kannte nur noch Liechtenstein.
 * Die Antworten sind echt (abgefragt um 07:40 UTC), gekürzt auf die Felder,
 * die gelesen werden.
 */
const SCHAAN = { fuzzy: 'true', results: [
  { attrs: { origin: 'address', label: 'Bahnhofstrasse 1 <b>9494 Schaan</b>', y: 2756995.87, x: 1226102.63 } },
  { attrs: { origin: 'gazetteer', label: '<i>Ortsteil</i> <b>Stadtkreis 1 Altstadt</b> (ZH) - Zürich', y: 2683768, x: 1247411 } },
] };
const REGISTER = { results: [{ attrs: { label: 'Bahnhofstrasse 1 8001 Zürich', detail: 'bahnhofstrasse 1 8001 zuerich zuerich _zh_ 2378430 100125045',
  geom_st_box2d: 'BOX(2683187.1 1246861.9,2683187.1 1246861.9)', lat: 47.3667, lon: 8.5398, featureId: '2378430_0' } }] };
const holen = (bund: unknown, register: unknown) => vi.fn((u: string) => (u.includes('featuresearch') ? register : bund) instanceof Error
  ? Promise.reject(u.includes('featuresearch') ? register : bund) : Promise.resolve(u.includes('featuresearch') ? register : bund));

describe('Adresssuche mit dem Gebäuderegister', () => {
  it('liest einen Treffer des Registers wie eine Adresse des Bundes', () => {
    expect(alsAdressTreffer(REGISTER.results[0].attrs)).toMatchObject({
      origin: 'address', label: 'Bahnhofstrasse 1 <b>8001 Zürich</b>', y: 2683187.1, x: 1246861.9, kanton: 'ZH', lat: 47.3667, featureId: '2378430_0' });
    expect(alsAdressTreffer({ label: 'Bahnhofstrasse 1 8001 Zürich' })).toBeNull();
  });

  it('lässt aus dem Register nur gelten, was zu Strasse und Nummer passt', () => {
    const t = (label: string) => ({ label });
    const passtZurEingabe = (e: string, x: { label: string }) => strassePasst(e, x) && nummerPasst(e, x);
    expect(passtZurEingabe('Dietlikerstrasse 54 Kloten', t('Dietlikerstrasse 54 <b>8302 Kloten</b>'))).toBe(true);
    expect(passtZurEingabe('dietlikerstr. 5', t('Dietlikerstrasse 54 <b>8302 Kloten</b>'))).toBe(true);
    expect(passtZurEingabe('Ramistrasse 101', t('Rämistrasse 101 <b>8006 Zürich</b>'))).toBe(true);
    expect(passtZurEingabe('Seestrasse 23 a', t('Seestrasse 23a <b>8700 Küsnacht ZH</b>'))).toBe(true);
    expect(passtZurEingabe('8302 Kloten Dietlikerstrasse 54', t('Dietlikerstrasse 54 <b>8302 Kloten</b>'))).toBe(true);
    // Echte Antwort des Registers auf «Kloten 2061», eine Parzelle:
    expect(passtZurEingabe('Kloten 2061', t('Verenagasse 7 <b>8302 Kloten</b>'))).toBe(false);
    expect(passtZurEingabe('Dietlikerstrasse 54 Kloten', t('Dietlikerstrasse 56 <b>8302 Kloten</b>'))).toBe(false);
    expect(strassePasst('Dietlikerstrasse 55 Kloten', t('Dietlikerstrasse 56 <b>8302 Kloten</b>'))).toBe(true);
  });

  it('gibt es die Nummer nicht, bleiben die Nachbarn derselben Strasse', async () => {
    const reg = { results: ['54', '56', '57'].map(z => ({ attrs: { label: `Dietlikerstrasse ${z} 8302 Kloten`, geom_st_box2d: 'BOX(2686764.6 1255483.5,2686764.6 1255483.5)' } })) };
    const r = await adressSuche('Dietlikerstrasse 55 Kloten', { limit: 6, holen: holen({ fuzzy: 'true', results: [] }, reg) });
    expect(r.map(a => a.label)).toEqual(['Dietlikerstrasse 54 <b>8302 Kloten</b>', 'Dietlikerstrasse 56 <b>8302 Kloten</b>', 'Dietlikerstrasse 57 <b>8302 Kloten</b>']);
    const genau = await adressSuche('Dietlikerstrasse 56 Kloten', { limit: 6, holen: holen({ fuzzy: 'true', results: [] }, reg) });
    expect(genau.map(a => a.label)).toEqual(['Dietlikerstrasse 56 <b>8302 Kloten</b>']);
  });

  it('fragt das Register nur mit Hausnummer', () => {
    expect(mitHausnummer('Dietlikerstrasse 54 Kloten')).toBe(true);
    expect(mitHausnummer('Seestrasse 23a, Küsnacht')).toBe(true);
    expect(mitHausnummer('dietlikerstrasse 54')).toBe(true);
    expect(mitHausnummer('Kloten')).toBe(false);
    expect(mitHausnummer('8302')).toBe(false);
  });

  it('bringt die Adresssuche nur Ungefähres, gehen die Adressen des Registers vor und Schaan fällt weg', async () => {
    const r = await adressSuche('Bahnhofstrasse 1 Zürich', { limit: 6, origins: null, holen: holen(SCHAAN, REGISTER) });
    expect(r.map(a => a.label)).toEqual(['Bahnhofstrasse 1 <b>8001 Zürich</b>', '<i>Ortsteil</i> <b>Stadtkreis 1 Altstadt</b> (ZH) - Zürich']);
  });

  it('kennt die Adresssuche die Adresse, bleibt sie vorne, ohne Doppel', async () => {
    const bund = { results: [{ attrs: { origin: 'address', label: 'Bahnhofstrasse 1 <b>8001 Zürich</b>', y: 2683187.1, x: 1246861.9 } }] };
    const r = await adressSuche('Bahnhofstrasse 1 8001 Zürich', { limit: 6, holen: holen(bund, REGISTER) });
    expect(r).toHaveLength(1);
    expect(r[0].quelle).toBeUndefined();
  });

  it('kennt auch das Register nichts, bleibt das Ungefähre', async () => {
    const r = await adressSuche('Bahnhofstrasse 1 Schaan', { limit: 6, holen: holen(SCHAAN, { results: [] }) });
    expect(r[0].label).toBe('Bahnhofstrasse 1 <b>9494 Schaan</b>');
  });

  it('fällt die Adresssuche aus, genügt das Register; fallen beide aus, kommt der Fehler', async () => {
    expect((await adressSuche('Bahnhofstrasse 1 Zürich', { limit: 6, holen: holen(new Error('503'), REGISTER) }))[0].label).toBe('Bahnhofstrasse 1 <b>8001 Zürich</b>');
    await expect(adressSuche('Bahnhofstrasse 1 Zürich', { limit: 6, holen: holen(new Error('503'), new Error('503')) })).rejects.toThrow('503');
  });

  it('ohne Hausnummer und ohne Adressen fragt sie das Register nicht', async () => {
    const h = holen({ results: [] }, REGISTER);
    await adressSuche('Kloten', { limit: 6, origins: 'address,parcel,zipcode,gg25', holen: h });
    await adressSuche('Bahnhofstrasse 1', { limit: 6, origins: 'parcel', holen: h });
    expect(h.mock.calls.some(([u]) => u.includes('featuresearch'))).toBe(false);
  });
});

// Wer die Adresssuche wieder direkt fragt, verliert den Ersatz, sobald der Bund sie leert.
describe('Keine Adresssuche am Helfer vorbei', () => {
  it('origins=address steht nur in lib/adresssuche.ts', () => {
    const dateien = ['src/lib/calc-daten.ts', 'src/lib/ortsabfrage.ts', 'src/lib/portfolio-import.ts', 'src/lib/swisstopo.ts', 'src/lib/karte3d.ts', 'src/components/Karte.tsx', 'tools/baugesuche_laden.ts'];
    for (const d of dateien) expect([d, /origins=address|SearchServer\?type=locations&limit|type: 'locations', origins: 'address|, 'address', \d/.test(readFileSync(d, 'utf8'))]).toEqual([d, false]);
  });
});

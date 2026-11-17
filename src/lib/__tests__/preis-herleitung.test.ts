import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { angabePruefen, erloesHerleiten, trend, verlaufGemeinde, type PreisReihen } from '@/lib/preis-herleitung';

/**
 * Julian, 17. November: «Die Preise stimmen nicht ... schaue genau alle
 * Preise an, die letzten paar Jahre, und begründe es auch.» Die Zahlen im
 * kleinen Beispiel sind von Hand nachgerechnet; die Prüfungen am Schluss
 * laufen gegen die echte Datei public/preise-reihen.json.
 */

// Eine Region, die jedes Jahr genau um 4 % steigt: der Trend muss 4 % sein.
const region = Array.from({ length: 11 }, (_, i) => [2025 - i, Math.round(1_000_000 * 1.04 ** (10 - i)), 500] as [number, number, number]);
const beispiel: PreisReihen = {
  stand: 2025,
  quellen: { kanton: 'Kanton', stadt: 'Stadt', register: 'Register' },
  eichung: { faktor: 1.1, verkauft: 99, register: 90, jahre: '2023-2025' },
  regionen: { stwe: { Agglomerationsgemeinden: region }, efh: {}, land: {} },
  zuerich: {
    raum: {
      'Ganze Stadt': [[2025, 20000, 600], [2024, 19000, 600], [2023, 18000, 600]],
      'Kreis 8': [[2025, 24000, 20], [2024, 22000, 20], [2023, 21000, 20]],
      Seefeld: [[2025, 26000, 5], [2024, 25000, 5], [2023, 24000, 5]],
    },
    gesamt: Array.from({ length: 11 }, (_, i) => [2025 - i, Math.round(15000 * 1.05 ** (10 - i)), 1, 600] as [number, number, number, number]),
    neubau: [[2025, 15000, 1, 100], [2024, 13000, 1, 100], [2023, 12000, 1, 100], [2022, 11000, 1, 100], [2021, 10000, 1, 100]],
  },
  gemeinden: {
    62: {
      name: 'Kloten', region: 'Agglomerationsgemeinden', flaeche: [100, 4000],
      stwe: [[2025, 1_100_000, 900_000, 1_300_000, 40, '2025'], [2024, 1_000_000, null, null, 20, '2024'], [2023, 1_200_000, null, null, 40, '2023'], [2022, 900_000, null, null, 30, '2022']],
      land: [[2025, 2200, 2000, 2400, 7, '2023-2025', 'bezahlt'], [2024, 2000, null, null, null, '2024', 'modell']],
      efh: [[2025, 1_500_000, null, null, 27, '2023-2025']],
    },
    99: { name: 'Klein', region: 'Agglomerationsgemeinden', flaeche: [80, 300], stwe: [[2025, 900_000, null, null, 20, '2021-2025']] },
    98: { name: 'Ohne', region: 'Agglomerationsgemeinden', stwe: [[2025, 900_000, null, null, 20, '2025']] },
  },
};

describe('Trend aus allen Jahren', () => {
  it('erkennt 4 % pro Jahr', () => {
    expect(trend(region.map(x => [x[0], x[1]]), 2015, 2025)).toBeCloseTo(0.04, 4);
  });
  it('ein einzelner Sprung reisst ihn nicht mit', () => {
    const sprung = region.map(x => [x[0], x[0] === 2025 ? x[1] * 1.15 : x[1]] as [number, number]);
    expect(trend(sprung, 2015, 2025)!).toBeLessThan(0.06);
  });
  it('braucht mindestens vier Jahre', () => {
    expect(trend([[2025, 1], [2024, 1], [2023, 1]], 2015, 2025)).toBeNull();
  });
});

describe('Verkaufspreis ausserhalb der Stadt Zürich', () => {
  const h = erloesHerleiten(beispiel, '62')!;
  it('drei Jahre auf 2025 gebracht, nach Verkäufen gewichtet, geteilt durch die geeichte Fläche', () => {
    // 2025: 1 100 000 × 40; 2024: 1 000 000 × 1.04 × 20 = 1 040 000 × 20; 2023: 1 200 000 × 1.0816 = 1 297 920 × 40.
    // (44 000 000 + 20 800 000 + 51 916 800) ÷ 100 = 1 167 168 je Wohnung; ÷ (100 × 1.1 = 110 m²) = 10 610.6 → 10 600.
    expect(h.m2).toBe(10600);
    expect(h.art).toBe('berechnet');
    // Mittlere Hälfte 2025: 900 000 ÷ 110 = 8 181.8 → 8 200; 1 300 000 ÷ 110 = 11 818.2 → 11 800.
    expect(h.spanne).toEqual([8200, 11800]);
  });
  it('begründet jeden Schritt mit Zahl und Herkunft', () => {
    expect(h.saetze[0]).toMatch(/^Eigentumswohnungen in Kloten, Median je Wohnung laut Handänderungsstatistik des Kantons: 2025 CHF 1.100.000 \(40 Verkäufe\), 2024 CHF 1.000.000 \(20 Verkäufe\), 2023 CHF 1.200.000 \(40 Verkäufe\)\.$/);
    expect(h.saetze[1]).toMatch(/Trend der Agglomerationsgemeinden \(4\.0 % pro Jahr seit 2015\)/);
    expect(h.saetze[1]).toMatch(/CHF 1.167.000 je Wohnung\.$/);
    expect(h.saetze[2]).toMatch(/im Median 100 m² \(4.000 Wohnungen im Gebäuderegister\).*10\.0 % grösser.*110\.0 m²\.$/);
    expect(h.saetze[3]).toMatch(/^Daraus CHF 10.600 je m² Wohnfläche\. Die mittlere Hälfte der Verkäufe 2025 lag bei CHF 8.200 bis 11.800 je m²\.$/);
    // Neubauten der Stadt: 15 000/F(2025), … – das Verhältnis steht als Spanne in Prozent da.
    expect(h.saetze[4]).toMatch(/^Ob Neubauten mehr bringen: in der Stadt Zürich kosteten sie je m² 2021 bis 2025 zwischen \d+ und \d+ % des Durchschnitts/);
  });
  it('nur ein zusammengefasster Wert: mit der Mitte des Zeitraums auf 2025 gebracht', () => {
    // 900 000 × 1.04^(2025 − 2023) = 973 440; ÷ (80 × 1.1 = 88) = 11 061.8 → 11 050.
    expect(erloesHerleiten(beispiel, '99')!.m2).toBe(11050);
  });
  it('ohne Wohnfläche im Register keine Herleitung, sondern die Annahme', () => {
    expect(erloesHerleiten(beispiel, '98')).toBeNull();
    expect(erloesHerleiten(beispiel, '4711')).toBeNull();
    expect(erloesHerleiten(null, '62')).toBeNull();
  });
  it('der Verlauf zeigt jedes Jahr mit Wohnung, Preis je m², Bauland und Haus', () => {
    const v = verlaufGemeinde(beispiel, '62', 110);
    expect(v[0]).toEqual({ jahr: 2025, wohnung: 1_100_000, wohnungN: 40, wohnungZeit: undefined, m2: 10000, land: 2200, landArt: '2023-2025', haus: 1_500_000 });
    expect(v[1].landArt).toBe('Modell');
    expect(v.map(z => z.jahr)).toEqual([2025, 2024, 2023, 2022]);
  });
  it('prüft gegen Julians Angabe', () => {
    expect(angabePruefen(h, { von: 9000, bis: 12000, gemeinde: 'Kloten', am: '1. Januar' })).toMatch(/liegt darin\.$/);
    expect(angabePruefen(h, { von: 20000, bis: 30000, gemeinde: 'Kloten', am: '1. Januar' })).toMatch(/liegt darunter\.$/);
  });
});

describe('Verkaufspreis in der Stadt Zürich', () => {
  it('nimmt das Quartier nur mit genug Verkäufen, sonst den Kreis, und sagt warum', () => {
    const h = erloesHerleiten(beispiel, '261', { qname: 'Seefeld', knr: 8 })!;
    // Kreis 8: 60 Verkäufe. Trend der Stadt 5 %: 24 000 + 22 000 × 1.05 + 21 000 × 1.1025 = 24 000 + 23 100 + 23 152.5; ÷ 3 = 23 417.5 → 23 400.
    expect(h.m2).toBe(23400);
    expect(h.art).toBe('amtlich');
    expect(h.kurz).toBe('amtlich, Stockwerkeigentum im Kreis 8 2023 bis 2025');
    expect(h.saetze.some(s => s === 'Im Quartier Seefeld gab es 2023 bis 2025 nur 15 Verkäufe: zu wenige für einen eigenen Wert, darum der Kreis 8.')).toBe(true);
  });
  it('ohne Quartier die ganze Stadt', () => {
    // 20 000 + 19 000 × 1.05 + 18 000 × 1.1025 = 20 000 + 19 950 + 19 845; ÷ 3 = 19 931.7 → 19 950.
    expect(erloesHerleiten(beispiel, '261')!.m2).toBe(19950);
  });
});

describe('Die echte Datei', () => {
  const r = JSON.parse(readFileSync('public/preise-reihen.json', 'utf8')) as PreisReihen;
  it('deckt die letzten Jahre und die Gemeinden ab', () => {
    expect(r.stand).toBeGreaterThanOrEqual(2025);
    expect(Object.keys(r.gemeinden).length).toBeGreaterThanOrEqual(150);
    expect(r.gemeinden['62'].stwe!.filter(w => w[0] >= r.stand - 10).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(r.zuerich.raum)).toEqual(expect.arrayContaining(['Ganze Stadt', 'Kreis 1', 'Seefeld', 'Fluntern']));
  });
  it('die Eichung an der Stadt ist eine Korrektur, kein Umbau', () => {
    expect(r.eichung.faktor).toBeGreaterThan(0.85);
    expect(r.eichung.faktor).toBeLessThan(1.2);
  });
  // Julian, 16. November: «Kilchberg ist zwischen 20 und 30k/m² Verkaufspreis».
  it('Kilchberg liegt in Julians Spanne', () => {
    const h = erloesHerleiten(r, '135')!;
    expect(h.m2).toBeGreaterThanOrEqual(20000);
    expect(h.m2).toBeLessThanOrEqual(30000);
  });
  it('die Stadt Zürich: Fluntern teurer als Affoltern, beide amtlich', () => {
    const fluntern = erloesHerleiten(r, '261', { qname: 'Fluntern', knr: 7 })!, affoltern = erloesHerleiten(r, '261', { qname: 'Affoltern', knr: 11 })!;
    expect(fluntern.kurz).toMatch(/Quartier Fluntern/);
    expect(fluntern.m2).toBeGreaterThan(affoltern.m2 * 1.4);
  });
});

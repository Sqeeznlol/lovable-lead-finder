import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { baukostenNachErloes, bewerten, CALC_ANNAHMEN, flaechenAnteil, hangZuschlag, kleinZuschlag, hnfPraxis, median, mieteStatistik, nachbarArt, zoneMitHand, zuerichKm, zuerichZuschlag, type CalcEingabe } from '@/lib/calc';
import { angebotEntwurf, betrag, uhr } from '@/lib/calc-ablauf';
import { gebaeudeAusRegister } from '@/lib/calc-daten';
import { REGISTER_MFH_2019 } from './register-beispiel';
import type { ZonenRegeln } from '@/lib/machbarkeit';

/**
 * CALC YOU LATER rechnet zwei Bewertungen und empfiehlt einen Preis.
 * Die Zahlen hier sind von Hand nachgerechnet: stimmt eine nicht mehr,
 * hat sich die Rechnung geändert, nicht nur ihr Wortlaut.
 */
const zone: ZonenRegeln = {
  bezeichnung: 'Wohnzone 2', abkuerzung: 'W2', gemeinde: 'Muster', az: 0.6, bmz: null, uez: null, vollgeschosse: 2, dachgeschosse: 1,
  untergeschosse: null, hoehe: null, hoeheArt: null, wohnanteilMin: null, rechtsstatus: 'inKraft', dokument: null, quelle: 'kanton',
};
// Die Rechenwege hier sind ohne den Zuschlag für kleine Projekte von Hand
// nachgerechnet; er hat seine eigenen Tests (YOMORI, weiter unten).
const leer: CalcEingabe = {
  grundlage: { flaeche: 1000, bebaubarM2: 500, zone, gebaeude: [], registerVollstaendig: true },
  annahmen: { ...CALC_ANNAHMEN, klein: 0 }, kanton: 'ZH', hand: {}, umfeld: {}, jahr: 2026,
};
const mfh = { grundflaeche: 200, geschosse: 3, baujahr: 1965, wohnungen: 6 };

describe('CALC YOU LATER: Neubau', () => {
  const b = bewerten(leer);

  it('rechnet Fläche, Kubatur, Baukosten, Erlös, Gewinn und Landwert', () => {
    // Ziffer: 0.6 × 1000 = 600 m². Hülle: 500 × 2 = 1000 m². Die Ziffer begrenzt.
    // Dach: 600 ÷ 2 × 0.66 = 198 m². Zusammen 798 m².
    expect(b.neubau!.gf).toBeCloseTo(798, 6);
    expect(b.neubau!.hnf).toBeCloseTo(614.46, 6);
    expect(b.neubau!.kubatur).toBeCloseTo(2553.6, 6);
    expect(b.neubau!.wohnungen).toBe(6);
    // Verkaufspreis 9'500 je m²: unter 15'000, also CHF 6'000 je m² Nutzfläche.
    expect(b.neubau!.baukostenJeM2).toBe(6000);
    expect(b.neubau!.baukosten).toBeCloseTo(3_686_760, 3);
    expect(b.neubau!.abbruch).toBe(0);
    expect(b.neubau!.erloes).toBeCloseTo(5_837_370, 3);
    // Gewinn 20 % des Erlöses.
    expect(b.neubau!.gewinn).toBeCloseTo(1_167_474, 3);
    expect(b.neubau!.landwert).toBeCloseTo(983_136, 3);
    expect(b.neubau!.jeM2).toBeCloseTo(983.136, 3);
    expect(b.neubau!.jeM3).toBeCloseTo(1443.75, 2);
  });

  it('Erlös minus Baukosten, Abbruch und Gewinn ist der Landwert', () => {
    const n = bewerten({ ...leer, grundlage: { ...leer.grundlage, gebaeude: [mfh] } }).neubau!;
    expect(n.abbruch).toBe(150_000);
    expect(n.erloes - n.baukosten - n.abbruch - n.gewinn).toBeCloseTo(n.landwert, 3);
  });

  it('empfiehlt den Wert minus Abschlag, auf 10 000 abgerundet', () => {
    expect(b.massgebend).toBe('neubau');
    expect(b.wert).toBeCloseTo(983_136, 3);
    expect(b.empfehlung).toBe(880_000);
    expect(b.bestand).toBeNull();
    expect(b.chancen).toContain('Unbebaut: kein Abbruch und keine Mieter.');
  });

  it('ohne Zone gibt es keinen Neubauwert und keine Empfehlung', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, zone: null } });
    expect(o.studie.rechenbar).toBe(false);
    expect(o.neubau).toBeNull();
    expect(o.empfehlung).toBeNull();
  });

  it('rechnet mit Ziffer und Geschossen von Hand und sagt das als Risiko', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, zone: null, bebaubarM2: null }, hand: { az: 0.6, vollgeschosse: 2 } });
    expect(o.studie.rechenbar).toBe(true);
    expect(o.neubauMiete).not.toBeNull();
    // Praxisformel mit Attika: 1000 × 0.6 ÷ 2 × 2.66 × 0.77 = 614.46 m² Nutzfläche, 798 m² Geschossfläche.
    expect(o.neubau!.hnf).toBeCloseTo(614.46, 6);
    expect(o.neubau!.gf).toBeCloseTo(798, 6);
    expect(o.risiken.some(r => r.includes('von Hand eingegeben'))).toBe(true);
    expect(o.risiken.some(r => r.includes('Ohne Umriss'))).toBe(true);
  });

  it('eine Eingabe von Hand geht dem Zonenplan vor, der Rest bleibt', () => {
    const z = zoneMitHand(zone, { az: 0.8 })!;
    expect(z.az).toBe(0.8);
    expect(z.vollgeschosse).toBe(2);
    expect(z.quelle).toBe('hand');
    expect(zoneMitHand(zone, {})).toBe(zone);
  });

  it('ein Landwert unter null gibt keine Empfehlung, aber ein Risiko', () => {
    const o = bewerten({ ...leer, annahmen: { ...CALC_ANNAHMEN, erloes: 3000 } });
    expect(o.neubau!.landwert).toBeLessThan(0);
    expect(o.empfehlung).toBeNull();
    expect(o.risiken).toContain('Mit diesen Annahmen bleibt nach Baukosten und Gewinn nichts für das Land.');
  });
});

describe('CALC YOU LATER: Bestand', () => {
  const e: CalcEingabe = { ...leer, grundlage: { ...leer.grundlage, gebaeude: [mfh] } };
  const b = bewerten(e);

  it('macht sich aus dem Fussabdruck ein Bild und rechnet mit der Miete des Kantons', () => {
    // 200 m² × 3 Geschosse = 600 m², davon 77 % vermietbar = 462 m².
    expect(b.bestand!.flaeche).toBeCloseTo(462, 6);
    expect(b.bestand!.flaecheArt).toBe('fussabdruck');
    // Kanton Zürich, Baujahre 1961 bis 1970: CHF 20.20 je m² und Monat (BFS 2024).
    expect(b.bestand!.mieteHeute).toBe(20.2);
    expect(b.bestand!.mieteArt).toBe('statistik');
    expect(b.bestand!.ertragHeute).toBeCloseTo(111_988.8, 3);
    expect(b.bestand!.wert).toBeCloseTo(2_799_720, 2);
    expect(b.risiken.some(r => r.includes('Mieterspiegel verlangen'))).toBe(true);
    expect(b.risiken).toContain('6 Wohnungen im Haus: Kündigungen und Erstreckungen brauchen Zeit.');
  });

  it('die höchste der drei Bewertungen bestimmt die Empfehlung', () => {
    // Land: 983 136 minus 150 000 Abbruch (600 m² × 250) = 833 136; das Haus ist mehr wert.
    expect(b.neubau!.landwert).toBeCloseTo(833_136, 3);
    expect(b.massgebend).toBe('bestand');
    expect(b.empfehlung).toBe(2_510_000);
    expect(b.risiken.some(r => r.includes('ein Abbruch lohnt sich nicht'))).toBe(true);
  });

  it('der Mietertrag laut Mieterspiegel geht jeder Annahme vor', () => {
    // Den Flächenwert (Tim, 20. November) gibt es nur in der Stadt Zürich; hier zählt die Miete.
    const o = bewerten({ ...e, hand: { mietertragJahr: 20_000 } });
    expect(o.bestand!.wertFlaeche).toBeNull();
    expect(o.bestand!.mieteArt).toBe('ertrag');
    expect(o.bestand!.wert).toBe(500_000);
    expect(o.massgebend).toBe('neubau');
    expect(o.risiken.some(r => r.includes('Mieterspiegel verlangen'))).toBe(false);
    expect(o.chancen.some(c => c.startsWith('Als Bauland ist die Liegenschaft'))).toBe(true);
  });

  it('Inserate zeigen die Marktmiete: der Median je m² zählt', () => {
    const o = bewerten({ ...e, hand: { vergleiche: [{ flaeche: 80, miete: 2400 }, { flaeche: 100, miete: 2600 }, { flaeche: 60, miete: 1680 }, { flaeche: 0, miete: 900 }] } });
    // 30, 26 und 28 CHF je m²: Median 28. Die Zeile ohne Fläche zählt nicht.
    expect(o.bestand!.marktmiete).toBe(28);
    expect(o.bestand!.vergleiche).toBe(3);
    expect(o.bestand!.wertMarkt).toBeCloseTo((462 * 28 * 12) / 0.04, 2);
    // Empfohlen wird mit der heutigen Miete, das Mehr ist eine Chance.
    expect(o.bestand!.wert).toBeCloseTo(2_799_720, 2);
    expect(o.chancen.some(c => c.startsWith('Die Inserate liegen 39 % über der heutigen Miete'))).toBe(true);
  });

  it('ein Einfamilienhaus bekommt keinen Ertragswert', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, gebaeude: [{ grundflaeche: 120, geschosse: 2, baujahr: 1990, wohnungen: 1 }] } });
    expect(o.bestand).toBeNull();
    expect(o.massgebend).toBe('neubau');
  });
});

describe('CALC YOU LATER: Chancen und Risiken', () => {
  it('misst den Landwert an dem, was in der Gemeinde bezahlt wird', () => {
    // Die Rechnung gibt CHF 983 je m² Land her.
    const teuer = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 500, q25: 400, q75: 600 } } });
    expect(teuer.risiken.some(r => r.includes('liegt deutlich über dem, was in Muster für Bauland bezahlt wird'))).toBe(true);
    const guenstig = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 4000, q25: 3500, q75: 5000 } } });
    expect(guenstig.risiken.some(r => r.includes('zu diesem Preis verkauft kaum jemand'))).toBe(true);
    // 4 000 000 für das Land: 614.46 × (0.8 E − (6000 + 0.2 (E − 12 500))) = 4 000 000, also E ≈ 16 683.
    expect(guenstig.erloesLand).toBe(16_700);
    expect(guenstig.risiken.some(r => /Zum Landpreis passt ein Erlös um CHF 16.700 je m² Nutzfläche, gerechnet ist mit CHF 9.500\.$/.test(r))).toBe(true);
    const passt = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 1000, q25: 800, q75: 1200 } } });
    expect(passt.chancen.some(c => c.includes('liegt im Rahmen dessen'))).toBe(true);
    // Der Massstab des Marktes: 1000 m² zum Median der Gemeinde.
    expect(passt.landMarkt).toEqual({ jeM2: 1000, wert: 1_000_000 });
    expect(bewerten(leer).landMarkt).toBeNull();
  });

  it('misst den Erlös an den Eigentumswohnungen der Gemeinde', () => {
    // Die Rechnung verkauft 90 m² für 855 000.
    const hoch = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', stwe: { m: 600_000, q25: 500_000, q75: 700_000 } } });
    expect(hoch.risiken.some(r => r.includes('Drei Viertel der Eigentumswohnungen in Muster'))).toBe(true);
    const vorsichtig = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', stwe: { m: 935_500, q25: 850_000, q75: 1_290_000 } } });
    expect(vorsichtig.chancen.some(c => c.startsWith('Vorsichtig gerechnet'))).toBe(true);
    // Zürich, 2025: Median 1.745 Mio., unteres Viertel bis 1.34 Mio. -- 855 000 ist dort zu tief.
    const tief = bewerten({ ...leer, umfeld: { gemeinde: 'Zürich', stwe: { m: 1_745_000, q25: 1_340_000, q75: 2_323_750 } } });
    expect(tief.chancen.some(c => c.startsWith('Tief gerechnet') && c.endsWith('wie gross sie waren, sagt die Statistik nicht.'))).toBe(true);
    // Endet der Betrag auf «Mio.», steht kein zweiter Punkt dahinter.
    const mio = bewerten({ ...leer, annahmen: { ...CALC_ANNAHMEN, erloes: 25_000 }, umfeld: { gemeinde: 'Kilchberg', stwe: { m: 2_920_000, q25: 2_520_000, q75: 3_776_800 } } });
    expect(mio.chancen.some(c => /^Tief gerechnet: eine Wohnung von 90 m² kostet hier CHF 2.25 Mio\. Drei Viertel/.test(c))).toBe(true);
  });

  it('nennt Schutz, Belastung, Alter und Bautätigkeit', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, gebaeude: [{ grundflaeche: 100, geschosse: 2, baujahr: 1961, wohnungen: 1 }] },
      umfeld: { denkmal: true, isos: true, belastet: 1, baugesuche: 5, baugesucheMeter: 300, oev: 'B', efh: { m: 2_500_000 }, gemeinde: 'Muster' } });
    expect(o.risiken.some(r => r.startsWith('Denkmalschutz'))).toBe(true);
    expect(o.risiken.some(r => r.startsWith('Ortsbild'))).toBe(true);
    expect(o.risiken.some(r => r.startsWith('Im Kataster der belasteten Standorte'))).toBe(true);
    expect(o.risiken.some(r => r.startsWith('Einfamilienhäuser in Muster'))).toBe(true);
    expect(o.chancen).toContain('5 Baugesuche im Umkreis von 300 m in zwölf Monaten: hier wird gebaut.');
    expect(o.chancen).toContain('Baujahr 1961: bei einem Haus dieses Alters steht eine grosse Sanierung an.');
    expect(o.chancen).toContain('Öffentlicher Verkehr: Güteklasse B.');
    // So schreibt es der Bund; im Satz steht es ohne Strich.
    const bund = bewerten({ ...leer, umfeld: { oev: 'A - sehr gute Erschliessung' } });
    expect(bund.chancen).toContain('Öffentlicher Verkehr: Güteklasse A, sehr gute Erschliessung.');
    expect(bewerten({ ...leer, umfeld: { oev: 'C - mittelmässige Erschliessung' } }).chancen.some(c => c.startsWith('Öffentlicher'))).toBe(false);
    // 200 von 798 m² gebaut.
    expect(o.chancen.some(c => c.startsWith('Erst 25 % ausgenützt'))).toBe(true);
  });

  it('schreibt ohne Eszett und ohne Gedankenstrich', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, gebaeude: [mfh], bauzoneM2: 700 },
      umfeld: { denkmal: true, isos: true, belastet: 2, baugesuche: 9, oev: 'A', gemeinde: 'Muster', land: { m: 900 }, stwe: { m: 500_000, q75: 600_000 } },
      hand: { vergleiche: [{ flaeche: 50, miete: 2000 }] } });
    const hang = bewerten({ ...leer, umfeld: { neigung: 15.4 } });
    expect(hang.risiken).toContain('Hanglage: das Gelände steigt um 15 %, die Baukosten sind 10 % höher gerechnet.');
    for (const satz of [...o.chancen, ...o.risiken, ...hang.risiken]) {
      expect(satz).not.toMatch(/ß|–|—| - /);
      // «CHF 1.75 Mio.» am Satzende: ein Punkt, nicht zwei.
      expect(satz).not.toMatch(/\.\./);
      expect(satz).toMatch(/\.$/);
    }
    const mio = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', stwe: { m: 1_000_000, q25: 800_000 } } });
    expect(mio.chancen.some(c => /^Vorsichtig gerechnet: eine Wohnung von 90 m² für CHF 855.000, der Median in Muster liegt bei CHF 1 Mio\.$/.test(c))).toBe(true);
    expect(o.chancen.length + o.risiken.length).toBeGreaterThan(8);
  });
});

describe('CALC YOU LATER: Mieten der Statistik', () => {
  it('liefert den Wert der Bauperiode, sonst den des Kantons', () => {
    expect(mieteStatistik('ZH', 1961)!.wert).toBe(20.2);
    expect(mieteStatistik('ZH', 1961)!.text).toBe('Durchschnitt Kanton ZH für Baujahre 1961 bis 1970, BFS 2024');
    expect(mieteStatistik('ZH', 1900)!.text).toContain('bis 1918');
    expect(mieteStatistik('ZH', 2023)!.wert).toBe(27.1);
    expect(mieteStatistik('ZH', 2023)!.text).toContain('ab 2021');
    expect(mieteStatistik('TG')!.wert).toBe(14.9);
    expect(mieteStatistik('tg', null)!.text).toBe('Durchschnitt Kanton TG, BFS 2024');
    expect(mieteStatistik('XX', 1961)).toBeNull();
    expect(mieteStatistik(null)).toBeNull();
  });

  it('der Median', () => {
    expect(median([])).toBeNull();
    expect(median([3])).toBe(3);
    expect(median([4, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('CALC YOU LATER: ein Tag', () => {
  const start = '2026-11-16T08:00:00Z', ende = '2026-11-17T08:00:00Z';
  const k = { zustand: 'pruefung' as const, eingereicht_am: start, frist_am: ende, gesendet_am: null };

  it('zeigt, wie viel Zeit bleibt', () => {
    const u = uhr(k, Date.parse('2026-11-16T14:00:00Z'))!;
    expect(u.anteil).toBeCloseTo(0.25, 6);
    expect(u.text).toBe('noch 18 Std.');
    expect(u.ueberfaellig).toBe(false);
    expect(uhr(k, Date.parse('2026-11-17T07:15:00Z'))!.text).toBe('noch 45 Min.');
  });

  it('meldet, was überfällig ist', () => {
    const u = uhr({ ...k, zustand: 'angebot' }, Date.parse('2026-11-17T10:30:00Z'))!;
    expect(u.ueberfaellig).toBe(true);
    expect(u.text).toBe('seit 2 Std. 30 Min. überfällig');
  });

  it('hält nach dem Versand an', () => {
    const u = uhr({ ...k, zustand: 'gesendet', gesendet_am: '2026-11-16T17:20:00Z' }, Date.parse('2026-12-01T00:00:00Z'))!;
    expect(u.text).toBe('gesendet nach 9 Std. 20 Min.');
    expect(u.ueberfaellig).toBe(false);
    expect(u.laeuft).toBe(false);
  });

  it('läuft erst nach dem Einreichen', () => {
    expect(uhr({ zustand: 'entwurf', eingereicht_am: null, frist_am: null, gesendet_am: null })).toBeNull();
    expect(uhr({ ...k, zustand: 'abgelehnt' })).toBeNull();
  });
});

describe('CALC YOU LATER: Angebot', () => {
  it('der Entwurf nennt Adresse, Betrag und Frist', () => {
    const t = angebotEntwurf({ kontakt: 'Frau Muster', adresse: 'Teststrasse 1', ort: '8000 Zürich', preis: 2_160_000, absender: 'Julian' }, new Date('2026-11-16T10:00:00Z'));
    expect(t).toContain('Guten Tag Frau Muster');
    expect(t).toContain('Liegenschaft an der Teststrasse 1 in 8000 Zürich');
    // Das Tausenderzeichen ist je nach Umgebung ' oder ’.
    expect(t).toMatch(/CHF 2['’]160['’]000\./);
    expect(t).toContain('gilt bis am 30. November 2026');
    expect(t.endsWith('Freundliche Grüsse\nJulian')).toBe(true);
    expect(t).not.toMatch(/ß|–|—/);
  });

  it('ohne Namen bleibt die Anrede neutral', () => {
    expect(angebotEntwurf({ adresse: 'Teststrasse 1', preis: 500_000 }).startsWith('Guten Tag\n\n')).toBe(true);
    expect(betrag(1234.4)).toMatch(/^CHF 1['’]234$/);
  });
});

describe('CALC YOU LATER: Baukosten nach Julians Vorgaben (16. November)', () => {
  it('je m² Nutzfläche nach Verkaufspreis, gleitend durch die Mitte jeder Stufe', () => {
    // «unter 15k 6000, über 15k 7000, über 20k 8000, über 25k 9000»
    expect(baukostenNachErloes(9_500)).toBe(6000);
    expect(baukostenNachErloes(12_500)).toBe(6000);
    expect(baukostenNachErloes(15_000)).toBe(6500);
    expect(baukostenNachErloes(17_500)).toBe(7000);
    expect(baukostenNachErloes(20_000)).toBe(7500);
    expect(baukostenNachErloes(22_500)).toBe(8000);
    expect(baukostenNachErloes(25_000)).toBe(8500);
    expect(baukostenNachErloes(27_500)).toBe(9000);
    expect(baukostenNachErloes(40_000)).toBe(9000);
    // Stadt Zürich, Neubauten 2025: CHF 18 229 je m².
    expect(baukostenNachErloes(18_229)).toBe(7150);
  });

  it('Hanglage: ab 10 % Steigung +10 %, ab 20 % +20 %', () => {
    expect(hangZuschlag(null)).toBe(0);
    expect(hangZuschlag(7.9)).toBe(0);
    expect(hangZuschlag(10)).toBe(0.1);
    expect(hangZuschlag(19.9)).toBe(0.1);
    expect(hangZuschlag(20)).toBe(0.2);
  });

  it('Nähe zu Zürich: +10 % am Hauptbahnhof, 0 % ab 25 km', () => {
    expect(zuerichZuschlag(0)).toBe(0.1);
    expect(zuerichZuschlag(12.5)).toBe(0.05);
    expect(zuerichZuschlag(25)).toBe(0);
    expect(zuerichZuschlag(40)).toBe(0);
    // Hochweidstrasse 9, Kilchberg: 6.7 km vom Hauptbahnhof.
    expect(zuerichKm(2683174, 1241352)).toBeCloseTo(6.714, 3);
    expect(zuerichZuschlag(6.7)).toBe(0.073);
  });

  it('Gewinn 20 %, Zuschläge auf die Baukosten, von Hand ohne Zuschläge', () => {
    expect(CALC_ANNAHMEN.marge).toBe(0.2);
    // Kilchberg: Verkaufspreis 25 000, eben (7.9 %), 6.7 km von Zürich.
    const k = bewerten({ ...leer, annahmen: { ...leer.annahmen, erloes: 25_000 }, umfeld: { neigung: 7.9, zuerichKm: 6.7 } }).neubau!;
    expect(k.kosten).toEqual({ grund: 8500, hang: 0, zuerich: 0.073, klein: 0, jeM2: 9120, vonHand: false });
    const hang = bewerten({ ...leer, annahmen: { ...leer.annahmen, erloes: 25_000 }, umfeld: { neigung: 22, zuerichKm: 6.7 } }).neubau!;
    // 8 500 × 1.2 × 1.073 = 10 944.6
    expect(hang.baukostenJeM2).toBe(10_940);
    const hand = bewerten({ ...leer, annahmen: { ...CALC_ANNAHMEN, baukostenHnf: 7000 }, umfeld: { neigung: 22, zuerichKm: 1 } }).neubau!;
    expect(hand.kosten).toEqual({ grund: 7000, hang: 0, zuerich: 0, klein: 0, jeM2: 7000, vonHand: true });
  });
});

describe('CALC YOU LATER: Neubau zum Vermieten', () => {
  it('Ertragswert der neuen Wohnungen minus Baukosten 6 500 je m², Abbruch und Gewinn', () => {
    const m = bewerten(leer).neubauMiete!;
    // Zürich, Baujahre ab 2021: CHF 27.10 je m² und Monat (BFS 2024).
    expect(m.miete).toBe(27.1);
    expect(m.mieteQuelle).toBe('Durchschnitt Kanton ZH für Baujahre ab 2021, BFS 2024');
    expect(m.ertrag).toBeCloseTo(199_822.392, 3);
    expect(m.wert).toBeCloseTo(4_995_559.8, 1);
    expect(m.baukostenJeM2).toBe(6500);
    expect(m.baukosten).toBeCloseTo(3_993_990, 3);
    expect(m.gewinn).toBeCloseTo(999_111.96, 2);
    expect(m.landwert).toBeCloseTo(2_457.84, 2);
  });

  it('mit Inseraten gilt deren Miete, und er kann massgebend werden', () => {
    const o = bewerten({ ...leer, hand: { vergleiche: [{ flaeche: 100, miete: 4000 }] } });
    expect(o.neubauMiete!.miete).toBe(40);
    expect(o.neubauMiete!.mieteQuelle).toBe('Median der eingetragenen Inserate');
    // 614.46 × 40 × 12 ÷ 0.04 = 7 373 520; minus 3 993 990 Bau und 1 474 704 Gewinn.
    expect(o.neubauMiete!.landwert).toBeCloseTo(1_904_826, 0);
    expect(o.massgebend).toBe('miete');
    expect(o.empfehlung).toBe(1_710_000);
  });
});

describe('CALC YOU LATER: Julians Praxisformel', () => {
  const a = CALC_ANNAHMEN;
  it('Grundstück × Ausnützung ÷ VG × (VG + 0.66) × 0.77', () => {
    expect(hnfPraxis(1000, zone, a)!.hnf).toBeCloseTo(614.46, 6);
    // Wie im Test der Potenzialrechnung: 720 ÷ 2 × 2.66 × 0.77 = 737.
    expect(Math.round(hnfPraxis(1200, { ...zone, az: 0.6, vollgeschosse: 2 }, a)!.hnf)).toBe(737);
  });

  it('Baumassenziffer über die Geschosshöhe; Hochweidstrasse 9 in Kilchberg', () => {
    // W2B: BMZ 1.8, 2 Vollgeschosse, 1 411 m². 1.8 ÷ 3.2 = 0.5625.
    const p = hnfPraxis(1411, { ...zone, az: null, bmz: 1.8, vollgeschosse: 2, dachgeschosse: 2 }, a)!;
    expect(p.az).toBe(0.5625);
    expect(p.hnf).toBeCloseTo(812.815, 3);
    expect(p.text).toMatch(/^1.411 m² × BMZ 1,8|^1.411 m² × BMZ 1.8/);
  });

  it('ohne Attika, wo die Zone kein Dachgeschoss erlaubt; ohne Ziffer keine Formel', () => {
    expect(hnfPraxis(1000, { ...zone, dachgeschosse: 0 }, a)!.hnf).toBeCloseTo(462, 6);
    expect(hnfPraxis(1000, { ...zone, az: null, bmz: null }, a)).toBeNull();
    expect(hnfPraxis(1000, { ...zone, vollgeschosse: null }, a)).toBeNull();
  });

  it('sagt, wenn die Grenzabstände weniger zulassen als die Formel', () => {
    // Hülle: 200 m² × 2 VG + Dach 132 = 532 m² Geschossfläche, 409.64 m² Nutzfläche.
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, bebaubarM2: 200 } });
    expect(o.neubau!.hnf).toBeCloseTo(614.46, 6);
    expect(o.risiken).toContain('Mit 5 m Grenzabstand rundum haben nur 410 m² Nutzfläche Platz; gerechnet ist nach der Praxisformel mit 614 m².');
    expect(o.herkunft.some(h => h.titel === 'Hauptnutzfläche nach Praxisformel (gerechnet)')).toBe(true);
  });
});

describe('CALC YOU LATER: Nachbarparzelle dazukaufen', () => {
  const nachbar = (flaeche: number) => ({ egrid: 'CH000000000001', nummer: '99', flaeche, zone, gebaeude: [] });

  it('der Nachbar bekommt seinen eigenen Wert; ohne Arealbonus bleibt nicht mehr', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(1000)] });
    const z = o.zusammen!;
    expect(z.flaeche).toBe(2000);
    expect(z.bonus).toBe(0);
    expect(z.nachbarWert).toBeCloseTo(983_136, 3);
    expect(z.mehr).toBeCloseTo(0, 3);
    expect(z.lohnt).toBe(false);
    expect(o.empfehlung).toBe(880_000);
    expect(o.risiken.some(r => r.startsWith('Mit Parzelle 99 dazugekauft bleibt für diese Parzelle nicht mehr als allein'))).toBe(true);
  });

  it('ab 3 000 m² zusammen: Arealüberbauung +10 %, besseres Angebot', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(2500)] });
    const z = o.zusammen!;
    expect(z.flaeche).toBe(3500);
    expect(z.bonus).toBe(0.1);
    // (614.46 + 1 536.15) × 1.1 = 2 365.671 m²; × (9 500 × 0.8 − 6 000) = 3 785 073.6.
    expect(z.hnf).toBeCloseTo(2365.671, 3);
    expect(z.landwert).toBeCloseTo(3_785_073.6, 1);
    expect(z.nachbarWert).toBeCloseTo(2_457_840, 1);
    expect(z.fuerUns).toBeCloseTo(1_327_233.6, 1);
    expect(z.mehr).toBeCloseTo(344_097.6, 1);
    expect(z.lohnt).toBe(true);
    expect(o.empfehlungAllein).toBe(880_000);
    expect(o.empfehlung).toBe(1_190_000);
    expect(o.chancen.some(c => /^Mit Parzelle 99 dazugekauft: CHF 344.000 mehr für diese Parzelle, mit Arealüberbauung \(\+10 % ab 3.000 m²\), wenn der Nachbar zu seinem eigenen Wert verkauft\.$/.test(c))).toBe(true);
  });

  it('mehrere Nachbarn im Satz', () => {
    const o = bewerten({ ...leer, nachbarn: [{ ...nachbar(1500), nummer: '3947' }, { ...nachbar(600), egrid: 'CH000000000002', nummer: '4903' }, { ...nachbar(600), egrid: 'CH000000000003', nummer: '4902' }] });
    expect(o.chancen.some(c => c.startsWith('Mit Parzellen 3947, 4903 und 4902 dazugekauft:') && c.endsWith('wenn die Nachbarn je zu ihrem eigenen Wert verkaufen.'))).toBe(true);
  });

  it('ein bebauter Nachbar mit Mieten kostet mehr, als er bringt', () => {
    const o = bewerten({ ...leer, nachbarn: [{ ...nachbar(2500), gebaeude: [{ grundflaeche: 400, geschosse: 4, baujahr: 2015, wohnungen: 16 }] }] });
    expect(o.zusammen!.lohnt).toBe(false);
    expect(o.empfehlung).toBe(o.empfehlungAllein);
  });
});

/**
 * Julian, 17. November, Zürich Aussersihl: alle Nachbarn gesperrt, «keine
 * Bauzone mit Ziffer». Die Quartiererhaltungszone QI/5a nennt laut
 * Zonenplan des Kantons fünf Vollgeschosse und keine Ziffer.
 */
describe('CALC YOU LATER: Nachbar in einer Bauzone ohne Ziffer', () => {
  const quartier: ZonenRegeln = { ...zone, bezeichnung: 'Quartiererhaltungszone I', abkuerzung: 'QI/5a', az: null, vollgeschosse: 5, dachgeschosse: 2 };
  const strasse: ZonenRegeln = { ...zone, bezeichnung: 'Strassen', abkuerzung: null, az: null, vollgeschosse: null, bauzone: false };
  const nachbar = (flaeche: number, z: ZonenRegeln | null, nummer = 'AU1344') => ({ egrid: `CH${nummer}`, nummer, flaeche, zone: z, gebaeude: [] });

  it('unterscheidet eigene Ziffer, Bauzone ohne Ziffer und keine Bauzone', () => {
    expect(nachbarArt(1000, zone, CALC_ANNAHMEN)).toBe('ziffer');
    expect(nachbarArt(358, quartier, CALC_ANNAHMEN)).toBe('dichte');
    expect(nachbarArt(358, strasse, CALC_ANNAHMEN)).toBe('keine');
    expect(nachbarArt(358, null, CALC_ANNAHMEN)).toBe('keine');
    expect(nachbarArt(0, quartier, CALC_ANNAHMEN)).toBe('keine');
    // Quartiererhaltungszone III: laut Zonenplan Bauzone, aber ohne Ziffer und ohne Geschosse.
    expect(nachbarArt(2563, { ...quartier, abkuerzung: 'QIII', vollgeschosse: null, bauzone: true }, CALC_ANNAHMEN)).toBe('dichte');
    // Schulhaus nebenan: die Zone für öffentliche Bauten nennt eine Ziffer, zu kaufen ist es nicht.
    expect(nachbarArt(3000, { ...zone, bezeichnung: 'Zone für öffentliche Bauten', bauzone: false }, CALC_ANNAHMEN)).toBe('keine');
    // Ein älterer Entwurf kennt die Angabe nicht: Geschosse genügen, ohne sie nichts.
    expect(nachbarArt(358, { ...quartier, bauzone: undefined, vollgeschosse: null }, CALC_ANNAHMEN)).toBe('keine');
  });

  it('rechnet mit der Dichte der Hauptparzelle und sagt es', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(500, quartier)] });
    const z = o.zusammen!;
    // Hauptparzelle: 614.46 m² Nutzfläche auf 1 000 m² Land, also 0.61446 je m². Der Nachbar: 500 × 0.61446 = 307.23 m².
    expect(z.dichte).toBeCloseTo(0.61446, 6);
    expect(z.teile[0].hnf).toBeCloseTo(307.23, 6);
    expect(z.teile[0].geliehen).toBe(true);
    // Sein eigener Wert: 307.23 × (9 500 × 0.8 − 6 000) = 491 568. Zusammen 921.69 × 1 600 = 1 474 704.
    expect(z.nachbarWert).toBeCloseTo(491_568, 3);
    expect(z.landwert).toBeCloseTo(1_474_704, 3);
    // Ohne Arealbonus bleibt für diese Parzelle dasselbe wie allein.
    expect(z.fuerUns).toBeCloseTo(983_136, 3);
    expect(z.lohnt).toBe(false);
    expect(o.risiken).toContain('Für Parzelle AU1344 nennt die Zone keine Ziffer: gerechnet mit der Dichte dieser Parzelle (0.61 m² Nutzfläche je m² Land), eine Annahme.');
  });

  it('mit Arealbonus wird das Angebot besser, der Nachbar bekommt seinen Wert', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(2500, quartier)] });
    const z = o.zusammen!;
    // Wie mit eigener Ziffer bei gleicher Dichte: (614.46 + 1 536.15) × 1.1 × 1 600 = 3 785 073.6.
    expect(z.bonus).toBe(0.1);
    expect(z.landwert).toBeCloseTo(3_785_073.6, 1);
    expect(z.nachbarWert).toBeCloseTo(2_457_840, 1);
    expect(o.empfehlung).toBe(1_190_000);
  });

  it('mehrere Nachbarn ohne Ziffer in einem Satz; wer eine eigene Ziffer hat, rechnet damit', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(358, quartier, 'AU1344'), nachbar(358, quartier, 'AU6598'), nachbar(1000, zone, 'AU1')] });
    expect(o.zusammen!.teile.map(t => !!t.geliehen)).toEqual([true, true, false]);
    expect(o.zusammen!.teile[2].hnf).toBeCloseTo(614.46, 6);
    expect(o.risiken.some(r => r.startsWith('Für Parzellen AU1344 und AU6598 nennt die Zone keine Ziffer:'))).toBe(true);
  });

  it('ohne Bauzone zählt die Parzelle nicht mit', () => {
    const o = bewerten({ ...leer, nachbarn: [nachbar(800, strasse)] });
    expect(o.zusammen).toBeNull();
    expect(o.empfehlung).toBe(880_000);
  });

  it('ist die Hauptparzelle selbst nicht rechenbar, gibt es keine gemeinsame Rechnung', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, zone: quartier, bebaubarM2: null }, nachbarn: [nachbar(358, quartier)] });
    expect(o.neubau).toBeNull();
    expect(o.zusammen).toBeNull();
  });

  it('von Hand eingetragene Ausnützung der Hauptparzelle gilt auch für den Nachbarn in derselben Zone', () => {
    const o = bewerten({ ...leer, grundlage: { ...leer.grundlage, zone: quartier, bebaubarM2: null }, hand: { az: 2 }, nachbarn: [nachbar(500, quartier)] });
    // Praxisformel: 1 000 × 2 ÷ 5 × 5.66 × 0.77 = 1 743.28 m², also 1.74328 je m² Land; der Nachbar 871.64 m².
    expect(o.neubau!.hnf).toBeCloseTo(1743.28, 6);
    expect(o.zusammen!.teile[0].hnf).toBeCloseTo(871.64, 6);
  });
});

/**
 * Julian, 18. November, am Projekt YOMORI (Wallisellerstrasse 9, Kloten,
 * Parzelle 6315, 711 m², W4): «Bei Projekten unter 10 Mio. Baukosten sind
 * die Baukosten 30 % höher», und die Zahlen des Projekts: 724 m²
 * Nutzfläche, CHF 5.5 Mio. Baukosten, CHF 2.4 Mio. Landwert.
 */
describe('CALC YOU LATER: kleine Projekte und Zahlen eines Projekts (YOMORI)', () => {
  const w4: ZonenRegeln = { ...zone, bezeichnung: 'Wohnzone 4', abkuerzung: 'W4', gemeinde: 'Kloten', az: 1.0, vollgeschosse: 4 };
  const yomori: CalcEingabe = {
    grundlage: { flaeche: 711, bebaubarM2: 400, zone: w4, gebaeude: [{ grundflaeche: 110, geschosse: 2, baujahr: 1958, wohnungen: 1 }], registerVollstaendig: true },
    annahmen: { ...CALC_ANNAHMEN, erloes: 11_250 }, kanton: 'ZH', hand: {}, umfeld: { neigung: 7.7, zuerichKm: 8.1 }, jahr: 2026,
  };

  it('unter CHF 10 Mio. Baukosten 30 % mehr, ab 10 Mio. nicht', () => {
    expect(CALC_ANNAHMEN.klein).toBe(0.3);
    expect(kleinZuschlag(9_999_999)).toBe(0.3);
    expect(kleinZuschlag(10_000_000)).toBe(0);
    expect(kleinZuschlag(0)).toBe(0);
    // Eine Kalkulation von vor dem 18. November kennt die Felder nicht: dann gilt die Vorgabe.
    expect(kleinZuschlag(5_000_000, {})).toBe(0.3);
    expect(kleinZuschlag(5_000_000, { klein: 0.2, kleinGrenze: 4_000_000 })).toBe(0);
  });

  it('YOMORI nach der Formel: 638 m², CHF 8 330 je m², 5.31 Mio. statt 5.5 Mio.', () => {
    const n = bewerten(yomori).neubau!;
    // 711 × 1.0 ÷ 4 × 4.66 × 0.77 = 637.8 m²
    expect(n.hnf).toBeCloseTo(637.80, 1);
    // 6 000 × 1.068 (8.1 km von Zürich) × 1.3 = 8 330.4
    expect(n.kosten).toEqual({ grund: 6000, hang: 0, zuerich: 0.068, klein: 0.3, jeM2: 8330, vonHand: false });
    expect(n.baukosten).toBeCloseTo(637.8 * 8330, -2);
    expect(n.abbruch).toBe(55_000);
    expect(bewerten(yomori).risiken.some(r => r.startsWith('Kleines Projekt: unter CHF 10 Mio. Baukosten, darum 30 %'))).toBe(true);
  });

  it('ein grosses Projekt bekommt keinen Zuschlag', () => {
    const gross = bewerten({ ...yomori, grundlage: { ...yomori.grundlage, flaeche: 7110, bebaubarM2: 4000 } }).neubau!;
    // 6 378 m² × 6 410 = 40.9 Mio.
    expect(gross.kosten.klein).toBe(0);
    expect(gross.baukostenJeM2).toBe(6410);
  });

  it('die Zahlen des Projekts gehen der Formel vor und ersetzen alle Zuschläge', () => {
    const b = bewerten({ ...yomori, hand: { projektHnf: 724, projektBaukosten: 5_500_000 } });
    const n = b.neubau!;
    expect(n.hnf).toBe(724);
    expect(n.projektHand).toBe(true);
    expect(n.hnfFormel).toBeCloseTo(637.80, 1);
    expect(n.baukosten).toBe(5_500_000);
    expect(n.baukostenJeM2).toBe(7597);
    expect(n.kosten.vonHand).toBe(true);
    // 724 × 11 250 × 0.8 − 5 500 000 − 55 000 = 961 000
    expect(n.landwert).toBeCloseTo(961_000, -1);
    expect(b.chancen[0]).toContain('Gerechnet mit den Zahlen des Projekts, von Hand eingegeben: 724 m² Nutzfläche');
    expect(b.herkunft[0].titel).toBe('Projekt, von Hand eingegeben');
  });

  it('der Landwert von CHF 2.4 Mio. verlangt einen Erlös von CHF 13 735 je m²', () => {
    // (2 400 000 + 5 500 000 + 55 000) ÷ (724 × 0.8) = 13 734.5
    const n = bewerten({ ...yomori, annahmen: { ...yomori.annahmen, erloes: 13_735 }, hand: { projektHnf: 724, projektBaukosten: 5_500_000 } }).neubau!;
    expect(n.landwert).toBeCloseTo(2_400_000, -3);
  });
});

describe('CALC YOU LATER: Mieterspiegel aus dem Register (Tim, 20. November)', () => {
  const haus = gebaeudeAusRegister(REGISTER_MFH_2019)!;
  const e: CalcEingabe = { ...leer, grundlage: { ...leer.grundlage, gebaeude: [haus] } };

  it('rechnet mit der Wohnfläche des Registers statt mit dem Fussabdruck', () => {
    const b = bewerten(e);
    expect(b.bestand!.flaecheArt).toBe('register');
    expect(b.bestand!.flaeche).toBe(526);
    expect(b.bestand!.spiegel).toHaveLength(5);
    // Kanton Zürich, Baujahr 2019: CHF 23.00 je m² und Monat (BFS 2024). 526 × 23 × 12 = 145'176; ÷ 4 % = 3'629'400.
    expect(b.bestand!.mieteHeute).toBe(23);
    expect(b.bestand!.ertragHeute).toBeCloseTo(145_176, 6);
    expect(b.bestand!.wert).toBeCloseTo(3_629_400, 4);
  });

  it('eingetragene Mieten je Wohnung gehen der Statistik vor, die übrigen bleiben gerechnet', () => {
    const id = (nr: string) => haus.wohnungsliste!.find(w => w.nr === nr)!.id;
    const eine = bewerten({ ...e, hand: { wohnungMiete: { [id('101')]: 2300 } } });
    // 2'300 + (526 − 96) × 23 = 12'190 im Monat; × 12 = 146'280.
    expect(eine.bestand!.mieteArt).toBe('spiegel');
    expect(eine.bestand!.ertragHeute).toBeCloseTo(146_280, 6);
    expect(eine.bestand!.mieteQuelle).toMatch(/^1 von 5 Wohnungen laut Eingabe, die übrigen mit/);
    const alle = bewerten({ ...e, hand: { wohnungMiete: { [id('101')]: 2300, [id('201')]: 2900, [id('202')]: 2400, [id('301')]: 3000, [id('302')]: 2450 } } });
    // 13'050 im Monat; × 12 = 156'600; ÷ 4 % = 3'915'000.
    expect(alle.bestand!.ertragHeute).toBe(156_600);
    expect(alle.bestand!.wert).toBeCloseTo(3_915_000, 4);
    expect(alle.bestand!.mieteQuelle).toBe('5 von 5 Wohnungen laut Eingabe');
  });

  it('ein eingegebener Jahresertrag geht auch dem Spiegel vor', () => {
    const o = bewerten({ ...e, hand: { mietertragJahr: 150_000, wohnungMiete: { [haus.wohnungsliste![0].id]: 2000 } } });
    expect(o.bestand!.mieteArt).toBe('ertrag');
    expect(o.bestand!.ertragHeute).toBe(150_000);
  });
});

/**
 * Schöneggstrasse 18 (Tim, 20. November: «eher 4.58 Mio ... 10k/m² HNF ...
 * manchmal ist der Bestand mehr wert als die zu günstig kapitalisierte
 * Miete»). Die Zahlen des Hauses stehen so im Gebäuderegister: 85 m²
 * Grundfläche, 7 Geschosse, Kategorie 1040 (teilweise Wohnnutzung),
 * 13 Studios mit zusammen 242 m². Erlös 19'000 je m², Stockwerkeigentum im
 * Kreis 4 (Quartier Langstrasse hat zu wenige Verkäufe; seit dem 21. November
 * je Quartier statt der ganzen Stadt).
 */
describe('CALC YOU LATER: Bestand nach Fläche (Tim)', () => {
  const studios = [18, 18, 20, 18, 18, 20, 18, 18, 20, 18, 18, 20, 18].map((f, i) => ({ id: `148727-${i}`, nr: String(i), geschoss: null, zimmer: 1, flaeche: f }));
  const haus = { grundflaeche: 85, geschosse: 7, baujahr: 1877, wohnungen: 13, kategorie: 1040, wohnungsliste: studios };
  const e: CalcEingabe = {
    ...leer, kanton: 'ZH', annahmen: { ...leer.annahmen, erloes: 19_000 }, umfeld: { ...leer.umfeld, gemeinde: 'Zürich' },
    grundlage: { ...leer.grundlage, flaeche: 101, gebaeude: [haus] },
  };

  it('nur in der Stadt Zürich (Julian, 20. November): in Schlieren zählt allein die Miete', () => {
    const b = bewerten({ ...e, umfeld: { ...e.umfeld, gemeinde: 'Schlieren' } });
    expect(b.bestand!.wertFlaeche).toBeNull();
    expect(b.bestand!.wert).toBe(b.bestand!.wertMiete);
    expect(b.bestand!.flaecheArt).toBe('gemischt');
  });

  it('Haus mit Gewerbe: die ganze Fläche zählt, nicht nur die Wohnungen', () => {
    const b = bewerten(e);
    expect(b.bestand!.flaecheArt).toBe('gemischt');
    expect(b.bestand!.flaeche).toBeCloseTo(85 * 7 * 0.77, 6);
    expect(b.bestand!.flaecheWohnungen).toBe(242);
  });

  it('nahe an Tims 10’000 je m², weil die Fläche mehr wert ist als die kapitalisierte Miete', () => {
    const b = bewerten(e);
    // 56.9 % von 19'000: der Mittelwert aus Tims zwei Urteilen in der Stadt (10'000 hier, 12'000 in Wollishofen).
    expect(b.bestand!.jeM2).toBe(10_800);
    expect(b.bestand!.wertArt).toBe('flaeche');
    expect(b.bestand!.wertFlaeche).toBeCloseTo(458.15 * 10_800, 0);
    expect(b.bestand!.wertFlaeche!).toBeGreaterThan(b.bestand!.wertMiete);
    expect(b.massgebend).toBe('bestand');
    expect(b.empfehlung).toBe(4_450_000);
  });

  it('ein reines Wohnhaus bleibt bei den Wohnungen; 0 % schaltet den Flächenwert ab', () => {
    const rein = bewerten({ ...e, grundlage: { ...e.grundlage, gebaeude: [{ ...haus, kategorie: 1025 }] } });
    expect(rein.bestand!.flaecheArt).toBe('register');
    expect(rein.bestand!.flaeche).toBe(242);
    const aus = bewerten({ ...e, annahmen: { ...e.annahmen, bestandAnteil: 0 } });
    expect(aus.bestand!.wertFlaeche).toBeNull();
    expect(aus.bestand!.wert).toBe(aus.bestand!.wertMiete);
  });
});

/**
 * Tims Prüfung vom 20. November, Rietwisstrasse 7 in Uitikon (Baujahr 2019,
 * 526 m² Wohnungen laut Register, Erlös 16'700): «alle Gebäude, welche nach
 * 1970 gebaut wurden, haben noch eine lange Lebensdauer ... da muss man den
 * Bestand rechnen ... über m² HNF ... 12000/m²». Ab 1970 gilt der
 * Flächenwert überall, nicht nur in der Stadt Zürich.
 */
describe('CALC YOU LATER: Bestand ab 1970 (Tim)', () => {
  const wohnungen = [100, 110, 106, 100, 110].map((f, i) => ({ id: `x-${i}`, nr: String(i), geschoss: null, zimmer: 4.5, flaeche: f }));
  const haus = { grundflaeche: 302, geschosse: 3, baujahr: 2019, wohnungen: 5, kategorie: 1025, wohnungsliste: wohnungen };
  const e: CalcEingabe = {
    ...leer, kanton: 'ZH', annahmen: { ...leer.annahmen, erloes: 16_700 }, umfeld: { ...leer.umfeld, gemeinde: 'Uitikon' },
    grundlage: { ...leer.grundlage, flaeche: 1332, gebaeude: [haus] },
  };

  it('ein Haus von 2019 in Uitikon: 12’000 je m², wie Tim', () => {
    const b = bewerten(e);
    expect(b.bestand!.flaeche).toBe(526);
    expect(b.bestand!.jeM2).toBe(12_000);
    expect(b.bestand!.wertFlaeche).toBe(526 * 12_000);
    expect(b.bestand!.wertArt).toBe('flaeche');
  });

  it('ein Haus von 1911 ausserhalb der Stadt bleibt bei der Miete', () => {
    const alt = bewerten({ ...e, grundlage: { ...e.grundlage, gebaeude: [{ ...haus, baujahr: 1911 }] } });
    expect(alt.bestand!.wertFlaeche).toBeNull();
  });

  it('das Feld der Annahmen folgt dem Alter', () => {
    expect(flaechenAnteil(e, 2019)).toEqual({ anteil: 0.719, feld: 'bestandAnteilJung' });
    expect(flaechenAnteil(e, 1911)).toBeNull();
    expect(flaechenAnteil({ ...e, umfeld: { gemeinde: 'Zürich' } }, 1908)).toEqual({ anteil: 0.569, feld: 'bestandAnteil' });
  });
});

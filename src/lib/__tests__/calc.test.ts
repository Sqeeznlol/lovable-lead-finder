import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { bewerten, CALC_ANNAHMEN, median, mieteStatistik, zoneMitHand, type CalcEingabe } from '@/lib/calc';
import { angebotEntwurf, betrag, uhr } from '@/lib/calc-ablauf';
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
const leer: CalcEingabe = {
  grundlage: { flaeche: 1000, bebaubarM2: 500, zone, gebaeude: [], registerVollstaendig: true },
  annahmen: CALC_ANNAHMEN, kanton: 'ZH', hand: {}, umfeld: {}, jahr: 2026,
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
    expect(b.neubau!.baukosten).toBeCloseTo(2_553_600, 3);
    expect(b.neubau!.abbruch).toBe(0);
    expect(b.neubau!.erloes).toBeCloseTo(5_837_370, 3);
    expect(b.neubau!.gewinn).toBeCloseTo(875_605.5, 3);
    expect(b.neubau!.landwert).toBeCloseTo(2_408_164.5, 3);
    expect(b.neubau!.jeM2).toBeCloseTo(2408.1645, 3);
    // Baukosten je m³: 3200 ÷ 3.2 m Geschosshöhe.
    expect(b.neubau!.jeM3).toBeCloseTo(1000, 6);
  });

  it('Erlös minus Baukosten, Abbruch und Gewinn ist der Landwert', () => {
    const n = bewerten({ ...leer, grundlage: { ...leer.grundlage, gebaeude: [mfh] } }).neubau!;
    expect(n.abbruch).toBe(150_000);
    expect(n.erloes - n.baukosten - n.abbruch - n.gewinn).toBeCloseTo(n.landwert, 3);
  });

  it('empfiehlt den Wert minus Abschlag, auf 10 000 abgerundet', () => {
    expect(b.massgebend).toBe('neubau');
    expect(b.wert).toBeCloseTo(2_408_164.5, 3);
    expect(b.empfehlung).toBe(2_160_000);
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
    // Ohne Dachgeschoss in der Eingabe: 600 m².
    expect(o.neubau!.gf).toBeCloseTo(600, 6);
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

  it('die höhere der beiden Bewertungen bestimmt die Empfehlung', () => {
    // Land: 2 408 164.5 minus 150 000 Abbruch = 2 258 164.5; das Haus ist mehr wert.
    expect(b.neubau!.landwert).toBeCloseTo(2_258_164.5, 3);
    expect(b.massgebend).toBe('bestand');
    expect(b.empfehlung).toBe(2_510_000);
    expect(b.risiken.some(r => r.includes('ein Abbruch lohnt sich nicht'))).toBe(true);
  });

  it('der Mietertrag laut Mieterspiegel geht jeder Annahme vor', () => {
    const o = bewerten({ ...e, hand: { mietertragJahr: 80_000 } });
    expect(o.bestand!.mieteArt).toBe('ertrag');
    expect(o.bestand!.wert).toBe(2_000_000);
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
    const teuer = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 1200, q25: 1000, q75: 1500 } } });
    expect(teuer.risiken.some(r => r.includes('liegt deutlich über dem, was in Muster für Bauland bezahlt wird'))).toBe(true);
    const guenstig = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 4000, q25: 3500, q75: 5000 } } });
    expect(guenstig.risiken.some(r => r.includes('zu diesem Preis verkauft kaum jemand'))).toBe(true);
    const passt = bewerten({ ...leer, umfeld: { gemeinde: 'Muster', land: { m: 2400, q25: 2000, q75: 2800 } } });
    expect(passt.chancen.some(c => c.includes('liegt im Rahmen dessen'))).toBe(true);
    // Der Massstab des Marktes: 1000 m² zum Median der Gemeinde.
    expect(passt.landMarkt).toEqual({ jeM2: 2400, wert: 2_400_000 });
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
    expect(tief.chancen.some(c => c.startsWith('Tief gerechnet') && c.endsWith('der Erlös je m² lässt sich höher ansetzen.'))).toBe(true);
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
    for (const satz of [...o.chancen, ...o.risiken]) {
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

import { describe, expect, it, vi } from 'vitest';
import { ANNAHMEN, bestandGf, studieRechnen, type Eingabe, type ZonenRegeln } from '../machbarkeit';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { regelnAusZh, zeichnung, zoneAusBestand } from '../machbarkeit-daten';

const zone = (z: Partial<ZonenRegeln>): ZonenRegeln => ({
  bezeichnung: 'Wohnzone', abkuerzung: 'W3', gemeinde: 'TEST', az: null, bmz: null, uez: null, vollgeschosse: null, dachgeschosse: null,
  untergeschosse: null, hoehe: null, hoeheArt: null, wohnanteilMin: null, rechtsstatus: 'inKraft', dokument: null, quelle: 'kanton', ...z,
});
const eingabe = (e: Partial<Eingabe>): Eingabe => ({ flaeche: 1000, bebaubarM2: 500, zone: zone({ az: 0.6, vollgeschosse: 3, dachgeschosse: 1 }), gebaeude: [], annahmen: ANNAHMEN, ...e });

describe('Machbarkeit', () => {
  it('Bestand: Grundfläche mal Geschosse, ohne Angaben keine Zahl', () => {
    expect(bestandGf([{ grundflaeche: 200, geschosse: 2, baujahr: 1960, wohnungen: 2 }, { grundflaeche: 30, geschosse: null, baujahr: null, wohnungen: null }])).toBe(400);
    expect(bestandGf([{ grundflaeche: null, geschosse: 2, baujahr: null, wohnungen: null }])).toBeNull();
  });

  it('die Ziffer begrenzt: 0.6 × 1000 m², das Dachgeschoss kommt dazu', () => {
    const s = studieRechnen(eingabe({ gebaeude: [{ grundflaeche: 200, geschosse: 2, baujahr: 1960, wohnungen: 2 }] }));
    expect(s.rechenbar).toBe(true);
    expect(s.begrenzt).toBe('ziffer');
    expect(s.gfNachZiffer).toBe(600);
    expect(s.gfNachHuelle).toBe(1500);          // 500 × 3
    expect(s.gfVoll).toBe(600);
    expect(s.gfDach).toBeCloseTo(132, 5);        // 600 / 3 × 0.66
    expect(s.gfNeu).toBeCloseTo(732, 5);
    expect(s.hnfNeu).toBeCloseTo(563.64, 2);     // × 0.77
    expect(s.wohnungen).toBe(6);                 // 563.64 / 90
    expect(s.gfBestand).toBe(400);
    expect(s.reserve).toBeCloseTo(332, 5);
    expect(s.ausgenuetzt).toBeCloseTo(400 / 732, 5);
  });

  it('Ersatzneubau: was für das Land bleibt; Erweiterung: was nach Kosten bleibt', () => {
    const s = studieRechnen(eingabe({ gebaeude: [{ grundflaeche: 200, geschosse: 2, baujahr: 1960, wohnungen: 2 }] }));
    const [neu, mehr] = s.varianten;
    expect(neu.titel).toBe('Ersatzneubau');
    expect(neu.erloes).toBeCloseTo(563.64 * 9500, 0);                       // 5'354'580
    expect(neu.kosten).toBeCloseTo(732 * 3200 + 400 * 250, 0);             // 2'442'400
    expect(neu.ergebnis).toBeCloseTo(5354580 - 2442400 - 5354580 * 0.15, 0); // 2'108'993
    expect(neu.jeM2).toBeCloseTo(2108993 / 1000, 0);
    expect(mehr.titel).toBe('Aufstocken oder anbauen');
    expect(mehr.gf).toBeCloseTo(332, 5);
    expect(mehr.ergebnis).toBeCloseTo(332 * 0.77 * 9500 - 332 * 3200, 0);
  });

  it('schmales Grundstück: die Hülle begrenzt, nicht die Ziffer', () => {
    const s = studieRechnen(eingabe({ bebaubarM2: 150, zone: zone({ az: 0.6, vollgeschosse: 2, dachgeschosse: 1 }) }));
    expect(s.begrenzt).toBe('huelle');
    expect(s.gfVoll).toBe(300);                  // 150 × 2, statt 600 nach Ziffer
    expect(s.gfDach).toBeCloseTo(99, 5);         // 150 × 0.66
    expect(s.varianten[0].titel).toBe('Neubau'); // kein Bestand
  });

  it('Baumasse: umgerechnet über die Geschosshöhe, das Dach ist inbegriffen', () => {
    const s = studieRechnen(eingabe({ bebaubarM2: 300, zone: zone({ bmz: 2, vollgeschosse: 3, dachgeschosse: 1 }) }));
    expect(s.ziffer).toBe('BMZ');
    expect(s.gfNachZiffer).toBeCloseTo(625, 5);  // 2 × 1000 / 3.2
    expect(s.gfNeu).toBeCloseTo(625, 5);         // Hülle 900 + 198 wäre mehr
    expect(s.gfDach).toBe(0);
    expect(s.begrenzt).toBe('ziffer');
    expect(s.pruefen.some(p => p.startsWith('Baumasse'))).toBe(true);
  });

  it('Überbauungsziffer deckelt die Grundfläche', () => {
    const s = studieRechnen(eingabe({ zone: zone({ uez: 0.25, vollgeschosse: 3 }) }));
    expect(s.grundflaecheMax).toBe(250);         // 0.25 × 1000, kleiner als 500 nach Abstand
    expect(s.gfNeu).toBe(750);
    expect(s.begrenzt).toBe('huelle');
  });

  it('nur der Teil in der Bauzone zählt für die Ziffer', () => {
    const s = studieRechnen(eingabe({ bauzoneM2: 600 }));
    expect(s.gfNachZiffer).toBeCloseTo(360, 5);
    expect(s.pruefen).toContain('Die Parzelle liegt nur zum Teil in der Bauzone.');
  });

  it('ohne Umriss gilt die Ziffer allein, und das steht bei den Prüfpunkten', () => {
    const s = studieRechnen(eingabe({ bebaubarM2: null }));
    expect(s.gfNachHuelle).toBeNull();
    expect(s.gfVoll).toBe(600);
    expect(s.pruefen[0]).toMatch(/^Kein Umriss/);
  });

  it('nicht rechenbar wird gesagt, nicht geschätzt', () => {
    expect(studieRechnen(eingabe({ flaeche: null })).grund).toMatch(/Fläche/);
    expect(studieRechnen(eingabe({ zone: null })).grund).toMatch(/keine Zone/);
    expect(studieRechnen(eingabe({ bebaubarM2: null, zone: zone({ vollgeschosse: 3 }) })).grund).toMatch(/ohne Umriss/);
    expect(studieRechnen(eingabe({ zone: zone({}) })).rechenbar).toBe(false);
  });

  // Gemessen am 15. November: die Gebäudetabelle führt nur Zürich.
  it('ohne geladenes Register heisst kein Gebäude nicht unbebaut', () => {
    const zh = studieRechnen(eingabe({ registerVollstaendig: true }));
    expect(zh.abschnitte.at(-1)!.zeilen[0]).toMatchObject({ wert: 'kein Gebäude im Register', art: 'amtlich' });
    expect(zh.varianten[0].text).toMatch(/unbebauten/);
    const tg = studieRechnen(eingabe({ registerVollstaendig: false }));
    expect(tg.abschnitte.at(-1)!.zeilen[0]).toMatchObject({ wert: 'nicht bekannt', art: 'annahme' });
    expect(tg.varianten[0].text).toMatch(/nicht bekannt/);
    expect(tg.pruefen.some(p => p.startsWith('Der Bestand ist nicht bekannt'))).toBe(true);
    const liste = studieRechnen(eingabe({ registerVollstaendig: false, bestandQuelle: 'liste', gebaeude: [{ grundflaeche: 120, geschosse: 2, baujahr: 1970, wohnungen: 1 }] }));
    expect(liste.gfBestand).toBe(240);
    expect(liste.abschnitte.at(-1)!.zeilen[0]).toMatchObject({ art: 'annahme', quelle: 'eigene Liste: Gebäudefläche × Geschosse' });
  });

  it('jede Zahl trägt ihre Herkunft; Zonen aus der eigenen Liste gelten nicht als amtlich', () => {
    const amt = studieRechnen(eingabe({}));
    const alle = amt.abschnitte.flatMap(a => a.zeilen);
    expect(alle.every(z => z.quelle.length > 0)).toBe(true);
    expect(alle.find(z => z.titel === 'Ausnützungsziffer')?.art).toBe('amtlich');
    expect(alle.find(z => z.titel === 'Bebaubare Grundfläche')?.art).toBe('annahme');
    const liste = studieRechnen(eingabe({ zone: zone({ az: 0.6, vollgeschosse: 3, quelle: 'bestand' }) }));
    expect(liste.abschnitte.flatMap(a => a.zeilen).find(z => z.titel === 'Ausnützungsziffer')?.art).toBe('annahme');
    expect(liste.pruefen.some(p => p.includes('eigenen Liste'))).toBe(true);
  });

  // Die Werte dieser Zonenfläche lieferte der Zürcher Dienst am 15. November für Uster.
  it('Zürcher Zonenplan: Ausnützung und Überbauung stehen in Prozent, Baumasse in m³/m²', () => {
    const r = regelnAusZh({ typ_gde_bezeichnung: 'Wohnzone, 3-geschossig, m. G.erl.', typ_gde_abkuerzung: 'W3/70G', typ_gemeindename: 'Uster',
      rechtsstatus: 'inKraft', ausnuetzungsziffer_max: 70, baumassenziffer_max: null, ueberbauungsziffer_max: null, vollgeschosse_max: 3,
      dachgeschosse_max: 1, gebaeudehoehe_max: null, firsthoehe_max: 14.5, gesamthoehe: 11, wohnanteil_min: 40, dokument: 'https://oerebdocs.zh.ch/documents?docid=1' });
    expect(r.az).toBeCloseTo(0.7, 5);
    expect(r.vollgeschosse).toBe(3);
    expect(r.dachgeschosse).toBe(1);
    expect([r.hoehe, r.hoeheArt]).toEqual([11, 'Gesamthöhe']);   // die niedrigste zählt
    expect(r.quelle).toBe('kanton');
    expect(regelnAusZh({ ausnuetzungsziffer_max: 205 }).az).toBeCloseTo(2.05, 5);
    expect(regelnAusZh({ ueberbauungsziffer_max: 22 }).uez).toBeCloseTo(0.22, 5);
    expect(regelnAusZh({ baumassenziffer_max: 4 }).bmz).toBe(4);
    // Damit gerechnet: 0.7 × 1000 m² = 700 m², nicht 70'000.
    expect(studieRechnen(eingabe({ zone: r })).gfNachZiffer).toBeCloseTo(700, 5);
  });

  it('ohne amtlichen Zonenplan: die eigene Liste, als solche gekennzeichnet', () => {
    const z = zoneAusBestand({ zone: 'Wohnzone 2/50 (rechtskräftig, 600m², 60%)', gemeinde: 'TEST' });
    expect(z?.regeln.quelle).toBe('bestand');
    expect(z?.regeln.vollgeschosse).toBe(2);
    expect(z?.bauzoneM2).toBe(600);
    expect(zoneAusBestand({ zone: 'Kantonale Landwirtschaftszone' })).toBeNull();
    expect(zoneAusBestand({ zone: null })).toBeNull();
  });

  it('Zeichnung: Norden oben, alles im Rahmen', () => {
    const z = zeichnung({ rahmen: [0, 0, 20, 10], umriss: { type: 'MultiPolygon', coordinates: [[[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]]] }, innen: null }, 100, 10)!;
    expect(z.meterJePixel).toBeCloseTo(0.25, 5);            // 20 m auf 80 Pixel
    expect(z.umriss.startsWith('M10.0 70.0')).toBe(true);   // Südwestecke unten links
    expect(z.innen).toBeNull();
    expect(zeichnung({ rahmen: null, umriss: null, innen: null })).toBeNull();
  });
});

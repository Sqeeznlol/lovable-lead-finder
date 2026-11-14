import { describe, expect, it } from 'vitest';
import { auszugKurz, dienstBasis, linien, text } from '../../../api/_lib/oereb.js';
import { gebaeudeAus, kacheln, lv95NachWgs84, wgs84NachLv95 } from '../../../api/_lib/modell.js';
import { modellAus, rechtZeilen, zonenKuerzel, type Recht } from '@/lib/check-modell';
import { weiter, type Tor } from '@/lib/ladebild-zeit';
import type { Befund } from '@/lib/check-daten';
import zh from './daten/oereb-zh.json';

describe('ÖREB-Auszug lesen', () => {
  it('Fällanden (Zürich, "code" klein geschrieben): Zone, Überlagerung, Lärm, Bauordnung', () => {
    const a = auszugKurz(zh, 2689693, 1246995)!;
    expect(a.zone?.text).toBe('Wohnzone eingeschossig (W1)');
    expect(a.weitere).toEqual(['Arealüberbauung zulässig']);
    expect(a.es).toMatch(/Empfindlichkeitsstufe II/);
    expect(a.ordnung?.titel).toMatch(/^Bauordnung Gemeinde Fällanden/);
    expect(a.betroffen.map(t => t.code)).toContain('ch.Sicherheitszonenplan');
    expect(a.nichtBetroffen.map(t => t.code)).toContain('ch.BelasteteStandorte');
    expect(a.baulinien?.laenge).toBe(36);
  });
  it('Zone nach Namen, nicht nach Anteil (Aarau: Erschliessungsplan deckt auch 100 %)', () => {
    const r = (legende: string) => ({ Theme: { Code: 'ch.Nutzungsplanung', Text: [{ Language: 'de', Text: 'Nutzungsplanung (kantonal/kommunal)' }] }, LegendText: [{ Language: 'de', Text: legende }], AreaShare: 83, PartInPercent: 100 });
    const a = auszugKurz({ GetExtractByIdResponse: { extract: { RealEstate: { RestrictionOnLandownership: [r('Totalrevision Erschliessungspläne Plan Nr. 11'), r('Zone Altstadt A [ASA]')] } } } }, 0, 0)!;
    expect(a.zone?.text).toBe('Zone Altstadt A [ASA]');
  });
  it('Texte und Linien in beiden Schreibweisen (Nidwalden: LocalisedText, GML)', () => {
    expect(text({ LocalisedText: { Language: 'de', Text: 'Grundnutzung Stans' } })).toBe('Grundnutzung Stans');
    expect(text([{ Language: 'fr', Text: 'Zone' }, { Language: 'de', Text: 'Zone D' }])).toBe('Zone D');
    expect(linien({ 'geo:coord': [{ 'geo:c1': '2670616.399', 'geo:c2': '1201114.546' }, { 'geo:c1': '2670628.8', 'geo:c2': '1201131.1' }] })).toEqual([[[2670616.399, 1201114.546], [2670628.8, 1201131.1]]]);
    expect(linien({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([[[1, 2], [3, 4]]]);
  });
  it('Dienstadresse ohne Beispielaufruf (Zug)', () => {
    expect(dienstBasis('https://oereb.zg.ch/oereb/extract/xml?EGRID=CH1&GEOMETRY=true')).toBe('https://oereb.zg.ch/oereb');
    expect(dienstBasis('https://maps.zh.ch/oereb/v2/')).toBe('https://maps.zh.ch/oereb/v2');
  });
});

describe('Gebäudemodell', () => {
  it('Koordinaten hin und zurück auf unter einem Meter', () => {
    const w = lv95NachWgs84(2689693, 1246995), p = wgs84NachLv95(w.lat, w.lon);
    expect(Math.hypot(p.e - 2689693, p.n - 1246995)).toBeLessThan(1);
  });
  it('Kacheln um Fällanden: Stufe 14, die Kachel des Hauses ist dabei', () => {
    expect(kacheln(2689693, 1246995).length).toBeGreaterThanOrEqual(1);
  });
  it('Eigenes Haus liegt auf der Parzelle, Geschosse aus dem Register', () => {
    const quadrat = (x: number, y: number, s: number) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
    const b = { haeuser: [{ status: 1004, geschosse: 2 }], teile: [] } as unknown as Befund;
    const m = modellAus([{ h: 8, r: quadrat(-5, -5, 10) }, { h: 6, r: quadrat(40, 40, 10) }], quadrat(-20, -20, 40), b);
    expect(m.eigene).toHaveLength(1); expect(m.nachbarn).toHaveLength(1); expect(m.geschosse).toBe(2);
  });
  it('Gebäude ausserhalb von 100 m fallen weg', () => {
    const w = lv95NachWgs84(2689693, 1246995), weit = lv95NachWgs84(2689893, 1246995);
    const ring = (p: { lat: number; lon: number }) => [[p.lon, p.lat], [p.lon + 0.0001, p.lat], [p.lon + 0.0001, p.lat + 0.0001], [p.lon, p.lat]];
    expect(gebaeudeAus([{ h: 5, ring: ring(w) }, { h: 5, ring: ring(weit) }], 2689693, 1246995)).toHaveLength(1);
  });
});

describe('Was auf der Parzelle gilt', () => {
  const b = { kanton: 'ZH', zone: 'Wohnzonen', haeuser: [{ status: 1004, energie: 7510 }] } as unknown as Befund;
  it('nur Abgefragtes, Heizung nicht doppelt', () => {
    const r: Recht = { egrid: 'CH1', pdf: 'https://x/pdf', auszug: auszugKurz(zh, 2689693, 1246995), bund: { kulturgueter: [] } };
    const z = rechtZeilen(r, b);
    expect(z.map(x => x.titel)).toEqual(['Zone', 'Bauordnung', 'Baulinie', 'Lärm', 'Flughafen', 'Denkmal', 'Altlasten', 'Wasser, Wald']);
    expect(z.find(x => x.titel === 'Denkmal')?.zusatz).toBe('kantonale Inventare nicht geprüft');
  });
  it('ohne Auszug (Luzern, Zug, Solothurn) nur die Zone vom Bund', () => {
    expect(rechtZeilen(null, b).map(x => x.titel)).toEqual(['Zone']);
  });
  it('Kürzel der Zone', () => {
    expect(zonenKuerzel('Wohnzone eingeschossig (W1)')).toBe('W1');
    expect(zonenKuerzel('Zone Altstadt A [ASA]')).toBe('ASA');
    expect(zonenKuerzel('Wohn- Gewerbezone 3')).toBeNull();
  });
});

describe('Uhr des Ladebilds', () => {
  it('wartet am Tor, bis die Daten da sind, höchstens so lange wie erlaubt', () => {
    let da = false; const tore: Tor[] = [{ bei: 250, offen: () => da, hoechstens: 1000 }];
    const g = new Map<number, number>(), p = new Set<number>();
    let u = 0; for (let i = 0; i < 20; i++) u = weiter(u, 16, tore, g, p);
    expect(u).toBe(250);
    da = true; u = weiter(u, 16, tore, g, p); expect(u).toBe(266);
  });
  it('geht nach der Höchstzeit ohne Daten weiter', () => {
    const tore: Tor[] = [{ bei: 100, offen: () => false, hoechstens: 200 }];
    const g = new Map<number, number>(), p = new Set<number>();
    let u = 0; for (let i = 0; i < 40; i++) u = weiter(u, 16, tore, g, p);
    expect(u).toBeGreaterThan(300);
  });
});

describe('Baujahr oder Bauperiode', () => {
  it('ohne Jahr die Periode, Perioden ab ihrem Anfang verglichen', async () => {
    const { bauzeit, aeltestes } = await import('@/lib/check-daten');
    expect(bauzeit({ baujahr: 1961, periode: 8014 })).toBe('1961');
    expect(bauzeit({ baujahr: null, periode: 8013 })).toBe('1946–1960');
    expect(bauzeit({ baujahr: null, periode: null })).toBeNull();
    expect(aeltestes([{ baujahr: 1950, periode: 8013 }, { baujahr: null, periode: 8011 }])).toBe('vor 1919');
    expect(aeltestes([{ baujahr: 1930, periode: 8012 }, { baujahr: null, periode: 8013 }])).toBe('1930');
    expect(aeltestes([])).toBeNull();
  });
});

describe('Heizung: Energiequelle, sonst Wärmeerzeuger', () => {
  it('unbestimmt mit Wärmepumpe ergibt Wärmepumpe', async () => {
    const { heizungText } = await import('@/lib/check-daten');
    expect(heizungText({ energie: 7520, erzeuger: 7434 })).toBe('Gas');
    expect(heizungText({ energie: 7598, erzeuger: 7410 })).toBe('Wärmepumpe');
    expect(heizungText({ energie: null, erzeuger: 7460 })).toBe('Wärmetauscher (z. B. Fernwärme)');
    expect(heizungText({ energie: 7599, erzeuger: 7499 })).toBe('andere');
    expect(heizungText({ energie: null, erzeuger: null })).toBeNull();
  });
});

describe('Energie und Lage', () => {
  it('Solar ab «gut», sonst beste vorhandene Klasse; Wärmenetz das nächste', async () => {
    const { solarAus, waermenetzAus } = await import('../../../api/_lib/umgebung.js');
    expect(solarAus([{ klasse: 2, flaeche: 129.4, stromertrag: 18871 }, { klasse: 2, flaeche: 88.8, stromertrag: 13150, klasse_text: 'Mittel##x' }])).toEqual({ kwh: 32021, flaeche: 218, eignung: 'Mittel' });
    expect(solarAus([{ klasse: 4, flaeche: 50, stromertrag: 9000, klasse_text: 'Sehr gut##' }, { klasse: 1, flaeche: 30, stromertrag: 100 }])).toEqual({ kwh: 9000, flaeche: 50, eignung: 'Sehr gut' });
    expect(solarAus([])).toBeNull();
    const netz = waermenetzAus([{ geometry: { coordinates: [100, 0] }, properties: { name: 'Fern' } }, { geometry: { coordinates: [30, 40] }, properties: { name: 'Nah', operator: 'EWB' } }], 0, 0);
    expect(netz).toMatchObject({ name: 'Nah', betreiber: 'EWB', meter: 50 });
  });
  it('Zeilen: ohne Netz klar gesagt, ÖV lesbar', async () => {
    const { umgebungZeilen } = await import('@/lib/check-modell');
    const z = umgebungZeilen({ solar: null, waermenetz: null, oev: 'D - geringe Erschliessung', radon: 3 });
    expect(z.map(x => x.wert)).toEqual(['Kein Wärmenetz im Umkreis von 1,5 km', 'Güteklasse D, geringe Erschliessung', '3 % Wahrscheinlichkeit über dem Referenzwert']);
  });
});

describe('Teilbarer Link', () => {
  it('hin und zurück, nur Punkte in der Schweiz', async () => {
    const { linkFuer, ortAusLink } = await import('@/lib/check-daten');
    const o = { label: 'Sängglenstrasse 11, 8118 Fällanden', e: 2689693.4, n: 1246995.1 };
    expect(ortAusLink('?' + linkFuer(o))).toEqual({ label: o.label, e: 2689693, n: 1246995 });
    expect(ortAusLink('?adresse=x&e=1&n=2')).toBeNull();
    expect(ortAusLink('?e=2689693&n=1246995')).toBeNull();
  });
});

describe('Was die Zone erlaubt (Zürich)', () => {
  it('liest Ziffern, Prozent wird zu Bruch', async () => {
    const { zhZiffernAus } = await import('../../../api/_lib/ziffern.js');
    const f = (felder: Record<string, string>) => `<ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f>${Object.entries(felder).map(([k, v]) => `<ms:${k}>${v}</ms:${k}>`).join('')}</ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f>`;
    expect(zhZiffernAus(f({ typ_gde_abkuerzung: 'W1', baumassenziffer_max: '1.2', vollgeschosse_max: '1', fassadenhoehe: '4.5' })))
      .toMatchObject({ kuerzel: 'W1', bmz: 1.2, vollgeschosse: 1, fassadenhoehe: 4.5, az: null });
    expect(zhZiffernAus(f({ typ_gde_abkuerzung: 'W3/70G', ausnuetzungsziffer_max: '70', vollgeschosse_max: '3' }))).toMatchObject({ az: 0.7, vollgeschosse: 3 });
    expect(zhZiffernAus(f({ typ_gde_abkuerzung: 'X' }))).toBeNull();
    expect(zhZiffernAus('<leer/>')).toBeNull();
  });
});

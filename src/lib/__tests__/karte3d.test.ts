import { afterEach, describe, expect, it, vi } from 'vitest';
import { baujahrFarbe, dachSpanne, gebaeudeBeimBund, heizGruppe, hoeheFarbe, punktImRing, zonenArt } from '@/lib/karte3d';

describe('zonenArt', () => {
  it('färbt Wohnzonen nach Geschossen, die übrigen nach Gruppe', () => {
    expect(zonenArt('C1102').titel).toBe('Wohnzone 2 Geschosse');
    expect(zonenArt('C1105').titel).toBe('Wohnzone 5+ Geschosse');
    // Quartiererhaltung ist ein Code innerhalb der Kernzonen (C13): sie
    // muss vor der allgemeinen Regel kommen.
    expect(zonenArt('C1306').titel).toBe('Quartiererhaltung');
    expect(zonenArt('C1307').titel).toBe('Kernzone');
    expect(zonenArt('C1401').titel).toBe('Zentrumszone');
    expect(zonenArt(null).titel).toBe('Übrige Zone');
  });
});

describe('heizGruppe', () => {
  it('teilt nach dem amtlichen Text ein, nicht nach Codenummern', () => {
    expect(heizGruppe('Heizöl')?.titel).toBe('Heizöl');
    expect(heizGruppe('Gas')?.titel).toBe('Gas');
    expect(heizGruppe('Erdwärmesonde')?.titel).toBe('Wärmepumpe');
    expect(heizGruppe('Luft')?.titel).toBe('Wärmepumpe');
    expect(heizGruppe('Fernwärme (Hochtemperatur)')?.titel).toBe('Fernwärme');
    expect(heizGruppe('Holz (Pellets)')?.titel).toBe('Holz');
    expect(heizGruppe('Elektrizität')?.titel).toBe('Strom');
    expect(heizGruppe('Unbestimmt')?.titel).toBe('Andere');
    expect(heizGruppe(null)).toBeNull();
  });
  it('liest "Gas" nicht aus Wörtern, in denen es nur steckt', () => {
    // Fossil gilt nur, was wirklich Gas ist -- eine Wärmepumpe darf nicht violett werden.
    expect(heizGruppe('Wärmepumpe')?.fossil).toBe(false);
  });
});

describe('Farbstufen', () => {
  it('Baujahr und Höhe fallen in die richtige Stufe, leer bleibt leer', () => {
    expect(baujahrFarbe(1890)).toBe('#9E2A2B');
    expect(baujahrFarbe(2016)).toBe('#6FA8DC');
    expect(baujahrFarbe(null)).toBeNull();
    expect(hoeheFarbe(27)).toBe('#5A8BD0');
    expect(hoeheFarbe(null)).toBeNull();
  });
});

describe('dachSpanne', () => {
  it('rechnet über dem Gelände, nicht über Meer', () => {
    // Werte aus einer Kachel des Bundes (EGID 2364942): Gelände 408.79,
    // Dach 412.08 bis 424.96.
    expect(dachSpanne(412.08, 424.96, 408.79)).toBe('3–16 m');
  });
  it('nennt ein Dach flach, wenn tiefster und höchster Punkt beieinander liegen', () => {
    expect(dachSpanne(435.6, 435.6, 416.89)).toBe('flach, 19 m');
  });
  it('rät nicht, wenn ein Wert fehlt', () => {
    expect(dachSpanne(null, 424.96, 408.79)).toBe('–');
  });
});

describe('gebaeudeBeimBund', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Auszug der Antwort von api3.geo.admin.ch für EGID 302061147, am
  // 3. November abgefragt.
  const antwort = {
    results: [{
      featureId: '302061147_0',
      attributes: {
        egid: '302061147', egrid: 'CH739978917069', strname_deinr: 'Freilagerstrasse 99', dplz4: 8047, dplzname: 'Zürich',
        gbauj: 2016, gastw: 10, ganzwhg: 26, garea: 560, gebf: 5040, gwaerzh1: 7410, genh1: 7511, genw1: 7511,
        gwaerdath1: '11.11.2020',
      },
    }],
  };

  it('liest Adresse, Zahlen und Heizung aus der Antwort', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(antwort)));
    vi.stubGlobal('fetch', f);
    const r = await gebaeudeBeimBund(302061147);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('searchText=302061147');
    expect(r?.adresse).toBe('Freilagerstrasse 99, 8047 Zürich');
    expect(r?.geb).toMatchObject({
      egid: 302061147, egrid: 'CH739978917069', baujahr: 2016, geschosse: 10, wohnungen: 26, grundflaeche: 560,
      energieflaeche: 5040, heizung: 7410, heizung_energie: 7511, warmwasser_energie: 7511, heizung_seit: '2020-11-11',
    });
  });

  it('gibt nichts zurück, wenn der Bund das Gebäude nicht kennt oder nicht antwortet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ results: [] }))));
    expect(await gebaeudeBeimBund(1)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    expect(await gebaeudeBeimBund(1)).toBeNull();
  });

  it('lässt leere Felder leer statt null als 0 zu lesen', async () => {
    const leer = { results: [{ attributes: { strname_deinr: '', gbauj: null, gastw: '', genh1: null } }] };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(leer))));
    const r = await gebaeudeBeimBund(5);
    expect(r?.adresse).toBeNull();
    expect(r?.geb.baujahr).toBeNull();
    expect(r?.geb.geschosse).toBeNull();
    expect(r?.geb.heizung_energie).toBeNull();
  });
});

describe('punktImRing', () => {
  // Ein L-förmiger Umriss: die Ecke rechts oben gehört nicht dazu.
  const l = [[8.48, 47.37], [8.50, 47.37], [8.50, 47.38], [8.49, 47.38], [8.49, 47.39], [8.48, 47.39], [8.48, 47.37]];
  it('erkennt Punkte innen und aussen, auch in der Aussparung', () => {
    expect(punktImRing(8.485, 47.385, l)).toBe(true);
    expect(punktImRing(8.495, 47.375, l)).toBe(true);
    expect(punktImRing(8.495, 47.385, l)).toBe(false);
    expect(punktImRing(8.47, 47.375, l)).toBe(false);
  });
});

describe('inZuerich', () => {
  it('nimmt das eigene Verzeichnis nur im Rahmen, für den es gebaut ist', async () => {
    const { inZuerich } = await import('@/lib/karte3d');
    expect(inZuerich(47.379, 8.488)).toBe(true);   // Albisrieden
    expect(inZuerich(47.5, 8.73)).toBe(true);      // Winterthur
    expect(inZuerich(46.95, 7.45)).toBe(false);    // Bern
    expect(inZuerich(47.56, 7.59)).toBe(false);    // Basel
  });
});

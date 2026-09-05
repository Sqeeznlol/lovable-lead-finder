import { describe, it, expect } from 'vitest';
import { beurteile, eigentuemertyp } from './akquise';
import { gemeindeprofil } from './gemeinden-zh';

/** Ein Objekt, bei dem baulich klar etwas geht. */
const gutesObjekt = {
  zone: 'Wohnzone 2.4 (rechtskräftig, 2000m², 100%)',
  area: 2000, gebaeudeflaeche: 180, geschosse: 2, baujahr: 1955,
  denkmalschutz: 'nicht vorhanden', wohnungen: 2,
};

describe('eigentuemertyp', () => {
  it('erkennt Erbengemeinschaften', () => {
    expect(eigentuemertyp('Erbengemeinschaft Meier')).toBe('erbengemeinschaft');
    expect(eigentuemertyp('Erben des Hans Müller')).toBe('erbengemeinschaft');
    expect(eigentuemertyp('Hans Müller und Anna Müller-Weber')).toBe('erbengemeinschaft');
  });

  it('erkennt institutionelle Halter', () => {
    // Die verkaufen praktisch nie — ein Anruf dort ist verlorene Zeit.
    expect(eigentuemertyp('Pensionskasse der Stadt Zürich')).toBe('institutionell');
    expect(eigentuemertyp('Swiss Life AG')).toBe('institutionell');
    expect(eigentuemertyp('Anlagestiftung Turidomus')).toBe('institutionell');
  });

  it('erkennt die öffentliche Hand', () => {
    expect(eigentuemertyp('Gemeinde Uster')).toBe('oeffentlich');
    expect(eigentuemertyp('Kanton Zürich')).toBe('oeffentlich');
    expect(eigentuemertyp('Baugenossenschaft Zurlinden')).toBe('oeffentlich');
  });

  it('erkennt Firmen und Privatpersonen', () => {
    expect(eigentuemertyp('Muster Immobilien AG')).toBe('firma');
    expect(eigentuemertyp('Hans Müller')).toBe('privat');
    expect(eigentuemertyp(null)).toBe('unbekannt');
  });
});

describe('gemeindeprofil', () => {
  it('unterscheidet Spitzenlage von Randlage', () => {
    expect(gemeindeprofil('Küsnacht').erloesProM2).toBeGreaterThan(
      gemeindeprofil('Bauma').erloesProM2 * 2,
    );
  });
  it('nimmt für unbekannte Gemeinden die vorsichtige Mitte', () => {
    expect(gemeindeprofil('Irgendwo').stufe).toBe('mittel');
  });
});

describe('beurteile', () => {
  it('empfiehlt den Anruf bei Erbengemeinschaft, Altbau und guter Lage', () => {
    const u = beurteile({ ...gutesObjekt, gemeinde: 'Küsnacht', owner_name: 'Erbengemeinschaft Meier' });
    expect(u.empfehlung).toBe('anrufen');
    expect(u.dafuer.join(' ')).toContain('Erbengemeinschaft');
    expect(u.dafuer.join(' ')).toContain('1955');
  });

  it('rät ab, wenn eine Pensionskasse hält — trotz gleichem Bauobjekt', () => {
    const erbe = beurteile({ ...gutesObjekt, gemeinde: 'Küsnacht', owner_name: 'Erbengemeinschaft Meier' });
    const kasse = beurteile({ ...gutesObjekt, gemeinde: 'Küsnacht', owner_name: 'Pensionskasse der Stadt Zürich' });
    expect(kasse.punkte).toBeLessThan(erbe.punkte);
    expect(kasse.dagegen.join(' ')).toContain('hält langfristig');
  });

  it('bewertet dasselbe Objekt in Spitzenlage höher als in der Randlage', () => {
    const see = beurteile({ ...gutesObjekt, gemeinde: 'Herrliberg', owner_name: 'Hans Müller' });
    const land = beurteile({ ...gutesObjekt, gemeinde: 'Bauma', owner_name: 'Hans Müller' });
    expect(see.margeLagegerecht!).toBeGreaterThan(land.margeLagegerecht!);
    expect(see.punkte).toBeGreaterThanOrEqual(land.punkte);
  });

  it('schliesst Denkmalschutz und Nicht-Bauzonen ohne Umweg aus', () => {
    expect(beurteile({ ...gutesObjekt, denkmalschutz: 'vorhanden' }).empfehlung).toBe('nein');
    expect(beurteile({ ...gutesObjekt, zone: 'Kantonale Landwirtschaftszone' }).empfehlung).toBe('nein');
    expect(beurteile({ ...gutesObjekt, zone: 'Gewerbezone B' }).empfehlung).toBe('nein');
  });

  it('wertet Neubauten ab', () => {
    const alt = beurteile({ ...gutesObjekt, baujahr: 1950, gemeinde: 'Meilen', owner_name: 'Hans Müller' });
    const neu = beurteile({ ...gutesObjekt, baujahr: 2015, gemeinde: 'Meilen', owner_name: 'Hans Müller' });
    expect(neu.punkte).toBeLessThan(alt.punkte);
    expect(neu.dagegen.join(' ')).toContain('zu jung');
  });

  it('merkt an, wenn viele Mietverhältnisse im Weg stehen', () => {
    const u = beurteile({ ...gutesObjekt, wohnungen: 18, gemeinde: 'Zürich', owner_name: 'Hans Müller' });
    expect(u.dagegen.join(' ')).toContain('Mietverhältnisse');
  });

  it('gibt bei fehlendem Potenzial keine Empfehlung zum Anruf', () => {
    const u = beurteile({ zone: null, area: null, gebaeudeflaeche: null, gemeinde: 'Zürich' });
    expect(['nein', 'zurueckstellen']).toContain(u.empfehlung);
    expect(u.dagegen.join(' ')).toContain('Kein Potenzial berechenbar');
  });

  it('liefert immer eine Begründung', () => {
    const u = beurteile({ ...gutesObjekt, gemeinde: 'Uster', owner_name: 'Hans Müller' });
    expect(u.dafuer.length + u.dagegen.length).toBeGreaterThan(0);
    expect(u.punkte).toBeGreaterThanOrEqual(0);
    expect(u.punkte).toBeLessThanOrEqual(100);
  });
});

describe('Fälle, in denen die Punktzahl in die Irre führt', () => {
  // Beides fiel erst auf, als die Liste mit echten Namen und Baujahren im
  // Browser stand: eine grosse Marge überstimmte alles andere.
  const seeObjekt = {
    zone: 'Wohnzone 2.4 (rechtskräftig, 3000m², 100%)',
    area: 3000, gebaeudeflaeche: 200, geschosse: 2,
    denkmalschutz: 'nicht vorhanden', gemeinde: 'Küsnacht', wohnungen: 3,
  };

  it('rät bei Pensionskassen nie zum Anruf, egal wie gross die Marge', () => {
    const u = beurteile({ ...seeObjekt, baujahr: 1955, owner_name: 'Pensionskasse Zürich' });
    expect(u.empfehlung).not.toBe('anrufen');
    expect(u.empfehlung).not.toBe('pruefen');
    expect(u.dagegen.join(' ')).toContain('verkauft praktisch nie');
  });

  it('rät auch bei der öffentlichen Hand ab', () => {
    const u = beurteile({ ...seeObjekt, baujahr: 1950, owner_name: 'Gemeinde Küsnacht' });
    expect(['zurueckstellen', 'nein']).toContain(u.empfehlung);
  });

  it('empfiehlt keinen Ersatzneubau bei junger Bausubstanz', () => {
    const jung = beurteile({ ...seeObjekt, baujahr: 2012, owner_name: 'Hans Müller' });
    expect(jung.empfehlung).not.toBe('anrufen');
    const ganzNeu = beurteile({ ...seeObjekt, baujahr: 2020, owner_name: 'Hans Müller' });
    expect(ganzNeu.empfehlung).toBe('nein');
  });

  it('lässt den Altbau in derselben Lage weiterhin oben', () => {
    const u = beurteile({ ...seeObjekt, baujahr: 1955, owner_name: 'Erbengemeinschaft Meier' });
    expect(u.empfehlung).toBe('anrufen');
  });
});

describe('Plausibilität', () => {
  // Beides stand in der echten Liste ganz oben und hätte zu Anrufen
  // geführt, die niemand ernst nimmt.
  it('stuft unplausibel grosse Bauzonenflächen auf Prüfen zurück', () => {
    const u = beurteile({
      zone: 'Wohnzone 2.4', area: 119105, gebaeudeflaeche: 300, geschosse: 2,
      baujahr: 1960, gemeinde: 'Winterthur', owner_name: 'Hans Müller',
      denkmalschutz: 'nicht vorhanden',
    });
    expect(u.empfehlung).toBe('pruefen');
    expect(u.dagegen.join(' ')).toContain('unplausibel');
  });

  it('warnt bei sehr alter Bausubstanz vor dem Schutzstatus', () => {
    const u = beurteile({
      zone: 'Kernzone (rechtskräftig, 2000m², 100%)', area: 2000,
      gebaeudeflaeche: 200, geschosse: 2, baujahr: 1786,
      gemeinde: 'Elgg', owner_name: 'Hans Müller', denkmalschutz: 'nicht vorhanden',
    });
    expect(u.dagegen.join(' ')).toContain('Schutzstatus');
  });
});

describe('Woran man das Potenzial festmacht', () => {
  const basis = {
    zone: '3-geschossige Wohnzone (rechtskräftig, 2000m², 100%)',
    area: 2000, bebaubar_m2: 2000, gebaeudeflaeche: 120,
    geschosse: 2, baujahr: 1960, gemeinde: 'Küsnacht',
    owner_name: 'Hans Müller', denkmalschutz: 'nicht vorhanden',
    isos: 'nicht vorhanden', wohnungen: 2,
  };

  it('nennt das ungenutzte Geschoss beim Namen', () => {
    // Das greifbarste Argument am Telefon: es fehlt ein ganzes Geschoss.
    const u = beurteile(basis);
    expect(u.dafuer.some(t => /Geschoss ungenutzt/.test(t))).toBe(true);
    expect(u.dafuer.some(t => /2 Geschosse gebaut, 3 erlaubt/.test(t))).toBe(true);
  });

  it('nennt das ungenutzte Land, wenn das Haus verloren darauf steht', () => {
    const u = beurteile(basis);
    expect(u.dafuer.some(t => /% der Parzelle/.test(t))).toBe(true);
  });

  it('schweigt, wo nichts ungenutzt ist', () => {
    // Drei Geschosse gebaut, drei erlaubt, Parzelle dicht bebaut.
    const u = beurteile({ ...basis, geschosse: 3, gebaeudeflaeche: 700 });
    expect(u.dafuer.some(t => /ungenutzt/.test(t))).toBe(false);
    expect(u.dafuer.some(t => /% der Parzelle/.test(t))).toBe(false);
  });

  it('bewertet ein ungenutztes Geschoss höher als keines', () => {
    // An einem Objekt, das nicht ohnehin am Anschlag steht: in einer
    // günstigen Lage und mit einem Eigentümertyp, der zurückhaltender
    // ist, bleibt Raum nach oben.
    const knapp = {
      ...basis, gemeinde: 'Bauma', owner_name: 'Muster AG',
      area: 900, bebaubar_m2: 900, gebaeudeflaeche: 150, baujahr: 1975,
    };
    const mit = beurteile(knapp);
    const ohne = beurteile({ ...knapp, geschosse: 3 });
    expect(mit.punkte).toBeGreaterThan(ohne.punkte);
  });

  it('sättigt bei hundert -- dort sortiert nur noch die Marge', () => {
    // Festgehalten, nicht behoben: die Skala endet bei hundert, und in
    // Spitzenlagen erreichen viele Objekte diesen Wert. Die Reihenfolge
    // entsteht dort über die Marge, nicht über die Punkte. Für die Frage
    // "welche fünf schlage ich heute nach" reicht das nicht; eine feinere
    // Skala wäre der nächste Schritt.
    const a = beurteile(basis);
    const b = beurteile({ ...basis, geschosse: 3 });
    expect(a.punkte).toBe(100);
    expect(b.punkte).toBe(100);
  });
});

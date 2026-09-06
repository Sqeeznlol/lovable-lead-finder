import { describe, it, expect } from 'vitest';
import { leseAuskunft } from '../eigentuemer';

describe('leseAuskunft', () => {
  it('liest eine Zürcher Auskunft', () => {
    // Wortlaut aus dem Portal Objektwesen.
    const text = `Eigentümerinnen und Eigentümer
A. Bommer Immobilien AG, mit Sitz in Zürich, Aktiengesellschaft, Schweighofstrasse 409, 8055 Zürich, Schweiz, Alleineigentum`;
    const o = leseAuskunft(text);
    expect(o).toHaveLength(1);
    expect(o[0].name).toBe('A. Bommer Immobilien AG');
    expect(o[0].address).toBe('Schweighofstrasse 409');
    expect(o[0].plz).toBe('8055');
    expect(o[0].ort).toBe('Zürich');
    expect(o[0].ownershipType).toBe('Alleineigentum');
  });

  it('liest mehrere Miteigentümer', () => {
    const text = `Walter Bossart, Alte Landstrasse 70, 8596 Scherzingen, 1/2 Miteigentum
Margaretha Maria Bossart-Högger, Alte Landstrasse 70, 8596 Scherzingen, 1/2 Miteigentum`;
    const o = leseAuskunft(text);
    expect(o).toHaveLength(2);
    expect(o[1].name).toBe('Margaretha Maria Bossart-Högger');
    expect(o[1].ort).toBe('Scherzingen');
  });

  it('lässt Überschriften und Feldnamen weg', () => {
    const text = `Grundstück Nr. 454
E-GRID CH770977292983
Gemeinde Diessenhofen
BFSNr 4545
Hans Müller, Dorfstrasse 3, 8253 Diessenhofen, Alleineigentum`;
    const o = leseAuskunft(text);
    expect(o).toHaveLength(1);
    expect(o[0].name).toBe('Hans Müller');
  });

  it('nimmt den Anteil aus dem Namen', () => {
    // "1/2" gehört nicht in den Namen, mit dem telefoniert wird.
    const o = leseAuskunft('Meier Hans 1/2, Seeweg 4, 8590 Romanshorn');
    expect(o[0].name).toBe('Meier Hans');
  });

  it('liefert nichts bei leerem Text', () => {
    expect(leseAuskunft('')).toEqual([]);
    expect(leseAuskunft('nur irgendein Satz ohne alles')).toEqual([]);
  });
});

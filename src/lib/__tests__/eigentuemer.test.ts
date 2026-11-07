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

  it('liest die Thurgauer Auskunft', () => {
    // Wortlaut aus map.geo.tg.ch, Liegenschaft 447 Diessenhofen.
    // Zwei Leerzeichen nach dem Namen und der Anteil "1/1" am Schluss.
    const o = leseAuskunft('Rudolf Gubler,  Grabenstrasse 12, 8253 Diessenhofen, 1/1');
    expect(o).toHaveLength(1);
    expect(o[0].name).toBe('Rudolf Gubler');
    expect(o[0].address).toBe('Grabenstrasse 12');
    expect(o[0].plz).toBe('8253');
    expect(o[0].ort).toBe('Diessenhofen');
  });

  it('übergeht die Zusatzangaben des Thurgauer Auszugs', () => {
    // Sie tragen Postleitzahlen und sähen sonst wie Eigentümer aus.
    const text = `Grundbuch-Auszug
Eigentümerinformationen
Rudolf Gubler,  Grabenstrasse 12, 8253 Diessenhofen, 1/1
Zusätzliche Informationen
Grundbuch: Nr. 4545 Diessenhofen
Grundstück: Liegenschaft Nr. 447 ( CH627728290920 )
Fläche(n): 1'567 m² Nebengebäude (nv), Grabenstrasse, 8253 Diessenhofen [11 m²]
Dieser Auszug kann nicht als gültiger Grundbuchauszug verwendet werden.`;
    const o = leseAuskunft(text);
    expect(o.map(x => x.name)).toEqual(['Rudolf Gubler']);
  });

  it('liest den Auszug, wie er auf dem Schirm steht', () => {
    // Wortlaut aus ThurGIS, Liegenschaft 669 Diessenhofen. Die
    // Flächenangabe darunter trägt "8253 Diessenhofen" und sähe sonst
    // wie ein zweiter Eigentümer aus.
    const text = `Grundbuch-Auszug
Eigentümerinformationen
Simon Gränicher,  Widacherring 10, 6102 Malters, 1/1
Zusätzliche Informationen
Grundbuch: Nr. 4545 Diessenhofen
Grundstück: Liegenschaft Nr. 669 ( CH932977092161 )
Fläche(n): 1'367 m² Garage Assek.Nr. 162.1276, Schlatterstrasse, 8253 Diessenhofen [52 m²]`;
    const o = leseAuskunft(text);
    expect(o).toHaveLength(1);
    expect(o[0].name).toBe('Simon Gränicher');
    expect(o[0].address).toBe('Widacherring 10');
    expect(o[0].plz).toBe('6102');
    expect(o[0].ort).toBe('Malters');
  });

  it('lässt die Handelsregisternummer weg', () => {
    // Parzelle 454: die UID trägt Ziffern und stand als Adresse im
    // Eintrag -- die Rheinstrasse fiel dabei unter den Tisch.
    const o = leseAuskunft(
      'Heinz Ulmer Immobilien AG,  Aktiengesellschaft, mit Sitz in '
      + 'Schaffhausen SH, UID CHE-216.013.073, Rheinstrasse 40, '
      + '8200 Schaffhausen, 1/1');
    expect(o).toHaveLength(1);
    expect(o[0].name).toBe('Heinz Ulmer Immobilien AG');
    expect(o[0].address).toBe('Rheinstrasse 40');
    expect(o[0].plz).toBe('8200');
    expect(o[0].ort).toBe('Schaffhausen');
  });
});

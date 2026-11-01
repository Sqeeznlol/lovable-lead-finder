import { describe, expect, it } from 'vitest';
import { zeilenLesen } from '../portfolio-import';

describe('Portfolio-Import: Liste lesen', () => {
  it('eine Adresse je Zeile, leere Zeilen und Doppel fallen weg', () => {
    expect(zeilenLesen('Seestrasse 1, 8002 Zürich\n\n  Bahnhofstrasse 9 8001 Zürich \nSeestrasse 1, 8002 Zürich'))
      .toEqual([
        { roh: 'Seestrasse 1, 8002 Zürich', egrid: null },
        { roh: 'Bahnhofstrasse 9 8001 Zürich', egrid: null },
      ]);
  });

  it('setzt Spalten aus Excel oder CSV zu einer Adresse zusammen und lässt die Kopfzeile weg', () => {
    expect(zeilenLesen('Adresse;PLZ;Ort\n"Feldweg 3";8302;"Kloten"\nRosenweg 5\t8600\tDübendorf'))
      .toEqual([
        { roh: 'Feldweg 3, 8302, Kloten', egrid: null },
        { roh: 'Rosenweg 5, 8600, Dübendorf', egrid: null },
      ]);
  });

  it('erkennt eine EGRID, auch klein geschrieben und mitten in der Zeile', () => {
    expect(zeilenLesen('ch507791809985\nParzelle CH707709971116 Kloten')).toEqual([
      { roh: 'ch507791809985', egrid: 'CH507791809985' },
      { roh: 'Parzelle CH707709971116 Kloten', egrid: 'CH707709971116' },
    ]);
  });
});

import { describe, it, expect } from 'vitest';
import { anrede, nachname, objektsatz, brieftext } from '../brief';

describe('nachname', () => {
  it('nimmt den letzten Namensteil', () => {
    expect(nachname('René Schmid')).toBe('Schmid');
    expect(nachname('Heinz Ulmer Immobilien AG')).toBe('AG');
  });
  it('versteht die Schreibweise mit Komma', () => {
    expect(nachname('Schmid, René')).toBe('Schmid');
  });
  it('lässt den Anteil weg', () => {
    expect(nachname('Meier Hans 1/2')).toBe('Hans');
  });
});

describe('anrede', () => {
  const einer = [{ name: 'René Schmid' }];
  const zwei = [{ name: 'Anna Meier' }, { name: 'Peter Meier' }];

  it('nennt Herr oder Frau, wenn es gewählt wurde', () => {
    expect(anrede('herr', einer)).toBe('Sehr geehrter Herr Schmid');
    expect(anrede('frau', einer)).toBe('Sehr geehrte Frau Schmid');
  });

  it('nennt beide, wenn zwei Eigentümer eingetragen sind', () => {
    expect(anrede('beide', zwei))
      .toBe('Sehr geehrte Frau Meier, sehr geehrter Herr Meier');
  });

  it('bleibt neutral, wenn nichts gewählt oder kein Name da ist', () => {
    // Aus einem Namen lässt sich das Geschlecht nicht ableiten --
    // geraten wäre hier peinlich.
    expect(anrede('neutral', einer)).toBe('Sehr geehrte Damen und Herren');
    expect(anrede('herr', [])).toBe('Sehr geehrte Damen und Herren');
  });
});

describe('objektsatz', () => {
  it('nennt Parzelle, Strasse und Ort', () => {
    expect(objektsatz({
      address: 'Waltalingerstrasse 19', parzelle: '1114',
      plz: '8526', gemeinde: 'Neunforn',
    })).toBe('Parzelle 1114 an der Waltalingerstrasse 19 in 8526 Neunforn');
  });

  it('kommt ohne Parzellennummer aus', () => {
    expect(objektsatz({ address: 'Dorfstrasse 3', plzOrt: '8253 Diessenhofen' }))
      .toBe('Dorfstrasse 3 in 8253 Diessenhofen');
  });
});

describe('brieftext', () => {
  it('enthält Anrede und Objekt', () => {
    const t = brieftext('herr', [{ name: 'René Schmid' }], {
      address: 'Waltalingerstrasse 19', parzelle: '1114',
      plz: '8526', gemeinde: 'Neunforn',
    });
    expect(t).toContain('Sehr geehrter Herr Schmid');
    expect(t).toContain('Parzelle 1114 an der Waltalingerstrasse 19 in 8526 Neunforn');
    expect(t).toContain('Freundliche Grüsse');
  });
});

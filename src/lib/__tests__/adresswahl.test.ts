import { describe, expect, it } from 'vitest';
import { adresseWaehlen, hausnummerLesen, nummerFehlt, suchtext } from '../adresswahl';

describe('Adresse aus den Vorschlägen des Bundes wählen', () => {
  it('nimmt den einzigen Vorschlag, der alle Wörter enthält', () => {
    expect(adresseWaehlen('Gerlisberg 7, Kloten',
      ['Gerlisberg 7 <b>8302 Kloten</b>', 'Gerlisberg 7a 8302 Kloten', 'Gerlisbergstrasse 7 8302 Kloten']))
      .toEqual({ index: 0 });
  });
  it('Nebeneingänge wie "7.1" sind nicht die 7 (echte Antworten aus Kloten)', () => {
    expect(adresseWaehlen('Gerlisberg 7, Kloten',
      ['Gerlisberg 7 8302 Kloten', 'Gerlisbergstrasse 7 8302 Kloten', 'Gerlisberg 7.1 8302 Kloten'])).toEqual({ index: 0 });
    expect(adresseWaehlen('Am Balsberg 36, Kloten', ['Am Balsberg 36 8302 Kloten', 'Am Balsberg 36.1 8302 Kloten'])).toEqual({ index: 0 });
    expect(adresseWaehlen('Haldenstrasse 30, Kloten', ['Haldenstrasse 30 8302 Kloten', 'Haldenstrasse 30.1 8302 Kloten'])).toEqual({ index: 0 });
  });
  it('ohne Ort und in mehreren Gemeinden: nachfragen (echte Antwort für "Seestrasse 301")', () => {
    expect(adresseWaehlen('Seestrasse 301', ['Seestrasse 301 3658 Merligen', 'Seestrasse 301 8038 Zürich', 'Seestrasse 301a 3658 Merligen']))
      .toEqual({ mehrdeutig: ['Seestrasse 301 3658 Merligen', 'Seestrasse 301 8038 Zürich', 'Seestrasse 301a 3658 Merligen'] });
  });
  it('versteht "str." als "strasse"', () => {
    expect(adresseWaehlen('Haldenstr. 30, 8302 Kloten', ['Haldenstrasse 30 8302 Kloten', 'Haldenstrasse 30 8152 Glattbrugg']))
      .toEqual({ index: 0 });
  });
  it('fragt nach, wenn ohne Ort zwei Gemeinden passen', () => {
    expect(adresseWaehlen('Hauptstrasse 3', ['Hauptstrasse 3 8302 Kloten', 'Hauptstrasse 3 8600 Dübendorf']))
      .toEqual({ mehrdeutig: ['Hauptstrasse 3 8302 Kloten', 'Hauptstrasse 3 8600 Dübendorf'] });
  });
  it('nimmt mit PLZ den ersten passenden', () => {
    expect(adresseWaehlen('Seestrasse 1 8002', ['Seestrasse 1 8002 Zürich', 'Seestrasse 1 8002 Zürich (Gebäude B)']))
      .toEqual({ index: 0 });
  });
  it('ein Vorschlag, auch wenn er anders geschrieben ist', () => {
    expect(adresseWaehlen('Lochäckerstr 18 Kloten', ['Lochäckerstrasse 18 8302 Kloten'])).toEqual({ index: 0 });
    expect(adresseWaehlen('x', [])).toEqual({ keine: true });
  });
});

// Julian, 17. November: «Dietlikerstrasse 55 in Kloten» fand nichts. Die Vorschläge unten sind echte Antworten des Bundes.
describe('Eine Hausnummer, die es nicht gibt', () => {
  const strasse = ['Dietlikerstrasse 50 8302 Kloten', 'Dietlikerstrasse 51 8302 Kloten', 'Dietlikerstrasse 52 8302 Kloten', 'Dietlikerstrasse 54 8302 Kloten',
    'Dietlikerstrasse 56 8302 Kloten', 'Dietlikerstrasse 57 8302 Kloten', 'Dietlikerstrasse 59 8302 Kloten', 'Dietlikerstrasse 50.1 8302 Kloten'];

  it('lässt das «in» nach der Hausnummer weg; Strassen wie «Im Grund» bleiben', () => {
    expect(suchtext('Dietlikerstrasse 55 in Kloten')).toBe('Dietlikerstrasse 55 Kloten');
    expect(suchtext('Seestrasse 3 bei Thalwil')).toBe('Seestrasse 3 Thalwil');
    expect(suchtext('Im Grund 5 Kloten')).toBe('Im Grund 5 Kloten');
    expect(suchtext('Dietlikerstrasse 55, Kloten')).toBe('Dietlikerstrasse 55 Kloten');
  });
  it('liest Strasse und Nummer', () => {
    expect(hausnummerLesen('Dietlikerstrasse 55 in Kloten')).toEqual({ strasse: 'Dietlikerstrasse', nummer: '55', rest: 'Kloten' });
    expect(hausnummerLesen('Am Balsberg 36a, 8302 Kloten')).toEqual({ strasse: 'Am Balsberg', nummer: '36a', rest: '8302 Kloten' });
    expect(hausnummerLesen('Kloten')).toBeNull();
  });
  it('meldet die fehlende Nummer mit den nächsten: 54, 56, dann 57', () => {
    const f = nummerFehlt('Dietlikerstrasse 55 in Kloten', strasse);
    expect(f?.nummer).toBe('55');
    expect(f!.naechste.map(i => strasse[i])).toEqual(['Dietlikerstrasse 54 8302 Kloten', 'Dietlikerstrasse 56 8302 Kloten', 'Dietlikerstrasse 57 8302 Kloten']);
  });
  it('schweigt, wenn es die Nummer gibt oder die Strasse gar nicht vorkommt', () => {
    expect(nummerFehlt('Dietlikerstrasse 56 Kloten', strasse)).toBeNull();
    expect(nummerFehlt('Dietlikerstr. 56 Kloten', strasse)).toBeNull();
    expect(nummerFehlt('Lindenstrasse 55 Kloten', strasse)).toBeNull();
    expect(nummerFehlt('Kloten 2061', strasse)).toBeNull();
  });
  it('«50» ist da, auch wenn daneben «50.1» steht', () => {
    expect(nummerFehlt('Dietlikerstrasse 50 Kloten', strasse)).toBeNull();
  });
});

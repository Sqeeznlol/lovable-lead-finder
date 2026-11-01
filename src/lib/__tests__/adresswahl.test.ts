import { describe, expect, it } from 'vitest';
import { adresseWaehlen } from '../adresswahl';

describe('Adresse aus den Vorschlägen des Bundes wählen', () => {
  it('nimmt den einzigen Vorschlag, der alle Wörter enthält', () => {
    expect(adresseWaehlen('Gerlisberg 7, Kloten',
      ['Gerlisberg 7 <b>8302 Kloten</b>', 'Gerlisberg 7a 8302 Kloten', 'Gerlisbergstrasse 7 8302 Kloten']))
      .toEqual({ index: 0 });
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

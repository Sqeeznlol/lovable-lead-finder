import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { berichtDateiname, berichtPdf, type BerichtDaten } from '../check-bericht';

const DATEN: BerichtDaten = {
  marke: 'HausChecker', farbe: '#1F4E8C', domain: 'hauschecker.ch', datum: new Date(2026, 10, 19),
  adresse: 'Seestrasse 12, 8810 Horgen', ort: 'Horgen · Parzelle 1234 · Kanton ZH', egrid: 'CH123456789012',
  bild: null,
  kennzahlen: [
    { titel: 'Grundstücksfläche', wert: '1’240 m²', zusatz: 'laut amtlicher Vermessung' },
    { titel: 'Bauzone', wert: 'W2', zusatz: 'Wohnzone 2 Geschosse' },
    { titel: 'Überbaut', wert: '16 %' },
    { titel: 'Ältestes Gebäude', wert: '1968' },
  ],
  rechnung: { titel: 'Ausnützung durchrechnen', satz: 'Ausnützungsziffer 0.60 laut Zonenplan.', zeilen: [{ titel: 'Möglich', wert: '744 m²' }, { titel: 'Baureserve', wert: '+ 410 m²' }] },
  abschnitte: [{ titel: 'Was für Ihre Parzelle gilt', zeilen: [{ titel: 'Denkmalschutz', wert: 'nicht inventarisiert', zusatz: 'Kanton Zürich' }] }],
  tipps: [{ titel: 'Ölheizung früh ersetzen', text: 'Planen Sie den Ersatz, bevor die alte Heizung ausfällt.' }],
  fuer: 'Anna Muster', betreiber: 'Bauraum', betreiberAdresse: ['Sihleggstrasse 23', '8832 Wollerau'],
};

describe('Bericht als PDF', () => {
  it('enthält Adresse, Kennzahlen, Rechnung, Tipps und Umlaute lesbar', async () => {
    const doc = await berichtPdf(DATEN);
    const ordner = mkdtempSync(join(tmpdir(), 'bericht-'));
    const datei = join(ordner, 'b.pdf');
    writeFileSync(datei, Buffer.from(doc.output('arraybuffer')));
    const text = execFileSync('pdftotext', ['-layout', datei, '-'], { encoding: 'utf8' });
    for (const s of ['Seestrasse 12, 8810 Horgen', 'Grundstücksfläche', '1’240 m²', 'Ausnützung durchrechnen', '+ 410 m²',
      'Ölheizung früh ersetzen', 'Erstellt für Anna Muster', 'keine Bewilligungszusage', 'Seite 1 von']) {
      expect(text).toContain(s);
    }
    // Julian, 19. November: «Quelle rausnehmen im Bericht».
    expect(text).not.toMatch(/Quelle/);
  });

  it('Dateiname ohne Umlaute und Sonderzeichen', () => {
    expect(berichtDateiname('Zürichstrasse 5, 8600 Dübendorf', new Date(2026, 10, 19))).toBe('Bericht-Zurichstrasse-5-8600-Dubendorf-2026-11-19.pdf');
  });
});

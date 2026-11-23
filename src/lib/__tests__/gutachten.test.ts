import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { betrag, datumIso, gutachtenBrauchbar, gutachtenHand, gutachtenLesen } from '@/lib/gutachten';
import { zeilenAusStuecken } from '@/lib/gutachten-pdf';

/**
 * Julian, 23. November: «Bitte in CALC einpflegen. Wenn wir Daten haben wie
 * hier anbei ... bitte hochladen bzw. extrahieren.» Der Text ist erfunden,
 * aufgebaut wie ein echtes Markt- und Mietwertgutachten: das echte nennt
 * Eigentümer und Auftraggeber und gehört nicht ins Repository.
 */
const TEXT = `Markt- und Mietwertgutachten
TEST Musterhaus
Musterweg 12
8400 Winterthur
1. Allgemeines
Objekt TEST Musterhaus
Eigentümer TEST Erbengemeinschaft Muster
Experte TEST Expertin
Stichtag 3. März 2025
Marktwert Fr. 2'150'000
4.1. Grundbuch
Gemeinde Winterthur
Kataster-Nr. SE9999
Fläche m² 512
Zonen- und Bauvorschriften W3, AZ 90%, ES II
Baujahr 1931
Umbauter Raum GVA 1'840 m³
Assek.-Neuwert Fr. 2'204'000
Heizung Zentralheizung (Baujahr 2019) mit Wärmepumpe
Nutzfläche NF = ca. 410.5 m²
Mietzins p.a., Mietwert p.a. 410 m² Fr. 88'800 Fr. 96'000
Kapitalisierungssatz Ertragsteil 3.10 % 96'000 100.00 %
Mietwert p.a. 96'000
Kapitalisierungssatz 3.10 %
Ertragswert - Neuwert Fr. 2'480'000
Ertragswert 2'480'000
Marktwert Fr. 2'147'310
Rundung 2'690
Marktwert Fr. 2'150'000
Mietwert bei Fremdvermietung Fr. 7'400`;

describe('Gutachten lesen', () => {
  it('liest jede Zahl mit ihrer Bezeichnung', () => {
    const g = gutachtenLesen(TEXT, 'TEST.pdf');
    expect(g).toMatchObject({
      datei: 'TEST.pdf', stichtag: '2025-03-03', marktwert: 2_150_000, ertragswert: 2_480_000, katNr: 'SE9999', grundstueck: 512,
      zone: 'W3, AZ 90%, ES II', baujahr: 1931, volumen: 1840, assekNeuwert: 2_204_000, nutzflaeche: 410.5,
      mietzinsJahr: 88_800, mietwertJahr: 96_000, mietwertMonat: 7400, kapSatz: 3.1, experte: 'TEST Expertin',
    });
  });

  it('nimmt den gerundeten Marktwert, nicht die Zwischensumme, und nie das Baujahr der Heizung', () => {
    const g = gutachtenLesen(TEXT);
    expect(g.marktwert).toBe(2_150_000);
    expect(g.baujahr).toBe(1931);
  });

  it('liest keine Namen von Eigentümern', () => {
    expect(JSON.stringify(gutachtenLesen(TEXT))).not.toMatch(/Erbengemeinschaft/);
  });

  it('was nicht dasteht, bleibt leer; ohne Zahl ist es kein Gutachten', () => {
    const g = gutachtenLesen('Ein Brief ohne Zahlen.');
    expect(g.marktwert).toBeNull();
    expect(gutachtenBrauchbar(g)).toBe(false);
    expect(gutachtenBrauchbar(gutachtenLesen(TEXT))).toBe(true);
  });

  it('Beträge und Daten in den üblichen Schreibweisen', () => {
    expect(betrag("2'150'000")).toBe(2_150_000);
    expect(betrag('2’150’000.–')).toBe(2_150_000);
    expect(betrag('1 260')).toBe(1260);
    expect(betrag('ca.')).toBeNull();
    expect(datumIso('3. März 2025')).toBe('2025-03-03');
    expect(datumIso('09.10.2024')).toBe('2024-10-09');
  });
});

describe('Gutachten in der Rechnung', () => {
  it('Fläche und Mietzins gehen dorthin, wo nichts von Hand steht', () => {
    const g = gutachtenLesen(TEXT);
    expect(gutachtenHand(g, {})).toEqual({ wohnflaeche: 410.5, mietertragJahr: 88_800 });
    expect(gutachtenHand(g, { wohnflaeche: 300, mietertragJahr: 50_000 })).toEqual({});
    // Ohne gezahlten Mietzins der Mietwert im heutigen Zustand, auf das Jahr gerechnet.
    expect(gutachtenHand({ ...g, mietzinsJahr: null }, {}).mietertragJahr).toBe(88_800);
  });

  it('die Datei bleibt auf dem Gerät: CALC speichert nur die Zahlen', () => {
    const r = readFileSync('src/components/calc/Rechnung.tsx', 'utf8');
    expect(r).toContain('gutachten, oereb },');
    expect(r).not.toMatch(/storage\.from|\.upload\(/);
  });
});

describe('Zeilen aus dem PDF', () => {
  it('Stücke derselben Grundlinie werden eine Zeile, von oben nach unten', () => {
    const s = (str: string, x: number, y: number, width: number) => ({ str, transform: [1, 0, 0, 1, x, y], width });
    expect(zeilenAusStuecken([s('Fr. 2\'150\'000', 400, 700, 60), s('Marktwert', 72, 700, 50), s('Stichtag', 72, 720, 40), s('3. März 2025', 300, 720, 80)]))
      .toEqual(['Stichtag  3. März 2025', "Marktwert  Fr. 2'150'000"]);
  });
});

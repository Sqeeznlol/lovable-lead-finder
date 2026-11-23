import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Julian, 23. November: «die Studer Immobilien Vorlage muss genau so sein wie
 * ich geschickt habe mit dem Layout, da ändert sich Besitzer, Preis und die
 * Parzellen-Infos». Die Vorlage ist ein Word-Dokument; ihre Masse stehen
 * hier als Zahlen (Logo in EMU, Einzug in Twips, Grundlinien in mm, aus dem
 * Dokument gelesen und mit Words Zeilenhöhen nachgerechnet). Die Daten sind
 * erfunden: die Vorlage nennt echte Eigentümer, die gehören nicht hierher.
 */

// Jeder Text, jedes Bild und jede Linie, die das PDF zeichnet, mit Schrift und Lage.
type Eintrag = { art: 'text' | 'bild' | 'linie'; text?: string; x: number; y: number; b?: number; h?: number; groesse?: number; schnitt?: string; seite: number };
const protokoll: Eintrag[] = [];
vi.mock('jspdf', async echt => {
  const m = await echt<typeof import('jspdf')>();
  function Mitschreiben(...a: unknown[]) {
    const doc = new (m.jsPDF as unknown as new (...x: unknown[]) => import('jspdf').jsPDF)(...a);
    const seite = () => doc.getCurrentPageInfo().pageNumber;
    const text = doc.text.bind(doc), bild = doc.addImage.bind(doc), linie = doc.line.bind(doc);
    doc.text = ((t: string, x: number, y: number, ...rest: unknown[]) => {
      protokoll.push({ art: 'text', text: t, x, y, groesse: doc.getFontSize(), schnitt: `${doc.getFont().fontName} ${doc.getFont().fontStyle}`, seite: seite() });
      return (text as (...x: unknown[]) => unknown)(t, x, y, ...rest);
    }) as typeof doc.text;
    doc.addImage = ((d: unknown, f: unknown, x: number, y: number, b: number, h: number, ...rest: unknown[]) => {
      protokoll.push({ art: 'bild', x, y, b, h, seite: seite() });
      return (bild as (...x: unknown[]) => unknown)(d, f, x, y, b, h, ...rest);
    }) as typeof doc.addImage;
    doc.line = ((x1: number, y1: number, x2: number, y2: number, ...rest: unknown[]) => {
      protokoll.push({ art: 'linie', x: x1, y: y1, b: x2 - x1, seite: seite() });
      return (linie as (...x: unknown[]) => unknown)(x1, y1, x2, y2, ...rest);
    }) as typeof doc.line;
    return doc;
  }
  Mitschreiben.API = m.jsPDF.API;
  return { ...m, jsPDF: Mitschreiben };
});

const { adressbloecke, anrede, brief, felderVorgabe, FIRMEN, leerePerson, studerBrief } = await import('@/lib/angebot');
const { angebotPdf } = await import('@/lib/angebot-pdf');
type Kontext = import('@/lib/angebot').Kontext;

const ehepaar = [
  leerePerson({ art: 'frau', vorname: 'Anna', name: 'Muster', strasse: 'Musterweg 12', plzOrt: '8400 Winterthur', empfaenger: true }),
  leerePerson({ art: 'herr', vorname: 'Peter', name: 'Muster', strasse: 'Musterweg 12', plzOrt: '8400 Winterthur', empfaenger: true }),
];
const kontext = (o: Partial<Kontext> = {}): Kontext => ({
  firma: FIRMEN.studer,
  felder: { ...felderVorgabe('unverbindlich', new Date('2026-07-06T10:00:00'), 'studer'), unterschriften: [{ name: 'TEST Inhaber', titel: 'Inhaber' }] },
  preis: 2_750_000, adresse: 'Musterweg 12', plzOrt: '8400 Winterthur', gemeinde: 'Winterthur', kanton: 'ZH', zone: null,
  parzellen: [{ nummer: 'SE9999', flaeche: null }], personen: ehepaar, ...o,
});

describe('Studer: der Wortlaut der Vorlage', () => {
  it('Empfänger und Anrede wie dort: «Familie», darunter beide Namen', () => {
    expect(adressbloecke(ehepaar, true)).toEqual([['Familie Muster', 'Anna Muster und Peter Muster', 'Musterweg 12', '8400 Winterthur']]);
    expect(anrede(ehepaar, true)).toBe('Sehr geehrte Familie Muster');
    // Verschiedene Namen bleiben, wie sie sind; andere Firmen schreiben wie bisher.
    const zwei = [ehepaar[0], { ...ehepaar[1], name: 'Beispiel' }];
    expect(anrede(zwei, true)).toBe('Sehr geehrte Frau Muster, sehr geehrter Herr Beispiel');
    expect(anrede(ehepaar)).toBe('Sehr geehrte Frau Muster, sehr geehrter Herr Muster');
  });

  it('es ändern Eigentümer, Preis und Parzellen; der Rest steht Wort für Wort', () => {
    const b = studerBrief(kontext());
    expect(b.art).toBe('Unverbindliches Kaufangebot');
    expect(b.einleitung).toEqual(['Für das Grundstück Kat. **SE9999** Musterweg 12 in 8400 Winterthur unterbreiten wir folgendes Angebot:']);
    expect(b.betragZeile).toBe("**CHF 2'750'000.- (zwei Millionen siebenhundertfünfzigtausend)**");
    expect(b.punkte.map(p => `${p.titel}: ${p.text}`)).toEqual([
      "Kaufpreis: CHF 2'750'000.-, umfassend das Grundstück mit der Parzellennummer SE9999.",
      'Beurkundung: Nach Vereinbarung, so rasch als möglich.',
      'Eigentumsübertragung: Juli 2027, gemäss Wunsch der Verkäuferschaft.',
      'Besichtigung: Dieses Angebot steht unter dem Vorbehalt einer noch durchzuführenden\nBesichtigung der Liegenschaft durch den Käufer.',
      'Gültigkeit: Dieses Angebot ist gültig bis zum **17. August 2026.**',
    ]);
    expect(b.schluss).toEqual([
      'Die mit dem Eigentumsübergang verbundenen Kosten, insbesondere Notariats- und\nGrundbuchgebühren, werden von Käufer und Verkäufer zu gleichen Teilen getragen. Eine\nallfällige Grundstückgewinnsteuer geht zulasten des Verkäufers.',
      'Vor Abschluss des Kaufvertrags wird eine umfassende Prüfung sämtlicher im Grundbuch\neingetragener Dienstbarkeiten vorgenommen. Der Zeitpunkt des Übergangs von Nutzen und\nGefahr wird einvernehmlich zwischen den Parteien festgelegt.',
      'Ich bin überzeugt, dass mein Angebot für Sie von Interesse sein könnte, und würde mich\nsehr freuen, wenn wir einen Termin für ein persönliches Gespräch vereinbaren könnten.',
    ]);
  });

  it('mehrere Parzellen in der Mehrzahl; eingetragene Übertragung und Gültigkeit gelten', () => {
    const k = kontext({ parzellen: [{ nummer: '101', flaeche: null }, { nummer: '102', flaeche: null }] });
    const b = studerBrief({ ...k, felder: { ...k.felder, besitzantritt: '2028-03-31', bindungTage: 0 } });
    expect(b.einleitung[0]).toBe('Für die Grundstücke Kat. **101 und 102** Musterweg 12 in 8400 Winterthur unterbreiten wir folgendes Angebot:');
    expect(b.punkte[0].text).toBe("CHF 2'750'000.-, umfassend die Grundstücke mit den Parzellennummern 101 und 102.");
    expect(b.punkte[2].text).toBe('März 2028, gemäss Wunsch der Verkäuferschaft.');
    expect(b.punkte.map(p => p.titel)).not.toContain('Gültigkeit');
  });

  it('Studer schreibt immer seinen Brief, welche Vorlage auch gewählt ist', () => {
    expect(brief('bauland', kontext())).toEqual(studerBrief(kontext()));
  });
});

const laden = async (pfad: string) => { const b = readFileSync(join('public', pfad)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe('Studer: das PDF liegt wie die Vorlage', () => {
  beforeEach(() => { protokoll.length = 0; });

  it('Logo, Empfänger, Datum, Titel, Eckpunkte, Schluss und Fuss an ihrem Platz', async () => {
    const k = kontext();
    const doc = await angebotPdf({
      firma: FIRMEN.studer, schrift: FIRMEN.studer.schrift, brief: brief('unverbindlich', k), preis: k.preis, felder: k.felder,
      adressbloecke: adressbloecke(ehepaar, true), anrede: anrede(ehepaar, true), titel: k.adresse, untertitel: k.plzOrt, kat: '',
    }, laden);
    expect(doc.getNumberOfPages()).toBe(1);
    const texte = protokoll.filter(e => e.art === 'text');
    const zeile = (anfang: string) => {
      const t = texte.find(e => e.text!.startsWith(anfang));
      expect(t, anfang).toBeDefined();
      return t!;
    };

    // Logo frei verankert: 3'535'680 EMU vom linken Rand des Satzspiegels, 178'323 darüber, 2'228'850 × 685'800.
    const [logo] = protokoll.filter(e => e.art === 'bild');
    expect(logo.x).toBeCloseTo(123.613, 2);
    expect(logo.y).toBeCloseTo(20.447, 2);
    expect(logo.b).toBeCloseTo(61.913, 2);
    expect(logo.h).toBeCloseTo(19.05, 2);

    // Grundlinien in mm, wie Word die Vorlage setzt (Arial 11, Leerzeilen in Times 10).
    const soll: [string, number][] = [
      ['Familie Muster', 45.26], ['Anna Muster und Peter Muster', 49.72], ['Musterweg 12', 54.19], ['8400 Winterthur', 58.65],
      ['Wollerau, 6. Juli 2026', 75.28], ['Unverbindliches Kaufangebot', 88.19], ['Sehr geehrte Familie Muster', 96.78],
      ['Für das Grundstück Kat.', 105.30], ["CHF 2'750'000.- (zwei Millionen", 118.28],
      ['Kaufpreis', 129.43], ['Beurkundung', 136.12], ['Eigentumsübertragung', 142.80], ['Besichtigung', 149.49], ['Gültigkeit', 162.86],
      ['Die mit dem Eigentumsübergang', 169.54], ['Vor Abschluss', 187.39], ['Ich bin überzeugt', 205.24],
      ['Freundliche Grüsse', 222.26], ['Inhaber', 230.80], ['TEST Inhaber', 235.26],
    ];
    for (const [anfang, y] of soll) expect(Math.abs(zeile(anfang).y - y), anfang).toBeLessThan(0.15);

    // Das Datum steht 6372 Twips eingerückt, alles andere am Rand von 1440 Twips.
    expect(zeile('Wollerau,').x).toBeCloseTo(25.4 + (6372 / 1440) * 25.4, 2);
    expect(zeile('Familie Muster').x).toBeCloseTo(25.4, 2);

    // Schrift und Schnitt wie dort: Arial 11, der Titel 12 fett und unterstrichen, Preis und Stichworte fett.
    expect(zeile('Unverbindliches Kaufangebot')).toMatchObject({ groesse: 12, schnitt: 'helvetica bold' });
    expect(zeile('Sehr geehrte Familie Muster')).toMatchObject({ groesse: 11, schnitt: 'helvetica normal' });
    expect(zeile("CHF 2'750'000.- (zwei Millionen").schnitt).toBe('helvetica bold');
    expect(zeile('Kaufpreis').schnitt).toBe('helvetica bold');
    expect(zeile('SE9999').schnitt).toBe('helvetica bold');
    const unterstrich = protokoll.filter(e => e.art === 'linie');
    expect(unterstrich).toHaveLength(1);
    expect(unterstrich[0].y - zeile('Unverbindliches Kaufangebot').y).toBeCloseTo(0.457, 2);

    // Der Fuss: Arial 8, mittig zwischen den Rändern, 708 Twips über dem Blattrand, ohne Linie und Seitenzahl.
    const fuss = zeile('Studer Immobilien Schweiz AG |');
    expect(fuss.text).toBe('Studer Immobilien Schweiz AG | Sihleggstrasse 23    | 8832 Wollerau  | 044 240 16 62  | www.studer-immobilien.ch');
    expect(fuss.groesse).toBe(8);
    expect(fuss.y).toBeCloseTo(283.91, 1);
    // 143.63 mm breit nach den Massen von Arial: Anfang bei 105 − 71.82.
    expect(fuss.x).toBeCloseTo(33.18, 1);
    expect(texte.some(e => /^Seite /.test(e.text!))).toBe(false);
  }, 30_000);

  it('ein langes Datum bricht nicht um, es endet am rechten Rand', async () => {
    const k = kontext();
    const felder = { ...k.felder, datum: '2026-11-23' };
    await angebotPdf({
      firma: FIRMEN.studer, schrift: FIRMEN.studer.schrift, brief: brief('unverbindlich', { ...k, felder }), preis: k.preis, felder,
      adressbloecke: adressbloecke(ehepaar, true), anrede: anrede(ehepaar, true), titel: k.adresse, untertitel: k.plzOrt, kat: '',
    }, laden);
    const datum = protokoll.filter(e => e.art === 'text' && /^Wollerau,|^2026$/.test(e.text!));
    expect(datum.map(e => e.text)).toEqual(['Wollerau, 23. November 2026']);
    // 51.6 mm breit nach den Massen von Arial, rechter Rand bei 210 − 25.4.
    expect(datum[0].x).toBeGreaterThan(25.4 + 100);
    expect(datum[0].x).toBeLessThan(25.4 + (6372 / 1440) * 25.4);
  }, 30_000);

  it('das Logo liegt bei, ohne versteckte Angaben aus Kamera oder Photoshop', () => {
    const b = readFileSync('public/marken/studer-immobilien.jpg');
    expect(b.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(b.includes(Buffer.from('Exif'))).toBe(false);
    expect(b.includes(Buffer.from('Photoshop'))).toBe(false);
  });
});

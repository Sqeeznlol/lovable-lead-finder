import { describe, expect, it } from 'vitest';
import { guete, LETZTE_STUFE, PIXEL_HOECHSTENS, sparsamer, stufeLesen, stufeMerken, Taktmesser } from '@/lib/karte3d-guete';

const laptop = { dpr: 2, breite: 1440, hoehe: 843, gross: true };
const normal = { dpr: 1, breite: 1440, hoehe: 843, gross: true };
const iphone = { dpr: 3, breite: 390, hoehe: 700, gross: false };

describe('Güte der 3D-Karte', () => {
  it('Laptop mit doppelter Dichte: scharf, ohne Kantenglättung, mit Schatten', () => {
    // 1440 × 843 × 4 = 4.86 Mio. Bildpunkte, unter der Obergrenze.
    expect(guete(0, laptop)).toEqual({ pixel: 2, glaettung: 1, schatten: true });
  });
  it('normaler Bildschirm: Glättung 4 wie bisher', () => {
    expect(guete(0, normal)).toEqual({ pixel: 1, glaettung: 4, schatten: true });
  });
  it('Windows-Laptop mit 150 %: Glättung 2', () => {
    expect(guete(0, { ...normal, dpr: 1.5 })).toEqual({ pixel: 1.5, glaettung: 2, schatten: true });
  });
  it('iPhone: höchstens doppelt, nie Schatten', () => {
    expect(guete(0, iphone)).toEqual({ pixel: 2, glaettung: 1, schatten: false });
  });
  it('grosser Bildschirm mit doppelter Dichte bleibt unter der Obergrenze', () => {
    // 1920 × 1080 × 4 = 8.3 Mio.; erlaubt sind 5 Mio.: Wurzel aus 5 Mio. / 2'073'600 = 1.5528.
    const g = guete(0, { dpr: 2, breite: 1920, hoehe: 1080, gross: true });
    expect(g.pixel).toBeCloseTo(1.5528, 3);
    expect(g.pixel * g.pixel * 1920 * 1080).toBeLessThanOrEqual(PIXEL_HOECHSTENS + 1);
    expect(g.glaettung).toBe(2);
  });
  it('wird Stufe um Stufe sparsamer und nie unscharfer als die einfache Dichte', () => {
    expect(guete(1, laptop)).toEqual({ pixel: 2, glaettung: 1, schatten: false });
    expect(guete(2, laptop)).toEqual({ pixel: 1.5, glaettung: 1, schatten: false });
    // Einfache Dichte zuerst mit Glättung 2: 1 × 1 × 2 Punkte je Pixel statt 1.5 × 1.5.
    expect(guete(3, laptop)).toEqual({ pixel: 1, glaettung: 2, schatten: false });
    expect(guete(4, laptop)).toEqual({ pixel: 1, glaettung: 1, schatten: false });
    expect(guete(1, normal)).toEqual({ pixel: 1, glaettung: 2, schatten: false });
    expect(guete(3, normal)).toEqual({ pixel: 1, glaettung: 2, schatten: false });
    expect(guete(4, normal)).toEqual({ pixel: 1, glaettung: 1, schatten: false });
    // Verkleinerte Ansicht des Browsers (80 %): nicht über die Dichte des Bildschirms hinaus.
    expect(guete(4, { ...normal, dpr: 0.8 }).pixel).toBe(0.8);
    // Mehr als die letzte Stufe gibt es nicht.
    expect(guete(9, laptop)).toEqual(guete(LETZTE_STUFE, laptop));
  });
  it('zeichnet auf keiner Stufe mehr Bildpunkte als auf der davor', () => {
    const geraete = [laptop, normal, iphone, { dpr: 2, breite: 2560, hoehe: 1300, gross: true }, { dpr: 2, breite: 1920, hoehe: 1080, gross: true },
      { dpr: 1.5, breite: 1280, hoehe: 700, gross: true }, { dpr: 1.25, breite: 1536, hoehe: 800, gross: true }];
    for (const g of geraete) {
      for (let s = 1; s <= LETZTE_STUFE; s++) {
        const vor = guete(s - 1, g), nach = guete(s, g);
        expect(nach.pixel * nach.pixel * nach.glaettung).toBeLessThanOrEqual(vor.pixel * vor.pixel * vor.glaettung);
        expect(nach.pixel).toBeLessThanOrEqual(vor.pixel);
      }
      expect(guete(LETZTE_STUFE, g)).toEqual({ pixel: Math.min(g.dpr, 1), glaettung: 1, schatten: false });
    }
  });
  it('überspringt Stufen, die an diesem Gerät nichts sparen', () => {
    // Laptop: jede Stufe ändert etwas.
    expect([0, 1, 2, 3, 4].map(s => sparsamer(s, laptop))).toEqual([1, 2, 3, 4, 4]);
    // Normaler Bildschirm: weniger Dichte gibt es nicht, also von Glättung 2 gleich zu keiner.
    expect([0, 1, 4].map(s => sparsamer(s, normal))).toEqual([1, 4, 4]);
    // iPhone: Schatten gab es nie, die erste Stufe spart nichts.
    expect(sparsamer(0, iphone)).toBe(2);
  });
});

describe('Taktmesser', () => {
  // Die Uhr läuft mit den Bildern mit: jedes Bild endet, wenn das nächste beginnt.
  const lauf = (dauern: number[], m = new Taktmesser()) => { let jetzt = 0; return dauern.map(d => { jetzt += d; return m.bild(d, jetzt); }); };
  const meldungen = (antwort: boolean[]) => antwort.map((a, i) => (a ? i : -1)).filter(i => i >= 0);

  it('flüssige Karte bleibt, wie sie ist', () => {
    expect(meldungen(lauf(Array(600).fill(17)))).toEqual([]);
  });
  it('der Anlauf zählt nicht: da übersetzt der Browser Zeichenprogramme', () => {
    // Zweieinhalb Sekunden lang Bilder von einer halben Sekunde, danach flüssig.
    expect(meldungen(lauf([...Array(6).fill(500), ...Array(200).fill(17)]))).toEqual([]);
  });
  it('einzelne Hänger zwischen flüssigen Bildern ändern nichts', () => {
    expect(meldungen(lauf(Array.from({ length: 400 }, (_, i) => (i % 4 === 0 ? 400 : 17))))).toEqual([]);
  });
  it('dauerhaft zehn Bilder je Sekunde: nach dem Anlauf und sechs gemessenen Bildern sparsamer', () => {
    // Das erste Bild endet bei 100 ms. Anlauf bis 2600 ms: die Bilder 0 bis 24. Gemessen 25 bis 30.
    expect(meldungen(lauf(Array(31).fill(100)))).toEqual([30]);
  });
  it('sehr langsam: sechs Bilder Anlauf, dann genügen drei', () => {
    expect(meldungen(lauf(Array(9).fill(2000)))).toEqual([8]);
  });
  it('nach der Meldung ist der Anlauf kurz', () => {
    // Nach Bild 30: Anlauf eine halbe Sekunde (Bilder 31 bis 35), gemessen 36 bis 41. Dann wieder so.
    expect(meldungen(lauf(Array(60).fill(100)))).toEqual([30, 41, 52]);
    // Sehr langsam: je drei Bilder Anlauf, drei gemessen.
    expect(meldungen(lauf(Array(21).fill(2000)))).toEqual([8, 14, 20]);
  });
  it('nach einer Pause zählen die ersten Bilder nicht', () => {
    const m = new Taktmesser();
    lauf(Array(200).fill(17), m);
    m.neu();
    expect(meldungen(lauf([2000, 2000, 2000, ...Array(50).fill(17)], m))).toEqual([]);
  });
  it('unbrauchbare Werte zählen nicht', () => {
    expect(meldungen(lauf([NaN, -5, NaN]))).toEqual([]);
  });
});

describe('Gedächtnis der Stufe', () => {
  const speicher = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  const TAG = 24 * 3600 * 1000;

  it('ohne Eintrag die schönste Stufe', () => {
    expect(stufeLesen(1000, speicher())).toBe(0);
    expect(stufeLesen(1000, null)).toBe(0);
  });
  it('merkt die Stufe einen Tag lang', () => {
    const s = speicher();
    stufeMerken(2, 10 * TAG, s);
    expect(stufeLesen(10 * TAG + 0.9 * TAG, s)).toBe(2);
    expect(stufeLesen(10 * TAG + 1.1 * TAG, s)).toBe(0);
  });
  it('glaubt keinem kaputten Eintrag', () => {
    for (const roh of ['kaputt', '{"stufe":9,"am":5}', '{"stufe":1.5,"am":5}', '{"stufe":2}', '{"stufe":2,"am":99999999999999}']) {
      const s = speicher(); s.setItem('karte3d-stufe', roh);
      expect(stufeLesen(10 * TAG, s)).toBe(0);
    }
  });
  it('gesperrter Speicher stört nicht', () => {
    const gesperrt = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); } };
    expect(stufeLesen(1000, gesperrt)).toBe(0);
    expect(() => stufeMerken(1, 1000, gesperrt)).not.toThrow();
  });
});

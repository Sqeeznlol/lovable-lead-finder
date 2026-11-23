/**
 * Das Kaufangebot als PDF, im Kleid der Firma, die es macht (Julian,
 * 19. November: «das Kaufangebot_Arbergstrasse28 ist das Hauptlayout»).
 *
 *   stimo        wie die Arbergstrasse: Deckblatt im Verlauf von Marineblau
 *                zu Türkis, Brief, Über uns mit Referenzen, Unterschrift mit
 *                «Wir suchen Bauland»
 *   Lebensraum   wie Meilen und Niederglatt: dunkles Deckblatt mit Mint,
 *                Brief mit nummerierten Bedingungen, Preis im dunklen Feld
 *   Studer       genau wie die Word-Vorlage vom 23. November: Logo oben
 *                rechts, Arial, Abstände, Fuss, alles aus dem Dokument gemessen
 *
 * Die Farben sind an den Vorlagen gemessen (#292f78 zu #18ad90; #222a2b
 * mit #9fd6b4). Die Schriften sind freie Schriften (SIL Open Font
 * License, public/schriften): Avenir, Arial und Calibri dürfen nicht
 * mitgeliefert werden; Nunito Sans, Helvetica und Carlito stehen ihnen am
 * nächsten. Fotos und Unterschriften als Bild fehlen mit Absicht: sie
 * gehören nicht in ein öffentliches Repository. Das Logo von Studer steht
 * darin (public/marken), weil die Vorlage es verlangt und es ohnehin
 * öffentlich ist; bei stimo und Lebensraum steht der Name als Schrift.
 *
 * Gesetzt wird mit jsPDF, damit jede Zeile echter Text bleibt: der Test
 * liest das PDF mit pdftotext wie ein Mensch.
 */
import { jsPDF } from 'jspdf';
import { chfText, datumKurz, datumLang, SCHRIFTEN, type AngebotFelder, type Brief, type Firma, type SchriftId } from '@/lib/angebot';

export interface AngebotPdfDaten {
  firma: Firma;
  schrift: SchriftId;
  brief: Brief;
  preis: number;
  felder: AngebotFelder;
  adressbloecke: string[][];
  anrede: string;
  /** Deckblatt: Strasse gross, darunter «8405 Winterthur-Seen». */
  titel: string;
  untertitel: string;
  /** Kataster-Nummern für die Zeile unter dem Titel (Lebensraum). */
  kat: string;
  /** Luftbild als data:-Adresse (JPEG), sonst ohne Bild. */
  luftbild?: string | null;
  test?: boolean;
}

/** Lädt eine Datei aus public/, z. B. «schriften/Carlito-Regular.ttf» oder «marken/studer-immobilien.jpg». */
export type DateiLaden = (pfad: string) => Promise<ArrayBuffer>;
const ausDemNetz: DateiLaden = async pfad => {
  const r = await fetch(`/${pfad}`);
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.arrayBuffer();
};

function base64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

type Rgb = [number, number, number];
const WEISS: Rgb = [255, 255, 255];
const TEXT: Rgb = [33, 37, 41];
const GRAU: Rgb = [110, 116, 122];
const LINIE: Rgb = [200, 204, 208];
const A4 = { b: 210, h: 297 };
const RAND = 25;
const BREITE = A4.b - 2 * RAND;
const pt = (n: number) => n * 0.3528;
// Weiche Trennzeichen und Zeichen, die keine Schrift hier kennt, kommen nie ins PDF.
const sauber = (t: string) => t.replace(/\u00ad/g, '').replace(/[\u2009\u202f]/g, ' ').replace(/\u2212/g, '-');
const mischen = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;

class Setzer {
  doc: jsPDF;
  y = 0;
  familie = 'helvetica';
  /** Das Logo der Firma als JPEG, falls sie eines hat und es sich laden liess. */
  logo: Uint8Array | null = null;
  /** Bis hierhin darf Text stehen; darunter liegt der Fuss der Firma. */
  unten = A4.h - 30;
  constructor(readonly d: AngebotPdfDaten, readonly fuss: (s: Setzer) => void, readonly kopf: (s: Setzer) => number) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  }
  schrift(stil: 'normal' | 'bold', groesse: number, farbe: Rgb = TEXT) {
    this.doc.setFont(this.familie, stil);
    this.doc.setFontSize(groesse);
    this.doc.setTextColor(...farbe);
  }
  zeilen(text: string, breite: number): string[] {
    return this.doc.splitTextToSize(sauber(text), breite) as string[];
  }
  hoehe(groesse: number, faktor = 1.45) { return pt(groesse) * faktor; }
  /** Platz für so viele mm, sonst neue Seite mit Kopf. */
  platz(mm: number) {
    if (this.y + mm <= this.unten) return;
    // Der Kopf der neuen Seite setzt eigene Schrift und Farbe: danach geht es weiter wie vorher.
    const f = this.doc.getFont(), g = this.doc.getFontSize(), c = this.doc.getTextColor();
    this.doc.addPage();
    this.y = this.kopf(this);
    this.doc.setFont(f.fontName, f.fontStyle);
    this.doc.setFontSize(g);
    this.doc.setTextColor(c);
  }
  absatz(text: string, o: { x?: number; breite?: number; groesse?: number; stil?: 'normal' | 'bold'; farbe?: Rgb; nach?: number } = {}) {
    const x = o.x ?? RAND, breite = o.breite ?? BREITE, g = o.groesse ?? 10;
    this.schrift(o.stil ?? 'normal', g, o.farbe ?? TEXT);
    for (const z of this.zeilen(text, breite)) {
      this.platz(this.hoehe(g));
      this.doc.text(z, x, this.y);
      this.y += this.hoehe(g);
    }
    this.y += o.nach ?? 2.5;
  }
  gesperrt(text: string, x: number, y: number, groesse: number, farbe: Rgb, abstand = 1.2, stil: 'normal' | 'bold' = 'normal', rechts = false) {
    this.schrift(stil, groesse, farbe);
    const t = sauber(text).toUpperCase();
    // jsPDF rechnet den Sperrabstand beim Ausrichten nicht mit: darum selbst.
    const b = rechts ? this.doc.getTextWidth(t) + abstand * (t.length - 1) : 0;
    this.doc.text(t, x - b, y, { charSpace: abstand });
  }
  verlauf(x: number, y: number, b: number, h: number, von: Rgb, bis: Rgb) {
    const n = Math.max(2, Math.ceil(b / 1.5));
    for (let i = 0; i < n; i++) {
      this.doc.setFillColor(...mischen(von, bis, i / (n - 1)));
      // Ein Hauch Überlappung, sonst zeigen manche Betrachter feine Streifen.
      this.doc.rect(x + (b * i) / n, y, b / n + 0.2, h, 'F');
    }
  }
  fertig(): jsPDF {
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      this.fuss(this);
      if (this.d.test) {
        this.schrift('bold', 9, [200, 40, 40]);
        this.doc.text('TEST', A4.b - 8, 8, { align: 'right' });
      }
    }
    return this.doc;
  }
}

async function schriftenLaden(s: Setzer, id: SchriftId, laden: DateiLaden) {
  const datei = SCHRIFTEN[id].datei;
  if (!datei) return;
  try {
    for (const stil of ['Regular', 'Bold'] as const) {
      const name = `${datei}-${stil}.ttf`;
      s.doc.addFileToVFS(name, base64(await laden(`schriften/${name}`)));
      s.doc.addFont(name, datei, stil === 'Bold' ? 'bold' : 'normal');
    }
    s.familie = datei;
  } catch {
    // Ohne Netz bleibt Helvetica: ein Angebot ohne Hausschrift ist besser als keines.
    s.familie = 'helvetica';
  }
}

// ------------------------------------------------------------- Bausteine aller Firmen

function absenderBlock(s: Setzer, x: number, y: number, farbe: Rgb, mitWeb: boolean): number {
  const { firma, felder } = s.d;
  const k = felder.kontakt;
  s.schrift('bold', 8.5, farbe);
  s.doc.text(firma.name, x, y);
  s.schrift('normal', 8.5, farbe);
  const zeilen = [firma.strasse, firma.plzOrt, '',
    ...(k?.telefon ? [`Mobil: ${k.telefon}`] : []), `Office: ${firma.telefon}`, '',
    ...(k?.email ? [k.email] : []), ...(mitWeb ? [firma.web] : [])];
  let yy = y + 4;
  for (const z of zeilen) { if (z) s.doc.text(sauber(z), x, yy); yy += z ? 4 : 2.5; }
  return yy;
}

function adresse(s: Setzer, x: number, y: number): number {
  let yy = y;
  s.d.adressbloecke.forEach((block, i) => {
    if (i > 0) yy += 3;
    block.forEach((z, j) => {
      s.schrift(j === 0 && i === 0 && s.d.firma.gestaltung === 'stimo' ? 'bold' : 'normal', 10);
      s.doc.text(sauber(z), x, yy);
      yy += 4.6;
    });
  });
  return yy;
}

function punkte(s: Setzer, b: Brief, akzent: Rgb, nummeriert: boolean, groesse = 10) {
  if (b.punkteTitel) {
    s.platz(12);
    if (nummeriert) {
      s.y += 2;
      s.gesperrt(b.punkteTitel, RAND, s.y, 8, akzent, 1.2, 'bold');
      s.y += 7;
    } else s.absatz(b.punkteTitel, { groesse, nach: 2 });
  }
  b.punkte.forEach((p, i) => {
    if (nummeriert) {
      s.schrift('normal', 9.5);
      const text = s.zeilen(p.text, BREITE - 52);
      s.platz(text.length * s.hoehe(9.5) + 2);
      s.schrift('bold', 9.5, akzent);
      s.doc.text(String(i + 1).padStart(2, '0'), RAND, s.y);
      s.schrift('bold', 9.5);
      s.doc.text(sauber(p.titel ?? ''), RAND + 12, s.y);
      s.schrift('normal', 9.5);
      text.forEach((z, j) => s.doc.text(z, RAND + 52, s.y + j * s.hoehe(9.5)));
      s.y += text.length * s.hoehe(9.5) + 2.6;
    } else {
      s.schrift('normal', groesse);
      const text = s.zeilen(p.text, BREITE - 6);
      s.platz(text.length * s.hoehe(groesse) + 1.5);
      s.doc.setFillColor(...akzent);
      s.doc.circle(RAND + 1.2, s.y - 1.2, 0.7, 'F');
      text.forEach((z, j) => s.doc.text(z, RAND + 5, s.y + j * s.hoehe(groesse)));
      s.y += text.length * s.hoehe(groesse) + 1.8;
    }
  });
  s.y += 2;
}

function zahlung(s: Setzer, b: Brief, akzent: Rgb) {
  if (!b.zahlung) return;
  s.platz(30);
  s.y += 2;
  s.gesperrt('Kaufpreiszahlung', RAND, s.y, 8, akzent, 1.2, 'bold');
  s.y += 7;
  for (const z of b.zahlung) {
    const summe = z.titel.startsWith('Total');
    if (summe) {
      s.doc.setDrawColor(...LINIE); s.doc.setLineWidth(0.2);
      s.doc.line(RAND, s.y - 4, RAND + BREITE, s.y - 4);
    }
    s.schrift('bold', 9.5);
    s.doc.text(z.titel, RAND, s.y);
    s.schrift(summe ? 'bold' : 'normal', 9.5);
    s.doc.text(chfText(z.betrag), RAND + BREITE, s.y, { align: 'right' });
    const t = z.text ? s.zeilen(z.text, 80) : [];
    s.schrift('normal', 9.5);
    t.forEach((x, j) => s.doc.text(x, RAND + 40, s.y + j * s.hoehe(9.5)));
    s.y += Math.max(1, t.length) * s.hoehe(9.5) + 2.5;
  }
  s.y += 2;
}

function unterschriften(s: Setzer, x: number, farbe: Rgb, firmaDarunter: boolean) {
  const u = s.d.felder.unterschriften;
  s.platz(14 + u.length * 14);
  s.absatz('Freundliche Grüsse', { x, farbe, nach: 12 });
  for (const p of u) {
    s.schrift('bold', 10, farbe);
    s.doc.text(sauber(p.name), x, s.y);
    s.schrift('normal', 9, farbe);
    const titel = [p.titel, firmaDarunter ? s.d.firma.name : ''].filter(Boolean).join(', ');
    if (titel) s.doc.text(sauber(titel), x, s.y + 4.5);
    s.y += 16;
  }
}

// ------------------------------------------------------------- stimo (Arbergstrasse)

function stimo(s: Setzer) {
  const { firma, brief: b, felder } = s.d;
  const von = firma.farbe.grund, bis = firma.farbe.ende ?? firma.farbe.akzent;
  // 1 Deckblatt
  s.verlauf(0, 0, A4.b, A4.h - 20, von, bis);
  s.schrift('bold', 16, WEISS);
  s.doc.text('stimo', A4.b - RAND, 26, { align: 'right' });
  s.gesperrt('Unternehmungen', A4.b - RAND, 31, 6, WEISS, 1, 'normal', true);
  s.gesperrt(b.art, RAND, 62, 11, WEISS, 2.4);
  s.schrift('normal', 30, WEISS);
  const titel = s.zeilen(s.d.titel.toUpperCase(), BREITE);
  titel.forEach((z, i) => s.doc.text(z, RAND, 76 + i * 12));
  s.gesperrt(s.d.untertitel, RAND, 78 + titel.length * 12, 10, WEISS, 2.2);
  if (s.d.luftbild) {
    const by = 100 + titel.length * 12, bh = Math.min(120, A4.h - 20 - by - 22), bb = (bh * 16) / 9 > BREITE ? BREITE : (bh * 16) / 9;
    const hh = (bb * 9) / 16;
    try {
      s.doc.addImage(s.d.luftbild, 'JPEG', RAND, by, bb, hh);
      s.doc.setDrawColor(...WEISS); s.doc.setLineWidth(0.6); s.doc.rect(RAND, by, bb, hh);
      // Wo das Grundstück liegt: die Mitte des Ausschnitts.
      s.doc.setLineWidth(0.8); s.doc.circle(RAND + bb / 2, by + hh / 2, 6);
      s.schrift('normal', 6.5, WEISS);
      s.doc.text('Luftbild: swisstopo (SWISSIMAGE)', RAND, by + hh + 4);
    } catch { /* ein kaputtes Bild nimmt das Deckblatt nicht mit */ }
  }

  // 2 Brief
  s.doc.addPage();
  stimoKopf(s);
  const xr = 132;
  const unterAbsender = absenderBlock(s, xr, 40, TEXT, false);
  const unterAdresse = adresse(s, RAND, 58);
  s.y = Math.max(unterAbsender, unterAdresse) + 14;
  s.schrift('bold', 10.5, von);
  s.doc.text(sauber(b.art).toUpperCase(), RAND, s.y);
  s.verlauf(RAND, s.y + 2, 26, 0.9, von, bis);
  s.schrift('normal', 9.5);
  s.doc.text(`${firma.ort}, ${datumKurz(felder.datum)}`, xr, s.y);
  s.y += 14;
  s.absatz(s.d.anrede, { groesse: 9.5, nach: 4 });
  b.einleitung.forEach(t => s.absatz(t, { groesse: 9.5, nach: 3 }));
  if (b.betragZeile) s.absatz(b.betragZeile, { groesse: 9.5 });
  s.platz(22);
  s.y += 6;
  s.schrift('bold', 24, von);
  s.doc.text(chfText(s.d.preis), A4.b / 2, s.y + 4, { align: 'center' });
  s.y += 12;
  if (b.betragUnter) { s.schrift('normal', 9, GRAU); s.doc.text(sauber(b.betragUnter), A4.b / 2, s.y, { align: 'center' }); s.y += 7; }
  s.y += 3;
  punkte(s, b, von, b.nummeriert, 9.5);
  zahlung(s, b, von);
  b.schluss.forEach(t => s.absatz(t, { groesse: 9.5, nach: 3 }));

  // 3 Über uns
  if (firma.ueberUns) {
    const u = firma.ueberUns;
    s.doc.addPage();
    stimoKopf(s);
    s.y = 50;
    s.schrift('bold', 19, von);
    s.zeilen(u.satz, BREITE - 20).forEach(z => { s.doc.text(z, RAND, s.y); s.y += 8.5; });
    s.y += 12;
    s.schrift('bold', 10.5, TEXT); s.doc.text('ÜBER UNS', RAND, s.y);
    s.verlauf(RAND, s.y + 2, 26, 0.9, von, bis);
    s.y += 11;
    const zukunft = /bestand|liegenschaft/i.test(felder.nutzung) ? felder.nutzung : felder.nutzung.replace(/^eine hochwertige Wohnüberbauung im Stockwerkeigentum$/, 'eine sorgfältig in die Umgebung eingebettete Neuüberbauung mit Eigentumswohnungen');
    u.text.forEach(t => s.absatz(t.replace('{zukunft}', zukunft), { groesse: 9.5, nach: 3.5 }));
    s.y += 6;
    s.gesperrt(u.referenzenTitel, RAND, s.y, 8, bis, 0.6, 'bold');
    s.y += 8;
    const sp = (BREITE - 10) / 2;
    u.referenzen.forEach((r, i) => {
      const x = RAND + (i % 2) * (sp + 10), y0 = s.y + Math.floor(i / 2) * 34;
      s.doc.setDrawColor(...TEXT); s.doc.setLineWidth(0.2); s.doc.line(x, y0 - 4, x + sp, y0 - 4);
      s.schrift('bold', 9.5); s.doc.text(r.titel, x, y0 + 1);
      s.schrift('normal', 8, GRAU); s.doc.text(sauber(r.adresse), x, y0 + 5.5);
      s.schrift('normal', 8.5);
      const t = s.zeilen(r.text, sp);
      t.forEach((z, j) => s.doc.text(z, x, y0 + 11 + j * 4));
      s.doc.text(r.jahre, x, y0 + 11 + t.length * 4);
    });
    s.y += Math.ceil(u.referenzen.length / 2) * 34 + 4;
    s.absatz(u.fuss, { groesse: 7.5, farbe: GRAU });
  }

  // 4 Unterschrift
  s.doc.addPage();
  s.verlauf(0, 0, A4.b, A4.h - 20, von, bis);
  s.schrift('bold', 16, WEISS);
  s.doc.text('stimo', A4.b - RAND, 26, { align: 'right' });
  s.gesperrt('Unternehmungen', A4.b - RAND, 31, 6, WEISS, 1, 'normal', true);
  s.y = 70;
  unterschriften(s, 110, WEISS, false);
  if (firma.leitsatz) {
    s.schrift('bold', 26, WEISS);
    s.doc.text(firma.leitsatz.titel, A4.b - RAND, 215, { align: 'right' });
    s.schrift('normal', 9.5, WEISS);
    s.zeilen(firma.leitsatz.text, 85).forEach((z, i) => s.doc.text(z, 100, 228 + i * 4.6));
  }
}

function stimoKopf(s: Setzer): number {
  const von = s.d.firma.farbe.grund;
  s.schrift('bold', 15, von); s.doc.text('stimo', RAND, 24);
  s.gesperrt('Unternehmungen', RAND, 28.5, 5.5, von, 0.9);
  return 45;
}

function stimoFuss(s: Setzer) {
  const { firma } = s.d;
  const seite = s.doc.getCurrentPageInfo().pageNumber, n = s.doc.getNumberOfPages();
  // Deckblatt und Unterschrift stehen auf dem Verlauf, mit weissem Fuss; der Brief hat den Verlauf im Fuss.
  const aufVerlauf = seite === 1 || seite === n;
  if (!aufVerlauf) s.verlauf(0, A4.h - 20, A4.b, 20, firma.farbe.grund, firma.farbe.ende ?? firma.farbe.akzent);
  const f: Rgb = aufVerlauf ? TEXT : WEISS;
  s.schrift('bold', 7.5, f); s.doc.text(firma.name, RAND, A4.h - 11);
  s.schrift('normal', 7.5, f); s.doc.text(firma.web, RAND, A4.h - 7.5);
  s.doc.text(firma.strasse, A4.b - RAND, A4.h - 11, { align: 'right' });
  s.doc.text(firma.plzOrt, A4.b - RAND, A4.h - 7.5, { align: 'right' });
}

// ------------------------------------------------------------- Lebensraum (Meilen, Niederglatt)

function lebensraum(s: Setzer) {
  const { firma, brief: b, felder } = s.d;
  const dunkel = firma.farbe.grund, mint = firma.farbe.akzent;
  // Das Mint der Vorlage ist auf Weiss zu hell für kleine Schrift: dort dunkler.
  const mintAufWeiss = mischen(mint, [40, 90, 60], 0.55);
  const marke = (farbe: Rgb, y = 22) => {
    s.doc.setDrawColor(...farbe); s.doc.setLineWidth(0.5); s.doc.rect(RAND, y - 5, 6.5, 6.5);
    s.schrift('normal', 10, farbe);
    s.doc.text('Lebensraum', RAND + 9, y - 1.3);
    s.doc.text('Schweiz AG', RAND + 9, y + 2.9);
  };

  // 1 Deckblatt
  s.doc.setFillColor(...dunkel); s.doc.rect(0, 0, A4.b, A4.h, 'F');
  marke(WEISS);
  s.gesperrt(b.art, RAND, 180, 8, mint, 2);
  s.schrift('normal', 30, WEISS);
  const titel = s.zeilen(s.d.titel, BREITE);
  titel.forEach((z, i) => s.doc.text(z, RAND, 196 + i * 12));
  // Der Ort kursiv in Mint (Meilen); kursiv gibt es nur bei Helvetica, die freien Schriften liegen gerade bei.
  s.doc.setFont(s.familie, s.familie === 'helvetica' ? 'italic' : 'normal');
  s.doc.setTextColor(...mint);
  s.doc.text(sauber(s.d.untertitel.replace(/^\d{4}\s+/, '')), RAND, 196 + titel.length * 12);
  s.doc.setDrawColor(...mischen(dunkel, WEISS, 0.3)); s.doc.setLineWidth(0.2);
  s.doc.line(RAND, 222 + titel.length * 6, A4.b - RAND, 222 + titel.length * 6);
  s.schrift('bold', 8, WEISS); s.doc.text(sauber(s.d.kat), RAND, 230 + titel.length * 6);
  s.schrift('normal', 8, mischen(dunkel, WEISS, 0.6)); s.doc.text(`${firma.ort}, ${datumLang(felder.datum)}`, RAND, 235 + titel.length * 6);

  // 2 Brief
  s.doc.addPage();
  marke(TEXT);
  const xr = 132;
  s.schrift('bold', 7.5, TEXT); s.doc.text(firma.name, xr, 40);
  s.schrift('normal', 7.5, GRAU);
  const k = felder.kontakt;
  [firma.strasse, firma.plzOrt, '', `T ${firma.telefon}`, ...(k?.telefon ? [`M ${k.telefon}`] : []), ...(k?.email ? [k.email] : []), firma.web]
    .reduce((y, z) => { if (z) s.doc.text(sauber(z), xr, y); return y + (z ? 3.6 : 2.4); }, 43.6);
  const unten = adresse(s, RAND, 52);
  s.y = Math.max(unten, 80) + 8;
  s.schrift('normal', 8.5, GRAU); s.doc.text(`${firma.ort}, ${datumLang(felder.datum)}`, RAND, s.y);
  s.y += 12;
  s.gesperrt(b.art, RAND, s.y, 6.5, mintAufWeiss, 1.6, 'bold');
  s.y += 7;
  s.absatz(b.betreff === 'Kaufangebot' || b.betreff === 'Unverbindliches Kaufangebot' ? `${s.d.titel}, ${s.d.untertitel}` : b.betreff, { groesse: 14, nach: 5 });
  s.absatz(s.d.anrede, { nach: 3 });
  b.einleitung.forEach(t => s.absatz(t, { groesse: 9.5, nach: 3 }));
  if (b.betragZeile) s.absatz(b.betragZeile, { groesse: 9.5 });
  // Der Preis im dunklen Feld (Niederglatt).
  s.platz(30);
  s.doc.setFillColor(...dunkel); s.doc.rect(RAND, s.y, BREITE, b.betragUnter ? 26 : 21, 'F');
  s.gesperrt(b.art === 'Kaufangebot' ? 'Kaufpreis' : 'Kaufpreis · unverbindlich', RAND + 6, s.y + 6.5, 6.5, mint, 1.4, 'bold');
  s.schrift('normal', 20, WEISS); s.doc.text(chfText(s.d.preis), RAND + 6, s.y + 15.5);
  if (b.betragUnter) { s.schrift('normal', 7, mint); s.doc.text(sauber(b.betragUnter), RAND + 6, s.y + 21.5, { maxWidth: BREITE - 12 }); }
  s.y += (b.betragUnter ? 26 : 21) + 10;
  punkte(s, b, mintAufWeiss, b.nummeriert);
  zahlung(s, b, mintAufWeiss);
  b.schluss.forEach(t => s.absatz(t, { groesse: 9.5, nach: 3 }));
  s.y += 3;
  unterschriften(s, RAND, TEXT, true);
}

function lebensraumKopf(s: Setzer): number {
  s.doc.setDrawColor(...TEXT); s.doc.setLineWidth(0.5); s.doc.rect(RAND, 17, 6.5, 6.5);
  s.schrift('normal', 10, TEXT);
  s.doc.text('Lebensraum', RAND + 9, 20.7); s.doc.text('Schweiz AG', RAND + 9, 24.9);
  return 42;
}

function lebensraumFuss(s: Setzer) {
  const seite = s.doc.getCurrentPageInfo().pageNumber;
  if (seite === 1) return;
  const { firma } = s.d;
  s.doc.setDrawColor(...LINIE); s.doc.setLineWidth(0.2); s.doc.line(RAND, A4.h - 16, A4.b - RAND, A4.h - 16);
  s.schrift('normal', 7, GRAU);
  s.doc.text(`${firma.name} · ${firma.strasse} · ${firma.plzOrt} · ${firma.web}`, RAND, A4.h - 11);
  s.doc.text(`Seite ${seite - 1}`, A4.b - RAND, A4.h - 11, { align: 'right' });
}

// ------------------------------------------------------------- Studer (Word-Vorlage vom 23. November)

/*
 * Studer, gesetzt wie Word die Vorlage setzt (Julian, 23. November: «genau
 * so wie ich geschickt habe mit dem Layout»). Jedes Mass kommt aus dem
 * Dokument: Ränder 1440 Twips, Arial 11 (Helvetica ist gleich breit, also
 * bricht jede Zeile wie in Word), die Abstände sind leere Absätze in der
 * Vorgabeschrift des Dokuments (Times New Roman 10), die Eckpunkte stehen
 * mit 1.5 Zeilen, das Datum ist 6372 Twips eingerückt, der Fuss steht 708
 * Twips über dem Blattrand, ohne Linie und ohne Seitenzahl. Bei 1.5 Zeilen
 * legt Word den Mehrraum unter den Text, und er darf über den unteren Rand
 * ragen (an PDF gemessen, die Word selbst schrieb: docxodus #908 und #1571;
 * die Zeilenhöhen dort: Times 10 229.98 Twips, Arial 11 252.97).
 */
const twip = (n: number) => (n / 1440) * 25.4;
/** Arial (gleich wie Liberation Sans): über und unter der Grundlinie und die einfache Zeile, je Punkt Schriftgrösse. */
const ARIAL = { ueber: (1854 + 67) / 2048, unter: 434 / 2048, zeile: (1854 + 434 + 67) / 2048 };
/** Ein leerer Absatz in Times New Roman 10: (1825 + 443 + 87) / 2048 × 10 pt. */
const LEER = pt(10) * ((1825 + 443 + 87) / 2048);
/** Unterstrich unter dem fetten Titel (Arial 12): so tief und so dick, wie er in der Vorlage liegt. */
const UNTERSTRICH = { tiefer: 0.457, dicke: pt(0.6) };
const SCHWARZ: Rgb = [0, 0, 0];

/**
 * Helvetica und Helvetica-Bold, Breite je Zeichen in 1/1000 Geviert: U+0020
 * bis U+007E, dann U+00A0 bis U+00FF, dazu einzelne Satzzeichen. Es sind die
 * Werte aus Adobes Masstabelle, gleich wie Arial (aus Liberation Sans 2.1.5
 * gelesen). jsPDF rundet sie auf Zehner (550 statt 556) und misst mit
 * Unterschneidung, zeichnet aber ohne: die Fusszeile stand so 0.4 mm neben
 * der Mitte, und eine Zeile hätte anders brechen können als in Word.
 */
const HELVETICA_TABELLE = {
  normal: '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584 278 333 556 556 556 556 260 556 333 737 370 556 584 333 737 552 400 549 333 333 333 576 537 333 333 333 365 556 834 834 834 611 667 667 667 667 667 667 1000 722 667 667 667 667 278 278 278 278 722 722 778 778 778 778 778 584 778 722 722 722 722 667 667 611 556 556 556 556 556 556 889 500 556 556 556 556 278 278 278 278 556 556 556 556 556 556 556 549 611 556 556 556 556 500 556 500',
  bold: '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584 278 333 556 556 556 556 280 556 333 737 370 556 584 333 737 552 400 549 333 333 333 576 556 333 333 333 365 556 834 834 834 611 722 722 722 722 722 722 1000 722 667 667 667 667 278 278 278 278 722 722 778 778 778 778 778 584 778 722 722 722 722 667 667 611 556 556 556 556 556 556 889 556 556 556 556 556 278 278 278 278 611 611 611 611 611 611 611 549 611 611 611 611 611 556 611 556',
};
const HELVETICA_SATZZEICHEN = {
  normal: { 0x2013: 556, 0x2014: 1000, 0x2018: 222, 0x2019: 222, 0x201a: 222, 0x201c: 333, 0x201d: 333, 0x201e: 333, 0x2022: 350, 0x2026: 1000, 0x2039: 333, 0x203a: 333, 0x20ac: 556 },
  bold: { 0x2013: 556, 0x2014: 1000, 0x2018: 278, 0x2019: 278, 0x201a: 278, 0x201c: 500, 0x201d: 500, 0x201e: 500, 0x2022: 350, 0x2026: 1000, 0x2039: 333, 0x203a: 333, 0x20ac: 556 },
};
const helveticaBreiten = (stil: 'normal' | 'bold') => {
  const m = new Map<number, number>();
  HELVETICA_TABELLE[stil].split(' ').map(Number).forEach((b, i) => m.set(i < 95 ? 32 + i : 160 + i - 95, b));
  for (const [z, b] of Object.entries(HELVETICA_SATZZEICHEN[stil])) m.set(Number(z), b);
  return m;
};
const HELVETICA = { normal: helveticaBreiten('normal'), bold: helveticaBreiten('bold') };

/** Breite in mm, so wie der Betrachter den Text zeichnet. */
function breiteMm(doc: jsPDF, text: string): number {
  const f = doc.getFont();
  if (f.fontName !== 'helvetica') return doc.getTextWidth(text); // eigene Schriften misst jsPDF genau
  const tabelle = HELVETICA[f.fontStyle === 'bold' ? 'bold' : 'normal'];
  let tausendstel = 0;
  for (const z of text) tausendstel += tabelle.get(z.codePointAt(0)!) ?? 556;
  return (tausendstel / 1000) * doc.getFontSize() * (25.4 / 72);
}

type Teil = { text: string; fett: boolean };
/** «**fett**» wird zu Teilen, wie die Vorlage einzelne Wörter fett setzt. */
const teile = (t: string, fett = false): Teil[] =>
  sauber(t).split('**').map((text, i) => ({ text, fett: i % 2 === 1 ? !fett : fett })).filter(x => x.text);

function studer(s: Setzer) {
  const { doc, d } = s;
  const { firma, brief: b, felder } = d;
  const rand = twip(1440);
  const unten = A4.h - twip(1440);
  const zeileH = (g: number) => pt(g) * ARIAL.zeile;
  const anderthalb = 1.5 * zeileH(11);
  let y = twip(1440); // Oberkante der nächsten Zeile

  const neueSeite = () => { doc.addPage(); y = twip(1440); };
  // Auch ein leerer Absatz, der nicht mehr passt, steht in Word oben auf der
  // nächsten Seite. Passen muss nur der Text selbst, nicht der Mehrraum darunter.
  const leer = (n = 1, h = LEER, text = h) => { for (let i = 0; i < n; i++) { if (y + text > unten) neueSeite(); y += h; } };
  const breite = (t: Teil, g: number) => { doc.setFont(s.familie, t.fett ? 'bold' : 'normal'); doc.setFontSize(g); return breiteMm(doc, t.text); };

  /** Bricht wie Word: nach Leerraum und nach einem Bindestrich vor einem Buchstaben, sonst nie. */
  const umbrechen = (zeile: Teil[], g: number, max: number): Teil[][] => {
    type Stueck = { teile: Teil[]; b: number; raum: Teil | null; rb: number };
    const stuecke: Stueck[] = [];
    let st: Stueck = { teile: [], b: 0, raum: null, rb: 0 };
    const fertig = () => { if (st.teile.length || st.raum) stuecke.push(st); st = { teile: [], b: 0, raum: null, rb: 0 }; };
    for (const t of zeile) {
      for (const wort of t.text.split(/(\s+)/)) {
        if (!wort) continue;
        if (/^\s+$/.test(wort)) { st.raum = { text: wort, fett: t.fett }; st.rb = breite(st.raum, g); fertig(); continue; }
        const silben = wort.split(/(?<=-)(?=\p{L})/u);
        silben.forEach((silbe, i) => {
          const tt = { text: silbe, fett: t.fett };
          st.teile.push(tt); st.b += breite(tt, g);
          if (i < silben.length - 1) fertig();
        });
      }
    }
    fertig();
    const zeilen: Stueck[][] = [];
    let jetzt: Stueck[] = [], w = 0;
    for (const x of stuecke) {
      const davor = jetzt.length ? jetzt[jetzt.length - 1].rb : 0;
      // Zwei Zehntelmillimeter Spiel: Rundung, nicht ein Wort mehr.
      if (jetzt.length && w + davor + x.b > max + 0.2) { zeilen.push(jetzt); jetzt = []; w = 0; }
      w += (jetzt.length ? davor : 0) + x.b;
      jetzt.push(x);
    }
    if (jetzt.length) zeilen.push(jetzt);
    // Leerraum am Zeilenende fällt weg; gleiche Schnitte nacheinander werden ein Text.
    return zeilen.map(z => z.flatMap((x, i) => (i < z.length - 1 && x.raum ? [...x.teile, x.raum] : x.teile))
      .reduce<Teil[]>((a, t) => { const l = a[a.length - 1]; if (l && l.fett === t.fett) l.text += t.text; else a.push({ ...t }); return a; }, []));
  };

  /** Eine Zeile der Höhe h; Word setzt den Text oben hinein, der Mehrraum bleibt darunter. */
  const setzen = (zeile: Teil[], x: number, g: number, h: number, unterstrichen: boolean) => {
    if (y + zeileH(g) > unten) neueSeite();
    const grund = y + pt(g) * ARIAL.ueber;
    let xx = x;
    doc.setTextColor(...SCHWARZ);
    for (const t of zeile) {
      const w = breite(t, g);
      doc.text(t.text, xx, grund);
      xx += w;
    }
    if (unterstrichen) {
      doc.setDrawColor(...SCHWARZ); doc.setLineWidth(UNTERSTRICH.dicke);
      doc.line(x, grund + UNTERSTRICH.tiefer, xx, grund + UNTERSTRICH.tiefer);
    }
    y += h;
  };
  const absatz = (text: string, o: { x?: number; g?: number; h?: number; fett?: boolean; unterstrichen?: boolean } = {}) => {
    const g = o.g ?? 11, x = o.x ?? rand;
    // Ein «\n» bricht wie die harten Umbrüche der Vorlage.
    for (const harte of text.split('\n')) {
      for (const z of umbrechen(teile(harte, o.fett), g, A4.b - rand - x)) setzen(z, x, g, o.h ?? zeileH(g), !!o.unterstrichen);
    }
  };

  if (s.logo && firma.logo) doc.addImage(s.logo, 'JPEG', firma.logo.x, firma.logo.y, firma.logo.breite, firma.logo.hoehe);
  leer(4); // der Absatz mit dem Logo und drei leere
  d.adressbloecke.forEach((block, i) => { if (i) leer(); block.forEach(z => absatz(z)); });
  leer(3);
  // Das Datum steht 6372 Twips eingerückt. «Wollerau, 23. November 2026» ist
  // dafür zu lang und bräche in Word um; es endet dann bündig am rechten Rand.
  const datum = `${firma.ort}, ${datumLang(felder.datum)}`;
  absatz(datum, { x: Math.min(rand + twip(6372), A4.b - rand - breite({ text: datum, fett: false }, 11)) });
  leer(2);
  absatz(b.art, { g: 12, fett: true, unterstrichen: true });
  leer();
  absatz(d.anrede);
  leer();
  b.einleitung.forEach((t, i) => { if (i) leer(); absatz(t); });
  leer();
  if (b.betragZeile) absatz(b.betragZeile);
  leer(1, anderthalb, zeileH(11));
  for (const p of b.punkte) absatz(p.titel ? `**${p.titel}**: ${p.text}` : p.text, { h: anderthalb });
  // Zwischen den drei Absätzen am Schluss steht eine leere Zeile in Arial 11.
  b.schluss.forEach((t, i) => { if (i) leer(1, zeileH(11)); absatz(t); });
  leer(2);
  absatz('Freundliche Grüsse');
  leer();
  felder.unterschriften.forEach((u, i) => {
    if (i) leer();
    if (u.titel) absatz(u.titel);
    absatz(`**${u.name}**`);
  });
}

function studerFuss(s: Setzer) {
  const t = s.d.firma.fusszeile;
  if (!t) return;
  const text = sauber(t);
  s.doc.setFont(s.familie, 'normal'); s.doc.setFontSize(8); s.doc.setTextColor(...SCHWARZ);
  // Mittig zwischen den Rändern; selbst gerechnet, weil «align: center» mit Unterschneidung misst.
  s.doc.text(text, A4.b / 2 - breiteMm(s.doc, text) / 2, A4.h - twip(708) - pt(8) * ARIAL.unter);
}

// ------------------------------------------------------------- Einstieg

export async function angebotPdf(d: AngebotPdfDaten, laden: DateiLaden = ausDemNetz): Promise<jsPDF> {
  const art = d.firma.gestaltung;
  const s = new Setzer(d,
    art === 'stimo' ? stimoFuss : art === 'lebensraum' ? lebensraumFuss : studerFuss,
    art === 'stimo' ? stimoKopf : art === 'lebensraum' ? lebensraumKopf : () => twip(1440));
  s.unten = art === 'stimo' ? A4.h - 28 : art === 'lebensraum' ? A4.h - 24 : A4.h - twip(1440);
  await schriftenLaden(s, d.schrift, laden);
  if (d.firma.logo) {
    // Ohne Netz kommt das Angebot ohne Logo: besser als keines, wie bei der Schrift.
    try { s.logo = new Uint8Array(await laden(d.firma.logo.datei)); } catch { s.logo = null; }
  }
  s.doc.setProperties({
    title: `${d.brief.art} ${d.titel}, ${d.untertitel}`,
    subject: `${d.brief.art} über ${chfText(d.preis)}`,
    author: d.firma.name,
    creator: 'CALC YOU LATER',
  });
  if (art === 'stimo') stimo(s); else if (art === 'lebensraum') lebensraum(s); else studer(s);
  return s.fertig();
}

/** «Kaufangebot_Arbergstrasse28_2026-12-10.pdf», wie die Vorlagen heissen. */
export function angebotDateiname(titel: string, datum: string): string {
  const teil = titel.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
  return `Kaufangebot_${teil || 'Angebot'}_${datum}.pdf`;
}

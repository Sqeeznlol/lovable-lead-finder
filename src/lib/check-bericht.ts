/**
 * Der Bericht der Check-Seite als echtes PDF, erst nach den Kontaktangaben.
 *
 * Julian, 19. November: «Name und Adresse muss man eingeben und die
 * Nummer und vielleicht noch eine E-Mail-Adresse und erst dann am Schluss
 * bekommt man ein PDF.» Bis dahin war der Bericht der Druck der Seite
 * (window.print). Auf dem iPhone öffnet das den Druckdialog; ein PDF
 * daraus zu machen, schaffen ältere Eigentümer kaum. Jetzt entsteht eine
 * Datei, die sich mit einem Tipp öffnen, sichern und weiterleiten lässt.
 *
 * Ohne React und ohne Datenbank: was im Bericht steht, kommt vollständig
 * aus dem, was die Seite schon gezeigt hat (BerichtDaten). jsPDF wird erst
 * beim Tippen geladen; die Seite bleibt so leicht wie vorher.
 */
import type { jsPDF as JsPdf } from 'jspdf';

export interface BerichtZeile { titel: string; wert: string; zusatz?: string }
export interface BerichtAbschnitt { titel: string; satz?: string; zeilen: BerichtZeile[] }
// Ohne Quellen: Julian, 19. November: «Quelle rausnehmen im Bericht». Auf der Seite stehen sie weiter.
export interface BerichtTipp { titel: string; text: string }

export interface BerichtDaten {
  marke: string;
  farbe: string;
  domain: string;
  datum: Date;
  adresse: string;
  /** Gemeinde, Parzelle, Kanton in einer Zeile. */
  ort: string;
  egrid?: string | null;
  /** Luftbild mit Umriss als JPEG (Daten-URL), oder null, wenn der Bund nicht antwortet. */
  bild?: string | null;
  kennzahlen: BerichtZeile[];
  /** Die Berechnung, wie sie nach dem Freischalten auf der Seite steht. */
  rechnung?: BerichtAbschnitt | null;
  abschnitte: BerichtAbschnitt[];
  tipps: BerichtTipp[];
  /** Für wen der Bericht ist. */
  fuer: string;
  betreiber: string;
  betreiberAdresse: string[];
}

const RAND = 18;
const BREITE = 210 - 2 * RAND;
const UNTEN = 297 - 22;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** Dateiname ohne Zeichen, die ein Telefon oder Windows nicht mag. */
export function berichtDateiname(adresse: string, datum: Date): string {
  const teil = adresse.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const d = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  return `Bericht-${teil || 'Liegenschaft'}-${d}.pdf`;
}

/** Baut das PDF. Getrennt vom Herunterladen, damit es sich prüfen lässt. */
export async function berichtPdf(d: BerichtDaten): Promise<JsPdf> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${d.marke}: ${d.adresse}`, subject: 'Bericht zur Liegenschaft', author: d.betreiber, creator: d.domain });
  const marke = rgb(d.farbe);
  const tinte: [number, number, number] = [18, 22, 28];
  const grau: [number, number, number] = [94, 101, 115];
  let y = RAND;

  const platz = (h: number) => { if (y + h > UNTEN) { doc.addPage(); y = RAND; } };
  // Weiche Trennstriche aus den Daten (Eigentums\u00ADwohnung) zeichnet jsPDF als Bindestrich.
  // Helvetica im PDF kennt nur die Zeichen von Windows-1252: das Minus der Rechnung (U+2212)
  // erschien als «"» (19. November, Beispielbericht). Darum der Gedankenstrich, den sie kennt.
  const rein = (t: string) => t.replace(/\u00AD/g, '').replace(/\u2212/g, '\u2013').replace(/[\u2009\u202F]/g, ' ');
  const absatz = (text: string, groesse: number, stil: 'normal' | 'bold' = 'normal', farbe = tinte, abstand = 1.45, breite = BREITE, x = RAND) => {
    doc.setFont('helvetica', stil); doc.setFontSize(groesse); doc.setTextColor(...farbe);
    const zeilen = doc.splitTextToSize(rein(text), breite) as string[];
    const h = (groesse * 0.3528) * abstand;
    for (const z of zeilen) { platz(h); doc.text(z, x, y + h * 0.75); y += h; }
  };
  const ueberschrift = (t: string) => {
    platz(14); y += 5;
    doc.setDrawColor(231, 229, 225); doc.setLineWidth(0.3); doc.line(RAND, y, RAND + BREITE, y); y += 5;
    absatz(t, 13, 'bold');
    y += 1.5;
  };
  const zeilen = (liste: BerichtZeile[]) => {
    for (const z of liste) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const links = doc.splitTextToSize(rein(z.titel), 52) as string[];
      const rechts = doc.splitTextToSize(rein(z.zusatz ? `${z.wert} (${z.zusatz})` : z.wert), BREITE - 58) as string[];
      const h = Math.max(links.length, rechts.length) * 5.2 + 1.6;
      platz(h);
      doc.setTextColor(...grau); links.forEach((t, i) => doc.text(t, RAND, y + 4 + i * 5.2));
      doc.setTextColor(...tinte); rechts.forEach((t, i) => doc.text(t, RAND + 58, y + 4 + i * 5.2));
      y += h;
    }
  };

  // Kopf: Marke links, Datum rechts.
  doc.setFillColor(...marke); doc.rect(0, 0, 210, 5, 'F');
  y = RAND;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...marke);
  doc.text(d.marke, RAND, y + 3);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...grau);
  doc.text(`Bericht vom ${d.datum.toLocaleDateString('de-CH')} · ${d.domain}`, RAND + BREITE, y + 3, { align: 'right' });
  y += 12;
  absatz(d.adresse, 20, 'bold', tinte, 1.25);
  absatz([d.ort, d.egrid ? `EGRID ${d.egrid}` : ''].filter(Boolean).join(' · '), 10.5, 'normal', grau);
  absatz(`Erstellt für ${d.fuer}`, 10.5, 'normal', grau);
  y += 4;

  if (d.bild) {
    const h = BREITE * 9 / 16;
    platz(h + 6);
    try { doc.addImage(d.bild, 'JPEG', RAND, y, BREITE, h); y += h + 2; absatz('Luftbild swisstopo, Umriss aus der amtlichen Vermessung', 8.5, 'normal', grau); }
    catch { /* ohne Bild geht der Bericht auch */ }
  }

  // Die vier Kennzahlen als Reihe, wie oben auf der Seite.
  if (d.kennzahlen.length) {
    y += 4; platz(24);
    const w = BREITE / d.kennzahlen.length;
    d.kennzahlen.forEach((k, i) => {
      const x = RAND + i * w;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...grau); doc.text(k.titel, x, y + 3.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...tinte); doc.text(doc.splitTextToSize(k.wert, w - 3)[0] ?? '', x, y + 10.5);
      if (k.zusatz) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grau); doc.text(doc.splitTextToSize(k.zusatz, w - 3).slice(0, 2), x, y + 15.5); }
    });
    y += 24;
  }

  if (d.rechnung) {
    ueberschrift(d.rechnung.titel);
    if (d.rechnung.satz) { absatz(d.rechnung.satz, 10.5, 'normal', grau); y += 2; }
    zeilen(d.rechnung.zeilen);
  }

  for (const a of d.abschnitte) {
    if (!a.zeilen.length && !a.satz) continue;
    ueberschrift(a.titel);
    if (a.satz) { absatz(a.satz, 10.5); y += 1.5; }
    zeilen(a.zeilen);
  }

  if (d.tipps.length) {
    ueberschrift('Tipps für Eigentümer');
    for (const t of d.tipps) {
      platz(14);
      absatz(t.titel, 11, 'bold');
      absatz(t.text, 10.5);
      y += 2.5;
    }
  }

  ueberschrift('Wie es weitergeht');
  absatz(`Fachleute von ${d.betreiber} prüfen die Bau- und Zonenordnung Ihrer Gemeinde und melden sich innert zwei Arbeitstagen bei Ihnen. Die Prüfung ist kostenlos und unverbindlich.`, 10.5);
  y += 2;
  absatz([d.betreiber, ...d.betreiberAdresse].join(', '), 10.5, 'normal', grau);

  // Fuss auf jeder Seite: was der Bericht ist und was nicht.
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...grau);
    doc.text('Vorprüfung auf Grundlage amtlicher Daten, keine Bewilligungszusage und keine Verkehrswertschätzung.', RAND, 297 - 14);
    doc.text(`Seite ${i} von ${seiten}`, RAND + BREITE, 297 - 14, { align: 'right' });
  }
  return doc;
}

/**
 * Lädt das PDF herunter. Auf dem iPhone öffnet Safari die Datei in der
 * Vorschau; dort lässt sie sich sichern oder weiterleiten.
 */
export async function berichtSpeichern(d: BerichtDaten): Promise<void> {
  const doc = await berichtPdf(d);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = berichtDateiname(d.adresse, d.datum); a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Luftbild des Bundes mit dem Umriss der Parzelle, als JPEG für den
 * Bericht. wms.geo.admin.ch erlaubt das Laden von fremden Seiten
 * (Access-Control-Allow-Origin: *, am 19. November nachgesehen); sonst
 * bliebe die Leinwand gesperrt und toDataURL schlüge fehl.
 */
export async function luftbildMitUmriss(teile: number[][][][], farbe: string, px = 1200): Promise<string | null> {
  const punkte = teile.flat(2);
  if (!punkte.length || typeof document === 'undefined') return null;
  const es = punkte.map(p => p[0]), ns = punkte.map(p => p[1]);
  const mitteE = (Math.min(...es) + Math.max(...es)) / 2, mitteN = (Math.min(...ns) + Math.max(...ns)) / 2;
  // So breit, dass die Parzelle mit Rand ins Bild passt, mindestens 60 m.
  const breiteM = Math.max(60, (Math.max(...es) - Math.min(...es)) * 1.6, (Math.max(...ns) - Math.min(...ns)) * 1.6 * 16 / 9);
  const hoeheM = breiteM * 9 / 16;
  const hoehePx = Math.round(px * 9 / 16);
  const bbox = [mitteE - breiteM / 2, mitteN - hoeheM / 2, mitteE + breiteM / 2, mitteN + hoeheM / 2];
  const url = `https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=&FORMAT=image/jpeg&CRS=EPSG:2056&BBOX=${bbox.map(Math.round).join(',')}&WIDTH=${px}&HEIGHT=${hoehePx}`;
  const bild = await new Promise<HTMLImageElement | null>(ok => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    const t = window.setTimeout(() => ok(null), 12_000);
    i.onload = () => { window.clearTimeout(t); ok(i); };
    i.onerror = () => { window.clearTimeout(t); ok(null); };
    i.src = url;
  });
  if (!bild) return null;
  const c = document.createElement('canvas'); c.width = px; c.height = hoehePx;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(bild, 0, 0, px, hoehePx);
  const x = (e: number) => ((e - bbox[0]) / breiteM) * px;
  const yy = (n: number) => hoehePx - ((n - bbox[1]) / hoeheM) * hoehePx;
  g.lineWidth = Math.max(3, px / 300); g.strokeStyle = farbe; g.fillStyle = `${farbe}33`;
  for (const teil of teile) {
    g.beginPath();
    for (const ring of teil) ring.forEach(([e, n], i) => (i ? g.lineTo(x(e), yy(n)) : g.moveTo(x(e), yy(n))));
    g.closePath(); g.fill('evenodd'); g.stroke();
  }
  try { return c.toDataURL('image/jpeg', 0.82); } catch { return null; }
}

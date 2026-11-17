/**
 * Wie aufwendig die 3D-Karte zeichnet.
 *
 * Julian, 17. November: "die 3D-Ansicht ist mega langsam und dann stockt
 * die ganze Webseite". Gemessen am selben Tag an Albisrieden, 1440 × 900,
 * im Browser ohne Grafikkarte (Zeit je Bild, nur untereinander
 * vergleichbar; 76 Hauskacheln, 506'000 Dreiecke in jedem Fall):
 *
 *   einfache Dichte, ohne Glättung, ohne Schatten      1.6 s
 *   einfache Dichte, Glättung 4                        2.9 s
 *   einfache Dichte, Glättung 4, Schatten              3.8 s   (bisher, normaler Bildschirm)
 *   doppelte Dichte, ohne Glättung, ohne Schatten      4.5 s
 *   doppelte Dichte, ohne Glättung, Schatten           5.7 s
 *   doppelte Dichte, Glättung 4, Schatten              8.1 s   (bisher, Retina)
 *
 * Teuer sind also die Bildpunkte, nicht die Kacheln: Cesium wählt die
 * Kacheln ohnehin nach der Pixeldichte (dieselben 76 bei jeder Dichte).
 * Die vierfache Kantenglättung ist Cesiums Vorgabe und auf einem
 * Bildschirm mit doppelter Dichte kaum zu sehen.
 *
 * Darum: Glättung nur, wo die Dichte sie braucht, eine Obergrenze für
 * die Bildpunkte, und Stufen, auf die die Karte selbst zurückgeht, wenn
 * das Gerät nicht mitkommt (Taktmesser).
 */

export interface Geraet {
  /** Bildpunkte des Bildschirms je CSS-Pixel. */
  dpr: number;
  /** Grösse der Karte in CSS-Pixeln. */
  breite: number; hoehe: number;
  /** Ab 1024 px Breite: dort gibt es Schatten. */
  gross: boolean;
}
export interface Guete {
  /** Gezeichnete Bildpunkte je CSS-Pixel. */
  pixel: number;
  glaettung: 1 | 2 | 4;
  schatten: boolean;
}

/**
 * Stufe 0 ist die schönste, 4 die sparsamste:
 *   0  volle Dichte, Schatten
 *   1  ohne Schatten, Glättung höchstens 2
 *   2  drei Viertel der Dichte
 *   3  einfache Dichte, mit Glättung 2 (ohne sie zeigen sich an den Nähten
 *      der Geländekacheln helle Punkte -- im Bild gesehen am 17. November)
 *   4  einfache Dichte ohne Glättung
 */
export const LETZTE_STUFE = 4;
/**
 * Mehr Bildpunkte zeichnet die Karte nie: ein Laptop mit doppelter Dichte
 * (1440 × 843 CSS-Pixel Karte) bleibt mit 4.9 Mio. knapp darunter und
 * damit scharf; ein grosser Bildschirm mit doppelter Dichte (1920 × 1080:
 * 8.3 Mio.) wird auf diese Zahl zurückgenommen.
 */
export const PIXEL_HOECHSTENS = 5_000_000;

export function guete(stufe: number, g: Geraet): Guete {
  const dpr = g.dpr > 0 ? g.dpr : 1;
  // Unter die einfache Dichte geht es nie: darunter wird die Schrift der Karte unleserlich.
  const boden = Math.min(dpr, 1);
  const flaeche = Math.max(1, g.breite * g.hoehe);
  // Höchstens doppelt (iPhone: Faktor 3): mehr kostet Akku, ohne dass man es sieht.
  const voll = Math.max(boden, Math.min(dpr, 2, Math.sqrt(PIXEL_HOECHSTENS / flaeche)));
  const dichte = (s: number) => (s >= 3 ? boden : s === 2 ? Math.max(boden, voll * 0.75) : voll);
  let pixel = voll;
  let glaettung: Guete['glaettung'] = voll >= 2 ? 1 : voll >= 1.5 ? 2 : 4;
  for (let s = 1; s <= Math.min(stufe, LETZTE_STUFE); s++) {
    const vorher = pixel * pixel * glaettung;
    pixel = dichte(s);
    let wunsch: Guete['glaettung'] = s >= LETZTE_STUFE || pixel >= 1.5 ? 1 : 2;
    // Eine Stufe darf nie mehr zeichnen als die davor (weniger Dichte, dafür Glättung: nur, wenn es unter dem Strich weniger ist).
    if (pixel * pixel * wunsch > vorher) wunsch = 1;
    glaettung = wunsch;
  }
  // Sonne und Schatten machen die Höhen lesbar; auf dem Handy kosten sie zu viel Akku.
  return { pixel, glaettung, schatten: g.gross && stufe <= 0 };
}

/** Die nächste Stufe, die an diesem Gerät wirklich etwas spart -- oder dieselbe, wenn es keine mehr gibt. */
export function sparsamer(stufe: number, g: Geraet): number {
  const jetzt = guete(stufe, g);
  for (let s = stufe + 1; s <= LETZTE_STUFE; s++) {
    const n = guete(s, g);
    if (n.pixel !== jetzt.pixel || n.glaettung !== jetzt.glaettung || n.schatten !== jetzt.schatten) return s;
  }
  return stufe;
}

/**
 * Merkt, ob die Karte zu langsam zeichnet. Jedes gezeichnete Bild meldet,
 * wie lange es vom Beginn bis zum nächsten Takt des Browsers gedauert hat
 * (flüssig: 17 ms). Liegt die Hälfte der letzten Bilder über der Grenze,
 * soll die Karte eine Stufe sparsamer werden.
 *
 * Der Anlauf zählt nicht: beim Start übersetzt der Browser die
 * Zeichenprogramme, mit jeder neuen Art von Kachel eines mehr, und auch
 * ein schnelles Gerät braucht dafür einzelne Bilder von mehreren
 * Zehntelsekunden. Ein solches Gerät soll deswegen nicht die Schatten
 * verlieren. Nach einem Wechsel der Stufe ist der Anlauf kurz, damit ein
 * langsames Gerät nicht lange wartet.
 */
export class Taktmesser {
  private bilder: number[] = [];
  private uebersprungen = 0;
  private seit: number | null = null;
  private gestartet = false;
  constructor(
    private readonly grenzeMs = 50,
    /** Anlauf beim Start und danach: so viele Bilder UND so viele Millisekunden. */
    private readonly anlauf: [number, number] = [6, 2500],
    private readonly anlaufDanach: [number, number] = [3, 500],
    private readonly fenster = 12,
    private readonly mindestens = 6,
  ) {}

  /**
   * Ein Bild ist gezeichnet: wie lange es gedauert hat und wann (beides in
   * Millisekunden). Antwortet true, wenn die Karte sparsamer werden soll;
   * danach beginnt die Messung neu.
   */
  bild(dauerMs: number, jetztMs: number): boolean {
    if (!(dauerMs >= 0)) return false;
    this.seit ??= jetztMs;
    const [bilder, ms] = this.gestartet ? this.anlaufDanach : this.anlauf;
    if (this.uebersprungen < bilder || jetztMs - this.seit < ms) { this.uebersprungen++; return false; }
    this.bilder.push(dauerMs);
    if (this.bilder.length > this.fenster) this.bilder.shift();
    // Drei Bilder hintereinander über einer Drittelsekunde: da braucht es keine weiteren.
    const sehrLangsam = this.bilder.length >= 3 && this.bilder.slice(-3).every(d => d > 330);
    if (!sehrLangsam) {
      if (this.bilder.length < this.mindestens) return false;
      const sortiert = [...this.bilder].sort((a, b) => a - b);
      if (sortiert[sortiert.length >> 1] <= this.grenzeMs) return false;
    }
    this.neu();
    return true;
  }

  /** Nach einer Pause (Reiter im Hintergrund) oder einem Wechsel der Stufe. */
  neu() { this.bilder = []; this.uebersprungen = 0; this.seit = null; this.gestartet = true; }
}

// ------------------------------------------------------------ Gedächtnis
const SCHLUESSEL = 'karte3d-stufe';
/**
 * Nach einem Tag versucht es die Karte wieder mit der schönsten Stufe: ein
 * Gerät kann einmal nur beschäftigt gewesen sein. Ein wirklich langsames
 * braucht dafür einmal am Tag ein paar Sekunden.
 */
const GILT_MS = 24 * 3600 * 1000;
type Speicher = Pick<Storage, 'getItem' | 'setItem'>;
const lokal = (): Speicher | null => { try { return window.localStorage; } catch { return null; } };

/** Die Stufe vom letzten Besuch auf diesem Gerät, sonst 0. */
export function stufeLesen(jetzt = Date.now(), speicher: Speicher | null = lokal()): number {
  try {
    const roh = JSON.parse(speicher?.getItem(SCHLUESSEL) ?? 'null') as { stufe?: unknown; am?: unknown } | null;
    const stufe = Number(roh?.stufe), am = Number(roh?.am);
    if (!Number.isInteger(stufe) || stufe < 0 || stufe > LETZTE_STUFE) return 0;
    if (!(am > 0) || jetzt - am > GILT_MS || am > jetzt) return 0;
    return stufe;
  } catch { return 0; }
}
export function stufeMerken(stufe: number, jetzt = Date.now(), speicher: Speicher | null = lokal()): void {
  // Privates Fenster oder gesperrter Speicher: dann beginnt der nächste Besuch eben wieder oben.
  try { speicher?.setItem(SCHLUESSEL, JSON.stringify({ stufe, am: jetzt })); } catch { /* ohne Gedächtnis */ }
}

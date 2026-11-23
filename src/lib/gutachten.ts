import type { VonHand } from '@/lib/calc';

/**
 * Was ein Markt- und Mietwertgutachten über eine Liegenschaft sagt, aus
 * seinem Text gelesen (23. November, Julian zu einem Gutachten:
 * «Bitte in CALC einpflegen. Wenn wir Daten haben wie hier ... bitte
 * hochladen bzw. extrahieren»).
 *
 * Gelesen wird nur, was als Zahl mit Bezeichnung dasteht; was fehlt,
 * bleibt leer, geraten wird nichts. Namen von Eigentümern und
 * Auftraggebern liest der Leser gar nicht erst: sie gehören nicht in CALC.
 */
export interface Gutachten {
  /** Dateiname, damit man weiss, woher die Zahlen stammen. */
  datei: string;
  /** JJJJ-MM-TT */
  stichtag: string | null;
  marktwert: number | null;
  ertragswert: number | null;
  katNr: string | null;
  /** Grundstücksfläche, m². */
  grundstueck: number | null;
  zone: string | null;
  baujahr: number | null;
  /** Gebäudevolumen (GVA), m³. */
  volumen: number | null;
  assekNeuwert: number | null;
  /** Nutzfläche (vermietbar), m². */
  nutzflaeche: number | null;
  /** Mietzins, den der Mieter heute zahlt, CHF im Jahr. */
  mietzinsJahr: number | null;
  /** Mietwert (neuwertig, für den Ertragswert), CHF im Jahr. */
  mietwertJahr: number | null;
  /** Mietwert im heutigen Zustand, CHF im Monat. */
  mietwertMonat: number | null;
  /** Kapitalisierungssatz, Prozent. */
  kapSatz: number | null;
  experte: string | null;
}

const MONATE = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

/** «2'150'000», «2’150’000.–», «2 150 000» als Zahl; sonst null. */
export function betrag(t: string | undefined | null): number | null {
  if (!t) return null;
  const s = t.replace(/[’'\s\u00a0\u202f]/g, '').replace(/\.[-–]$/, '').replace(/\.-?$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** «3. März 2025» oder «03.03.2025» als 2025-03-03. */
export function datumIso(t: string | undefined | null): string | null {
  if (!t) return null;
  const zahl = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  const wort = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})/.exec(t);
  const [tag, monat, jahr] = zahl ? [zahl[1], Number(zahl[2]), zahl[3]] : wort ? [wort[1], MONATE.indexOf(wort[2].toLowerCase()) + 1, wort[3]] : [];
  if (!tag || !monat || monat < 1 || monat > 12) return null;
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

const ZAHL = String.raw`(-?\d[\d'’ \u00a0]*(?:\.\d+)?)`;
const GELD = String.raw`(?:Fr\.|CHF|SFr\.)\s*${ZAHL}`;

/** Der erste (oder letzte) Treffer eines Musters je Zeile. */
function finden(zeilen: string[], muster: RegExp, letzter = false): RegExpExecArray | null {
  let treffer: RegExpExecArray | null = null;
  for (const z of zeilen) {
    const m = muster.exec(z.trim());
    if (m) { treffer = m; if (!letzter) break; }
  }
  return treffer;
}

export function gutachtenLesen(text: string, datei = 'Gutachten.pdf'): Gutachten {
  const zeilen = text.split(/\r?\n/).map(z => z.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const g = (muster: RegExp, letzter = false, gruppe = 1) => finden(zeilen, muster, letzter)?.[gruppe] ?? null;

  // Der Marktwert steht vorne als Ergebnis und hinten nach der Rundung; zählen soll der gerundete, also der letzte.
  const marktwert = betrag(g(new RegExp(String.raw`^(?:Marktwert|Verkehrswert)\b[^\d]*?${GELD}\s*$`, 'i'), true));
  const ertragswert = betrag(g(new RegExp(String.raw`^Ertragswert(?:\s*-\s*Neuwert)?\s+(?:Fr\.\s*|CHF\s*)?${ZAHL}\s*$`, 'i'), true));
  const nutz = g(/Nutzfläche(?:\s*NF)?\s*=?\s*(?:ca\.\s*)?(\d[\d'’ ]*(?:\.\d+)?)\s*m²/i);
  const kombi = finden(zeilen, new RegExp(String.raw`^Mietzins p\.\s?a\.,\s*Mietwert p\.\s?a\..*?${GELD}\s+${GELD}`, 'i'));
  const mietwertJahr = betrag(kombi?.[2]) ?? betrag(g(new RegExp(String.raw`^Mietwert p\.\s?a\.\s+(?:Fr\.\s*)?${ZAHL}\s*$`, 'i')));
  const kap = g(/^Kapitalisierungssatz(?:\s+Ertragsteil)?\s+(\d+(?:\.\d+)?)\s*%/i, true);
  const baujahr = g(/^Baujahr\s+(\d{4})\b/i);

  return {
    datei,
    stichtag: datumIso(g(/^(?:Stichtag|Bewertungsstichtag)\s+(.+)$/i)),
    marktwert,
    ertragswert,
    katNr: g(/^Kataster-?\s?Nr\.?\s+([A-Z]{0,4}\s?\d[\w./-]*)/i),
    grundstueck: betrag(g(/^(?:Fläche m²|Grundstücksfläche|Grundstückfläche)\s+(?:m²\s+)?(\d[\d'’ ]*)\s*(?:m²)?$/i)),
    zone: g(/^(?:Zonen- und Bauvorschriften|Zone|Bauzone)\s+(.+)$/i),
    baujahr: baujahr ? Number(baujahr) : null,
    volumen: betrag(g(/^Umbauter Raum(?:\s+GVA|\s+SIA\s*\d*)?\s+(\d[\d'’ ]*)\s*m³/i)),
    assekNeuwert: betrag(g(new RegExp(String.raw`^Assek\.?-?\s?Neuwert\s+${GELD}`, 'i'))),
    nutzflaeche: nutz ? betrag(nutz) : null,
    mietzinsJahr: betrag(kombi?.[1]),
    mietwertJahr,
    mietwertMonat: betrag(g(new RegExp(String.raw`^Mietwert bei Fremdvermietung\s+${GELD}`, 'i'))),
    kapSatz: kap ? Number(kap) : null,
    experte: g(/^Experte\s+(.+)$/i),
  };
}

/** Wie viele Angaben gelesen wurden: ohne Marktwert und ohne Zahl ist es kein brauchbares Gutachten. */
export function gutachtenBrauchbar(g: Gutachten): boolean {
  return g.marktwert != null || g.mietwertJahr != null || g.nutzflaeche != null;
}

/**
 * Was davon in die Rechnung geht, wo noch nichts von Hand steht: die
 * vermietbare Fläche und der Mietertrag von heute (der gezahlte Mietzins,
 * sonst der Mietwert im heutigen Zustand). Den Marktwert rechnet CALC
 * nicht um, er steht als Vergleich neben der Empfehlung: Julians Formel bleibt.
 */
export function gutachtenHand(g: Gutachten, hand: VonHand): Partial<VonHand> {
  const ertrag = g.mietzinsJahr ?? (g.mietwertMonat != null ? g.mietwertMonat * 12 : null);
  return {
    ...(hand.wohnflaeche == null && g.nutzflaeche != null ? { wohnflaeche: g.nutzflaeche } : {}),
    ...(hand.mietertragJahr == null && ertrag != null ? { mietertragJahr: Math.round(ertrag) } : {}),
  };
}

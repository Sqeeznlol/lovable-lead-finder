/**
 * Was ein ÖREB-Auszug über ein Grundstück sagt (23. November, Julian zum
 * Auszug eines Grundstücks in Langnau am Albis: «das auch einpflegen»).
 *
 * Der Auszug ist schweizweit gleich aufgebaut: vorne Grundstück, E-GRID,
 * Gemeinde und Fläche, dann die Themen, die das Grundstück betreffen, und
 * je Thema eine Tafel «Typ, Anteil, Anteil in %», rechtskräftig oder als
 * Änderung mit Vorwirkung. Gelesen wird nur, was dort mit Zahl steht; die
 * Rechnung ändert sich nicht, die Einschränkungen stehen bei der Kalkulation.
 */
export interface OerebEintrag {
  /** Wie der Auszug den Typ nennt, z. B. «Die Zone W/2.5 ist für Wohnbauten ... (W/2.5)». */
  typ: string;
  /** Kürzel in Klammern am Ende, z. B. «W/2.5»; sonst null. */
  kuerzel: string | null;
  wert: number;
  einheit: 'm²' | 'm';
  /** Anteil am Grundstück in Prozent; Linien haben keinen. */
  anteil: number | null;
}

export interface OerebThema {
  thema: string;
  /** Rechtskräftig, oder eine Änderung mit oder ohne Vorwirkung. */
  stand: string;
  eintraege: OerebEintrag[];
}

export interface Oereb {
  datei: string;
  grundstueckNr: string | null;
  egrid: string | null;
  gemeinde: string | null;
  flaeche: number | null;
  /** Datum des Auszugs, JJJJ-MM-TT. */
  datum: string | null;
  themen: OerebThema[];
}

export const istOereb = (text: string) => /ÖREB-Kataster|öffentlich-\s*rechtlichen Eigentumsbeschränkungen/i.test(text);

const zahl = (t: string) => Number(t.replace(/['’\s]/g, ''));
const STAND = /^(Rechtskräftig|Änderung mit Vorwirkung|Änderung ohne Vorwirkung)$/;
const FUSS = /Seite \d+\/\d+$/;
// «… 1294 m² 91 %», «… 59 m», «… 2719 m² * 191 % *»
const WERT = /^(.*?)\s*(\d[\d'’]*)\s*(m²|m)(?:\s*\*)?(?:\s+(\d+(?:\.\d+)?)\s*%)?(?:\s*\*)?$/;

export function oerebLesen(text: string, datei = 'ÖREB-Auszug.pdf'): Oereb {
  const z = text.split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const feld = (re: RegExp) => { for (const s of z) { const m = re.exec(s); if (m) return m[1].trim(); } return null; };
  const datum = feld(/^Erstellungsdatum des Auszugs (\d{2}\.\d{2}\.\d{4})/);

  const themen: OerebThema[] = [];
  for (let i = 0; i < z.length; i++) {
    if (!STAND.test(z[i])) continue;
    // Der Name des Themas steht über dem Stand, seit dem Seitenfuss; lange Namen brechen um.
    let a = i - 1;
    while (a > 0 && !FUSS.test(z[a - 1]) && i - a < 3) a--;
    const thema = z.slice(a, i).join(' ').replace(/\s+/g, ' ');
    const eintraege: OerebEintrag[] = [];
    let j = i + 1;
    while (j < z.length && !/^Legende beteiligter Objekte/.test(z[j]) && !STAND.test(z[j]) && !FUSS.test(z[j])) j++;
    for (; j < z.length; j++) {
      const s = z[j].replace(/^Legende beteiligter Objekte\s*/, '');
      if (/^(Übrige Legende|Rechtsvorschriften|Gesetzliche Grundlagen|Weitere Informationen|Zuständige Stelle)/.test(s) || FUSS.test(s) || STAND.test(s)) break;
      if (/^Typ Anteil/.test(s)) continue;
      const m = WERT.exec(s);
      if (m) eintraege.push({ typ: m[1].trim(), kuerzel: null, wert: zahl(m[2]), einheit: m[3] as 'm²' | 'm', anteil: m[4] != null ? Number(m[4]) : null });
      else if (eintraege.length) eintraege[eintraege.length - 1].typ += ` ${s}`;
    }
    for (const e of eintraege) {
      e.typ = e.typ.replace(/\s*\(\)\s*$/, '').trim();
      // Ein Zonenkürzel beginnt gross und ist kurz («W/2.5», «Oe»); «(nein)» oder «(in Kraft)» sind keines.
      const k = /\(([^()]+)\)\s*$/.exec(e.typ)?.[1] ?? null;
      e.kuerzel = k && /^[A-ZÄÖÜ][A-Za-z0-9/.-]{0,9}$/.test(k) ? k : null;
    }
    if (eintraege.length) themen.push({ thema, stand: z[i], eintraege });
  }

  const flaeche = feld(/^Fläche (\d[\d'’]*) m²$/);
  return {
    datei,
    grundstueckNr: feld(/^Grundstück-Nr\.? (\S+)/),
    egrid: feld(/^E-GRID (CH\d{12})/),
    gemeinde: feld(/^Gemeinde(?: \(BFS-Nr\.\))? (.+?)(?: \(\d+\))?$/),
    flaeche: flaeche ? zahl(flaeche) : null,
    datum: datum ? datum.split('.').reverse().join('-') : null,
    themen,
  };
}

/** Kurz für die Tafel: das Kürzel, wo es eines gibt, sonst der Typ bis zum ersten Satzende. */
export function eintragKurz(e: OerebEintrag): string {
  if (e.kuerzel) return e.kuerzel;
  const t = e.typ.replace(/\s*\([^()]*\)\s*$/, '');
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

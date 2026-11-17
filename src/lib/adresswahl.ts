/**
 * Welche der Adressen, die der Bund zu einer Eingabe vorschlägt, gemeint
 * ist. Eigene Datei ohne Abhängigkeiten, damit der Ablauf "Auswerten ->
 * import" genau diese Regel gegen echte Antworten prüfen kann.
 *
 * Gemessen am 1. November: "Gerlisberg 7, Kloten" liefert drei
 * Vorschläge, der erste ist richtig. Die alte Regel ("mehrere Vorschläge
 * und keine PLZ heisst mehrdeutig") hätte nachgefragt, wo es nichts zu
 * fragen gibt. Jetzt zählt, welche Vorschläge alle Wörter der Eingabe
 * enthalten: genau einer -- der ist es.
 */
const norm = (s: string) => s.toLowerCase()
  .replace(/<[^>]+>/g, ' ')
  .replace(/str\.(?=\s|,|$)/g, 'strasse')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  // "7.1" ist ein Nebeneingang und nicht die 7: der Punkt zwischen
  // Ziffern bleibt, sonst passt "Gerlisberg 7" auch auf "7.1" -- so
  // gemessen am 1. November, drei Fälle in Kloten.
  .replace(/[^a-z0-9.]+/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();

export type Wahl = { index: number } | { mehrdeutig: string[] } | { keine: true };

export function adresseWaehlen(eingabe: string, labels: string[]): Wahl {
  if (!labels.length) return { keine: true };
  const sauber = labels.map(l => l.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  if (new Set(sauber).size === 1) return { index: 0 };
  const woerter = norm(eingabe).split(' ').filter(Boolean);
  const passend = sauber.map((l, i) => ({ i, n: ` ${norm(l)} ` }))
    .filter(x => woerter.every(w => x.n.includes(` ${w} `)));
  if (passend.length === 1) return { index: passend[0].i };
  // Mit Postleitzahl ist die Eingabe so genau, wie sie sein kann: der
  // Bund ordnet den besten Treffer zuerst.
  if (/\b\d{4}\b/.test(eingabe) && passend.length > 1) return { index: passend[0].i };
  return { mehrdeutig: [...new Set(sauber)] };
}

/**
 * Was der Suchdienst des Bundes besser versteht. «Dietlikerstrasse 55 in
 * Kloten» und «Dietlikerstrasse 55, Kloten» fanden am 17. November die
 * Lindenstrasse 55, Weinbergstrasse 55 und Steinackerstrasse 55 in Kloten:
 * gibt es die Nummer nicht, verdrängen «in» und Komma die Strasse. Ohne
 * sie kommt die Dietlikerstrasse. Wo es die Nummer gibt, ändern sie nichts
 * (Gerlisberg 7, Haldenstrasse 30, Dufourstrasse 90 nachgesehen).
 */
export function suchtext(eingabe: string): string {
  return eingabe.replace(/,/g, ' ').replace(/(\d[a-z]?)\s+(?:in|bei)\s+/gi, '$1 ').replace(/\s+/g, ' ').trim();
}

/** Strasse und Hausnummer aus der Eingabe: «Dietlikerstrasse 55, Kloten» → Dietlikerstrasse, 55. */
export function hausnummerLesen(eingabe: string): { strasse: string; nummer: string; rest: string } | null {
  const m = suchtext(eingabe.replace(/,/g, ' ')).match(/^(.*?[A-Za-zÄÖÜäöüÉÈÀéèàâç.])\s+(\d+[a-zA-Z]?(?:\.\d+)?)(?:\s+(.*))?$/);
  return m ? { strasse: m[1], nummer: m[2], rest: m[3] ?? '' } : null;
}

const ganz = (s: string) => Number(s.match(/^\d+/)?.[0] ?? NaN);

/**
 * Gibt es die gesuchte Hausnummer an dieser Strasse? Unter den Vorschlägen
 * des Bundes stehen andere Nummern derselben Strasse, aber nicht die
 * gesuchte: dann die Indizes der nächsten (höchstens drei, die nächste
 * zuerst). Sonst null -- auch, wenn die Strasse gar nicht vorkommt.
 *
 * Gemessen am 17. November: «Dietlikerstrasse 55 Kloten» gibt es weder in
 * der Adresssuche noch im Gebäuderegister des Bundes; daneben stehen 54,
 * 56 und 57.
 */
export function nummerFehlt(eingabe: string, labels: string[]): { strasse: string; nummer: string; naechste: number[] } | null {
  const h = hausnummerLesen(eingabe);
  if (!h) return null;
  const strasse = norm(h.strasse), nummer = norm(h.nummer);
  const gleiche = labels.map((l, i) => {
    const n = norm(l);
    return n.startsWith(`${strasse} `) ? { i, nr: n.slice(strasse.length + 1).split(' ')[0] } : null;
  }).filter((x): x is { i: number; nr: string } => !!x);
  if (!gleiche.length || gleiche.some(x => x.nr === nummer)) return null;
  const ziel = ganz(h.nummer);
  const naechste = gleiche
    .filter(x => Number.isFinite(ganz(x.nr)))
    .sort((a, b) => Math.abs(ganz(a.nr) - ziel) - Math.abs(ganz(b.nr) - ziel) || ganz(a.nr) - ganz(b.nr) || a.nr.localeCompare(b.nr))
    .slice(0, 3).map(x => x.i);
  return { strasse: h.strasse, nummer: h.nummer, naechste };
}

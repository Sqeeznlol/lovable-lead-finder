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

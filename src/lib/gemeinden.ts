/**
 * Gemeindenamen für die Auswahl zusammenführen.
 *
 * Im Bestand steht dieselbe Gemeinde teils in zwei Schreibweisen,
 * "Küsnacht (ZH)" (2'447 Parzellen) und "Küsnacht ZH" (611) -- gemessen
 * mit dem Ablauf Tempo am 3. November, 20 Gemeinden so. Die Auswahl soll
 * jede Gemeinde einmal zeigen; die Suche (gebaeude_suchen) findet beide
 * Schreibweisen.
 *
 * Regel: "X ZH" wird zu "X (ZH)", wenn es das gibt, sonst zu "X"
 * (Pfäffikon, Dänikon ...). "(TG)" bleibt für sich -- Rickenbach (TG)
 * ist eine andere Gemeinde als Rickenbach (ZH).
 */
export function gemeindeKanon(name: string, alle: ReadonlySet<string>): string {
  const m = name.match(/^(.*\S)\s+ZH$/);
  if (!m) return name;
  return alle.has(`${m[1]} (ZH)`) ? `${m[1]} (ZH)` : m[1];
}

/** Jeder Name einmal, in der Schreibweise von gemeindeKanon. */
export function gemeindenEinmal(namen: readonly string[]): string[] {
  const alle = new Set(namen);
  return [...new Set(namen.map(n => gemeindeKanon(n, alle)))].sort((a, b) => a.localeCompare(b, 'de-CH'));
}

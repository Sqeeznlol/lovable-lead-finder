/**
 * Zeitplan des Ladebilds. Die Uhr läuft nur weiter, wenn die Daten für den
 * nächsten Schritt da sind: ohne Parzelle keine Grenze, ohne Gebäude kein
 * Haus. Fehlt etwas zu lange, geht es ohne diesen Teil weiter, damit
 * niemand vor einem stehenden Bild wartet.
 */
export const Z = { zug: [250, 1350], fuell: [1100, 1700], kipp: [1450, 2900], welle: 1750, baulinie: [2950, 3900], haus: 3900, geschoss: 520 } as const;
export const fertigBei = (geschosse: number) => Z.haus + Math.min(geschosse, 6) * Z.geschoss + 700;

export interface Tor { bei: number; offen: () => boolean; hoechstens: number }

/** Neue Uhrzeit nach dt Millisekunden. Ein Tor hält die Uhr an, bis es offen ist oder lange genug gewartet wurde. */
export function weiter(uhr: number, dt: number, tore: Tor[], gewartet: Map<number, number>, passiert: Set<number>): number {
  for (const t of tore) {
    if (passiert.has(t.bei) || uhr + dt < t.bei) continue;
    const w = gewartet.get(t.bei) ?? 0;
    if (t.offen() || w >= t.hoechstens) { passiert.add(t.bei); continue; }
    gewartet.set(t.bei, w + dt);
    return Math.max(uhr, t.bei);
  }
  return uhr + dt;
}

export const SAETZE: [number, string][] = [
  [0, 'Parzelle wird gesucht …'], [Z.kipp[0], 'Bauzone wird geprüft …'], [Z.baulinie[0], 'Baulinien werden gelesen …'],
  [Z.haus, 'Gebäuderegister wird gelesen …'],
];

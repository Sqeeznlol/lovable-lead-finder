import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Nach einer Auslieferung heissen die Programmteile anders (der Name
 * hängt am Inhalt). Wer die Seite vorher geöffnet hat, verlangt beim
 * nächsten Bereich noch den alten Namen -- und bekam "'text/html' is
 * not a valid JavaScript MIME type" (Julian, iPhone, 1. November).
 *
 * Dann hilft genau eines: die Seite einmal neu laden, damit die neue
 * index.html mit den neuen Namen kommt. Höchstens einmal je Minute,
 * sonst lädt eine wirklich kaputte Fassung endlos neu.
 */
const SCHLUESSEL = 'bauraum.neugeladen';

export function istFehlendeFassung(meldung: string): boolean {
  return /dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|Failed to fetch dynamically|ChunkLoadError|Loading chunk .* failed|error loading dynamically imported module/i.test(meldung);
}

/** Lädt neu, wenn das in der letzten Minute nicht schon geschah. Gibt zurück, ob neu geladen wird. */
export function neuLadenEinmal(jetzt = Date.now()): boolean {
  let zuletzt = 0;
  try { zuletzt = Number(sessionStorage.getItem(SCHLUESSEL) || '0'); } catch { /* ohne Speicher trotzdem einmal */ }
  if (jetzt - zuletzt < 60_000) return false;
  try { sessionStorage.setItem(SCHLUESSEL, String(jetzt)); } catch { /* egal */ }
  window.location.reload();
  return true;
}

/**
 * Ein Bereich, der erst mit seinem Reiter geladen wird.
 *
 * Lädt main.tsx wegen eines fehlenden Programmteils neu, hält es Vite mit
 * `preventDefault` vom Fehler ab -- und Vite lässt den Import dann mit
 * `undefined` enden. React las daraus `.default` und zeigte «Fehler im
 * Bereich Die Seite», bevor das Neuladen griff («Reiter prüfen»,
 * 17. November, Admin-Reiter mitten in einer Auslieferung). Darum wartet
 * ein Bereich in diesem Fall mit seiner Ladeanzeige, bis die Seite neu
 * geladen ist. Kommt das Neuladen nicht, meldet er nach 15 Sekunden die
 * fehlende Fassung, und der Auffang bietet «Nochmals versuchen» an.
 */
export function nachladen<K extends string, M extends { [P in K]: ComponentType<never> }>(
  laden: () => Promise<M>, name: K, frist = 15_000,
): LazyExoticComponent<M[K]> {
  return lazy(async () => {
    const m = await laden();
    if (m) return { default: m[name] };
    return new Promise<never>((_, nein) => setTimeout(
      () => nein(new Error('Failed to fetch dynamically imported module: die Seite wurde nicht neu geladen')), frist));
  });
}

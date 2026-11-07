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

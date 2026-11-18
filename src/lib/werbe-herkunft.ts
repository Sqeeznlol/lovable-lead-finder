/**
 * Woher ein Besuch kommt, festgehalten beim ersten Aufruf der Sitzung.
 *
 * Bis zum 18. November las der Lead seine Herkunft aus dem Link. Die
 * Check-Seite schreibt den Link aber um, sobald eine Adresse gewählt ist
 * (damit Teilen und Neu laden dieselbe Parzelle zeigen), und dabei
 * verschwanden gclid und utm_*: ein Lead aus einer Anzeige kam ohne
 * Herkunft an, und Google konnte ihn keinem Klick zuordnen.
 *
 * Gespeichert wird im Speicher des Tabs (sessionStorage), nicht in einem
 * Cookie; er verfällt mit dem Tab. Die Zahlen sind keine Personendaten,
 * nur Kennungen der Anzeige.
 */
export const FELDER = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid'] as const;
/** Die Kennungen eines Anzeigenklicks bei Google. */
export const KLICK = ['gclid', 'gbraid', 'wbraid'] as const;
const SCHLUESSEL = 'pc-herkunft';

/** Die Werbeangaben aus einem Link, gekürzt. */
export function herkunftAus(suche: string): Record<string, string> {
  const u = new URLSearchParams(suche);
  const aus: Record<string, string> = {};
  for (const k of FELDER) {
    const v = u.get(k);
    if (v) aus[k] = v.slice(0, 200);
  }
  return aus;
}

function gemerkt(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(SCHLUESSEL) || '{}') as Record<string, string>; } catch { return {}; }
}

/**
 * Beim Start aufrufen, bevor die Seite ihren Link umschreibt. Der erste
 * Aufruf mit Werbeangaben gilt; ein späterer Link ohne sie löscht nichts.
 */
export function merkeHerkunft(suche = typeof window === 'undefined' ? '' : window.location.search): void {
  const neu = herkunftAus(suche);
  if (!Object.keys(neu).length || Object.keys(gemerkt()).length) return;
  try { sessionStorage.setItem(SCHLUESSEL, JSON.stringify(neu)); } catch { /* privates Fenster: dann nur, was im Link steht */ }
}

/** Was zum Lead gehört: das Gemerkte, ergänzt um den Link von jetzt. */
export function sitzungsHerkunft(suche = typeof window === 'undefined' ? '' : window.location.search): Record<string, string> {
  return { ...herkunftAus(suche), ...gemerkt() };
}

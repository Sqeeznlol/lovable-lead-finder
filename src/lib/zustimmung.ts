// Die Wahl im Cookie-Hinweis der Check-Seiten.
//
// Heute setzen die Seiten keine Cookies: gezählt wird anonym im Speicher
// des Tabs (check-zaehlen.ts). Werbemessung (Meta-Pixel, Google Ads) darf
// erst laden, wenn darfWerben() wahr ist. Nach einem Jahr wird neu gefragt,
// damit eine alte Zustimmung nicht für neue Messpunkte gilt.
export type Wahl = 'alle' | 'noetig';
const SCHLUESSEL = 'pc-zustimmung';
const GUELTIG_TAGE = 365;
export const EREIGNIS = 'pc-zustimmung';

export function zustimmung(jetzt = Date.now()): Wahl | null {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null') as { wahl?: string; am?: number } | null;
    if (!roh || (roh.wahl !== 'alle' && roh.wahl !== 'noetig') || typeof roh.am !== 'number') return null;
    return jetzt - roh.am < GUELTIG_TAGE * 864e5 ? roh.wahl : null;
  } catch { return null; }
}

/** null löscht die Wahl, dann erscheint der Hinweis wieder. */
export function setzeZustimmung(wahl: Wahl | null, jetzt = Date.now()): void {
  try {
    if (wahl) localStorage.setItem(SCHLUESSEL, JSON.stringify({ wahl, am: jetzt }));
    else localStorage.removeItem(SCHLUESSEL);
  } catch { /* privates Fenster: der Hinweis kommt beim nächsten Besuch wieder */ }
  window.dispatchEvent(new Event(EREIGNIS));
}

export const darfWerben = () => zustimmung() === 'alle';

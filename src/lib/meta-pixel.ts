/**
 * Meta-Pixel für die Facebook-Werbung (Tims Plan: Facebook zuerst).
 * Meta lernt daraus, wer Lead wird, und zeigt die Anzeige ähnlichen
 * Leuten; ohne Pixel optimiert die Werbung nur auf Klicks.
 *
 * Die Pixel-ID ist öffentlich (sie steht in jeder Seite, die das Pixel
 * nutzt) und kommt aus der Umgebungsvariable VITE_META_PIXEL_ID bei
 * Vercel. Ohne sie lädt nichts: keine Anfrage an Meta.
 *
 * Gesendet werden nur Ereignisse, keine Namen, Adressen oder Nummern.
 */
export const PIXEL_ID: string | undefined = import.meta.env.VITE_META_PIXEL_ID || undefined;

type Fbq = ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };

/** Standardereignisse von Meta, die zu unseren Schritten passen. */
export type PixelEreignis = 'PageView' | 'Search' | 'ViewContent' | 'InitiateCheckout' | 'Lead';

let geladen = false;

function laden(id: string): void {
  if (geladen || typeof window === 'undefined') return;
  geladen = true;
  // Der offizielle Einbau von Meta, ausgeschrieben: eine Warteschlange,
  // bis fbevents.js da ist; danach ruft fbq die Bibliothek direkt.
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (!w.fbq) {
    const f = function (...a: unknown[]) { if (f.callMethod) f.callMethod(...a); else f.queue.push(a); } as Fbq;
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    w.fbq = f; w._fbq = f;
    const s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  w.fbq!('init', id);
}

/** Ein Ereignis an Meta; ohne Pixel-ID tut es nichts. */
export function pixel(ereignis: PixelEreignis, daten?: Record<string, string | number>): void {
  if (!PIXEL_ID || typeof window === 'undefined') return;
  laden(PIXEL_ID);
  (window as unknown as { fbq: Fbq }).fbq('track', ereignis, daten ?? {});
}

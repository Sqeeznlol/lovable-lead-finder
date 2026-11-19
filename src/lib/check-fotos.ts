/**
 * Eigene Fotos der Check-Seiten, mit allem, was Google und ein Mensch über
 * ein Bild wissen sollen (Julian, 19. November: «Wir müssen Metadaten
 * verbessern bei den Fotos, weil wir wollen eigene Fotos benutzen»).
 *
 * Bis dahin standen auf der Bühne nur Luftbilder des Bundes, als
 * CSS-Hintergrund: Google sieht so ein Bild nicht, es hat keinen Text,
 * keinen Urheber und keine Grösse. Ein eigenes Foto steht als <img> mit
 * Alt-Text, Breite und Höhe auf der Seite, als ImageObject in den
 * strukturierten Daten (Urheber, Rechte, Ort) und als Vorschaubild beim
 * Teilen (og:image). In der Datei selbst stehen dieselben Angaben als
 * IPTC/XMP, und die Kameradaten samt GPS sind entfernt: ein Handyfoto
 * verrät sonst, wo und mit welchem Gerät es aufgenommen wurde.
 *
 * Eine Quelle für alles: check-fotos.json. Die Seite liest sie hier,
 * tools/fotos_vorbereiten.py liest sie für die Dateien. Wie ein Foto
 * dazukommt, steht in docs/fotos.md. Ohne "@/"-Pfade, weil seo-marken.ts
 * sie liest.
 */
import liste from './check-fotos.json';

export interface Foto {
  /** Dateiname ohne Endung, sprechend und klein: «einfamilienhaus-garten-meilen». */
  id: string;
  /** Was zu sehen ist, ein ganzer Satz, ohne «Bild von». */
  alt: string;
  /** Kurzer Titel, z. B. «Einfamilienhaus mit Garten in Meilen». */
  titel: string;
  gemeinde: string;
  kanton: string;
  /** Tag der Aufnahme, JJJJ-MM-TT. */
  aufgenommen: string;
  urheber: string;
  /** Grösse nach dem Vorbereiten (schreibt das Werkzeug). */
  breite: number;
  hoehe: number;
}

export const FOTOS: Foto[] = liste as Foto[];
export const FOTO_BREITEN = [800, 1600] as const;
export const fotoRechte = (f: Foto) => `© ${f.aufgenommen.slice(0, 4)} ${f.urheber}`;

export function fotoNachId(id: string | undefined | null): Foto | null {
  return id ? FOTOS.find(f => f.id === id) ?? null : null;
}

/** Die Dateien, die tools/fotos_vorbereiten.py schreibt. */
export const fotoDatei = (f: Foto, breite: (typeof FOTO_BREITEN)[number], art: 'webp' | 'avif') => `/fotos/${f.id}-${breite}.${art}`;
export const fotoTeilen = (f: Foto) => `/fotos/${f.id}-teilen.jpg`;
export const TEILEN_BREITE = 1200;
export const TEILEN_HOEHE = 630;

/** Was an einem Eintrag fehlt; leer heisst gut. Dieselben Regeln prüft das Werkzeug. */
export function fotoPruefen(f: Foto): string[] {
  const fehler: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(f.id)) fehler.push('id: klein, mit Bindestrichen, mindestens zwei Wörter');
  if (f.alt.trim().length < 25) fehler.push('alt: mindestens ein ganzer Satz');
  if (/^(bild|foto|image|photo)\b/i.test(f.alt.trim())) fehler.push('alt: nicht mit «Bild» oder «Foto» beginnen');
  if (!f.titel.trim()) fehler.push('titel fehlt');
  if (!f.gemeinde.trim() || !/^[A-Z]{2}$/.test(f.kanton)) fehler.push('Ort: Gemeinde und Kantonskürzel');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.aufgenommen)) fehler.push('aufgenommen: JJJJ-MM-TT');
  if (!f.urheber.trim()) fehler.push('urheber fehlt');
  if (!(f.breite > 0 && f.hoehe > 0)) fehler.push('Grösse fehlt: Werkzeug laufen lassen');
  return fehler;
}

/**
 * Das Bild als ImageObject (schema.org). Google zeigt Urheber, Bildnachweis
 * und Rechte in der Bildersuche, wenn sie hier und in der Datei stehen.
 */
export function bildObjekt(f: Foto, basis: string, rechteSeite: string): Record<string, unknown> {
  const url = `${basis}${fotoDatei(f, 1600, 'webp')}`;
  return {
    '@type': 'ImageObject', '@id': `${url}#bild`, url, contentUrl: url,
    name: f.titel, caption: f.alt, description: f.alt,
    width: Math.min(1600, f.breite), height: Math.round((Math.min(1600, f.breite) * f.hoehe) / f.breite),
    creator: { '@type': 'Organization', name: f.urheber },
    creditText: f.urheber, copyrightNotice: fotoRechte(f), copyrightHolder: { '@type': 'Organization', name: f.urheber },
    acquireLicensePage: rechteSeite,
    dateCreated: f.aufgenommen,
    contentLocation: { '@type': 'Place', name: `${f.gemeinde}, Kanton ${f.kanton}`, address: { '@type': 'PostalAddress', addressLocality: f.gemeinde, addressRegion: f.kanton, addressCountry: 'CH' } },
    inLanguage: 'de-CH',
  };
}

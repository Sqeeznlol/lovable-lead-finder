/**
 * Aus der Gestaltung einer Marke (check-marken.ts) die Variablen, die
 * Datenattribute und die Schriftadresse für Check- und Ratgeberseite.
 *
 * Bewusst ohne React: Was hier steht, lässt sich prüfen, ohne eine Seite
 * zu zeichnen (check-gestaltung.test.ts).
 */
import type { CSSProperties } from 'react';
import type { Marke } from '@/lib/check-marken';
import { luftbildLv95 } from '@/lib/luftbild';

// Ersatz, falls Google Fonts nicht lädt: die Seite bleibt lesbar.
const ERSATZ = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const ERSATZ_SERIFE = "Georgia, 'Times New Roman', serif";
const SERIFEN = new Set(['Newsreader', 'Fraunces', 'Lora', 'Source Serif 4']);

function familie(name: string): string {
  return `'${name}', ${SERIFEN.has(name) ? ERSATZ_SERIFE : ERSATZ}`;
}

/** Die eine Adresse bei Google Fonts für Grund- und Titelschrift. */
export function schriftAdresse(m: Marke): string {
  const namen = [...new Set([m.design.schrift, m.design.titelSchrift].filter((x): x is string => !!x))];
  const teile = namen.map(n => `family=${n.replace(/ /g, '+')}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${teile.join('&')}&display=swap`;
}

/** Luftbild der Bühne, wenn die Gestaltung eines verlangt. */
export function buehnenBild(m: Marke): string | null {
  const d = m.design;
  if (!d.ort || (d.buehne !== 'luftbild' && d.buehne !== 'geteilt')) return null;
  return luftbildLv95(d.ort[0], d.ort[1], 700, 1600);
}

export function markenStil(m: Marke): CSSProperties {
  const d = m.design;
  const v: Record<string, string> = {
    '--marke': m.farbe,
    '--marke-hell': m.hell,
    '--auf-marke': m.aufFarbe ?? '#FFFFFF',
    '--schrift': familie(d.schrift),
    '--titel-schrift': familie(d.titelSchrift ?? d.schrift),
    '--r': `${d.radius}px`,
    '--r-klein': `${Math.round(d.radius * 0.67)}px`,
  };
  // Der Grundton der dunklen Seiten kommt aus dem CSS ([data-dunkel]);
  // ein Wert hier ginge ihm vor und machte die Seite hell.
  if (d.papier && !d.dunkel) v['--papier'] = d.papier;
  const bild = buehnenBild(m);
  if (bild) v['--luftbild'] = `url("${bild}")`;
  return v as CSSProperties;
}

/** Die Datenattribute, an denen das CSS die Gestaltung erkennt. */
export function markenAttribute(m: Marke): Record<string, string | undefined> {
  const d = m.design;
  return {
    'data-buehne': d.buehne,
    'data-muster': d.muster,
    'data-zeichen': d.zeichen,
    'data-dunkel': d.dunkel ? '' : undefined,
    'data-gross': d.gross ? '' : undefined,
    'data-eckig': d.radius <= 2 ? '' : undefined,
  };
}

/** Grundton der Seite; derselbe Wert wie --papier im CSS. */
export function grundton(m: Marke): string {
  return m.design.dunkel ? '#0E1315' : (m.design.papier ?? '#FAF9F7');
}

/**
 * Safari auf dem iPhone: Leiste und Überscrollen in der Farbe der Marke
 * statt im Grau des CRM, und Zoomen mit zwei Fingern erlaubt. Das CRM
 * sperrt es in index.html; die Check-Seiten lesen ältere Eigentümer, die
 * vergrössern wollen. Alle Eingaben haben mindestens 16px, darum zoomt
 * Safari beim Antippen trotzdem nicht. Gibt die Rücknahme zurück.
 */
export function seiteEinrichten(m: Marke): () => void {
  schriftLaden(m);
  if (typeof document === 'undefined') return () => {};
  const ton = grundton(m);
  const html = document.documentElement;
  const vorher = { hg: html.style.backgroundColor, body: document.body.style.backgroundColor };
  html.style.backgroundColor = ton;
  document.body.style.backgroundColor = ton;
  const farben = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  const alteFarben = farben.map(f => f.content);
  farben.forEach(f => { f.content = ton; });
  const ansicht = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const alteAnsicht = ansicht?.content;
  if (ansicht) ansicht.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  return () => {
    html.style.backgroundColor = vorher.hg;
    document.body.style.backgroundColor = vorher.body;
    farben.forEach((f, i) => { f.content = alteFarben[i]; });
    if (ansicht && alteAnsicht !== undefined) ansicht.content = alteAnsicht;
  };
}

/** Lädt die Schriften der Marke einmal; mehrfaches Aufrufen schadet nicht. */
export function schriftLaden(m: Marke): void {
  if (typeof document === 'undefined') return;
  const adresse = schriftAdresse(m);
  const id = `pc-schrift-${m.id}`;
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet'; l.href = adresse;
  document.head.appendChild(l);
}

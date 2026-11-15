// Gemeinde-Seiten für Google (Julian, 14. November: "2 ist gut"): je
// Gemeinde eine Seite mit echten Zahlen aus unseren Daten, darunter der
// Check für die eigene Adresse. Die Zahlen schreibt der Ablauf "Gemeinden"
// im Repository der Webseite wöchentlich nach public/gemeinden.json.
//
// Bei Google zählt eine Domain, was-kann-ich-bauen.ch: 23 Domains mit
// denselben Gemeinde-Seiten wären Kopien (seo-marken.ts). Ohne
// Abhängigkeiten, weil der Bau (vite.config.ts) die Datei liest.

export interface GemeindeZahlen {
  bfs: number; name: string; kanton: string;
  /** Baugesuche seit `seit` (höchstens 365 Tage) und der letzten 90 Tage. */
  n365: number; n90: number;
  /** Ab wann gezählt wird: Zürich ein Jahr zurück, die übrigen Kantone ab unserem ersten Lauf. */
  seit: string;
  arten: { neubau: number; umbau: number; waermepumpe: number; solar: number; abbruch: number };
  /** Wohngebäude laut Register, heute nur Kanton Zürich. */
  wohnbauten: { n: number; vor1980: number; fossil: number } | null;
}
export interface Gemeinde extends GemeindeZahlen { slug: string; ort: string }

export const GEMEINDE_DOMAIN = 'was-kann-ich-bauen.ch';
export const GEMEINDE_HEIMAT = `https://www.${GEMEINDE_DOMAIN}`;

/** "Oberdorf (NW)" wird "Oberdorf": der Kanton steht ohnehin daneben. */
export const ortName = (name: string) => name.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim();

const glatt = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[éèê]/g, 'e')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Adressen der Seiten: "uster"; gibt es einen Ort zweimal, mit Kanton ("oberdorf-nw"). */
export function mitAdressen(liste: GemeindeZahlen[]): Gemeinde[] {
  const zahl = new Map<string, number>();
  for (const g of liste) zahl.set(glatt(ortName(g.name)), (zahl.get(glatt(ortName(g.name))) ?? 0) + 1);
  return liste.map(g => {
    const s = glatt(ortName(g.name));
    return { ...g, ort: ortName(g.name), slug: (zahl.get(s) ?? 0) > 1 ? `${s}-${g.kanton.toLowerCase()}` : s };
  });
}

const tsd = (n: number) => n.toLocaleString('de-CH');
const prozent = (teil: number, ganz: number) => `${Math.round((teil / ganz) * 100)} %`;

export const titel = (g: Gemeinde) => `Bauen in ${g.ort}: Bauzone, Ausnützung und Baugesuche`;

const datum = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
/** Ein ganzes Jahr nur, wo die Daten so weit zurückreichen. */
export const ganzesJahr = (g: GemeindeZahlen, heute = new Date()) => heute.getTime() - new Date(`${g.seit}T00:00:00Z`).getTime() > 360 * 864e5;
export const zeitraum = (g: GemeindeZahlen, heute = new Date()) => (ganzesJahr(g, heute) ? 'in 12 Monaten' : `seit ${datum(g.seit)}`);

/** Der Satz unter dem Titel, nur mit Zahlen, die wirklich da sind. */
export function satz(g: Gemeinde, heute = new Date()): string {
  const teile = [ganzesJahr(g, heute)
    ? `In ${g.ort} wurden in den letzten zwölf Monaten ${tsd(g.n365)} Baugesuche publiziert, ${tsd(g.n90)} davon in den letzten drei Monaten.`
    : `In ${g.ort} wurden seit dem ${datum(g.seit)} ${tsd(g.n365)} Baugesuche publiziert.`];
  if (g.wohnbauten && g.wohnbauten.n > 0) teile.push(`${prozent(g.wohnbauten.vor1980, g.wohnbauten.n)} der ${tsd(g.wohnbauten.n)} Wohngebäude sind vor 1980 gebaut.`);
  teile.push('Prüfen Sie, was auf Ihrem Grundstück möglich ist.');
  return teile.join(' ');
}

/** Die Kennzahlen der Seite. */
export function kennzahlen(g: Gemeinde, heute = new Date()): { titel: string; wert: string; zusatz: string }[] {
  const k = [
    { titel: 'Baugesuche', wert: tsd(g.n365), zusatz: zeitraum(g, heute) },
    { titel: 'Neubauten', wert: tsd(g.arten.neubau), zusatz: 'Gesuche mit Neubau' },
    { titel: 'Umbau, Anbau', wert: tsd(g.arten.umbau), zusatz: 'Gesuche mit Um- oder Anbau' },
    { titel: 'Wärmepumpen', wert: tsd(g.arten.waermepumpe), zusatz: 'Gesuche mit Wärmepumpe' },
    { titel: 'Solaranlagen', wert: tsd(g.arten.solar), zusatz: 'Gesuche mit Solaranlage' },
  ];
  if (g.wohnbauten && g.wohnbauten.n > 0) {
    k.push({ titel: 'Wohngebäude', wert: tsd(g.wohnbauten.n), zusatz: `${prozent(g.wohnbauten.vor1980, g.wohnbauten.n)} vor 1980 gebaut` });
    k.push({ titel: 'Öl und Gas', wert: prozent(g.wohnbauten.fossil, g.wohnbauten.n), zusatz: 'der Wohngebäude heizen fossil' });
  }
  return k;
}

export const QUELLE = 'Baugesuche aus den Amtsblättern der Kantone und dem Statistischen Amt Zürich; Wohngebäude aus dem Gebäude- und Wohnungsregister (BFS). Gezählt wird, was in der Beschreibung des Gesuchs steht.';

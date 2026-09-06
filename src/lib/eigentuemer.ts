/**
 * Eine Grundbuchauskunft lesen, wie sie im Portal steht.
 *
 * Solange die Extension nicht gebaut ist, wird der Block von Hand
 * kopiert. Das ist kein Rückschritt: der Wortlaut ist dieselbe Quelle,
 * die auch die Extension übernehmen würde -- nur dass ein Mensch
 * hinschaut, bevor etwas gespeichert wird.
 *
 * Erkannt wird eine Zeile als Eigentümer, wenn sie eine Postleitzahl
 * trägt. Das ist die einzige Eigenschaft, die alle Auskünfte teilen --
 * Zürich schreibt "Alleineigentum" dazu, der Thurgau nicht, und Firmen
 * tragen Rechtsformen, die wie Adressen aussehen.
 */
export interface Eigentuemer {
  name: string;
  address: string;
  plz: string;
  ort: string;
  ownershipType: string;
}

const ARTEN = [
  'alleineigentum', 'miteigentum', 'stockwerkeigentum', 'gesamteigentum',
];

/** Was zwischen Name und Adresse steht und keines von beidem ist. */
const FUELLER = [
  'schweiz', 'mit sitz in', 'aktiengesellschaft', 'gesellschaft mit',
  'genossenschaft', 'in liquidation',
];

/** Überschriften und Feldnamen -- keine Eigentümer. */
const KEINE_ZEILE =
  /^(Eigent(ü|ue)mer|Grundeigent|Parzelle|Grundst(ü|ue)ck|BFS|Gemeinde|Nummer|Grundbuch|E-?GRID|Fl(ä|ae)che|Notariat|Verwaltungseinheit|Anmerkung|Dienstbarkeit|Bemerkung)\b/i;

export function zerlegeZeile(roh: string): Eigentuemer {
  const teile = (roh || '').split(',').map(s => s.trim()).filter(Boolean);
  let name = teile[0] || '';
  let address = '';
  let plzOrt = '';
  let ownershipType = '';

  for (let i = 1; i < teile.length; i++) {
    const t = teile[i];
    const klein = t.toLowerCase();
    if (ARTEN.some(a => klein.includes(a))) { ownershipType = t; continue; }
    if (FUELLER.some(f => klein.startsWith(f) || klein === f)) continue;
    if (/^\d{4}\s+\S/.test(t)) { plzOrt = t; continue; }
    if (/\d/.test(t) && !address) { address = t; continue; }
  }

  // Der Anteil steht oft am Namen: "Meier Hans 1/2". Er gehört nicht
  // in den Namen, mit dem später telefoniert wird.
  name = name.replace(/\s+\d+\/\d+\s*$/, '').trim();

  const m = plzOrt.match(/^(\d{4})\s+(.+)$/);
  return {
    name,
    address,
    plz: m ? m[1] : '',
    ort: m ? m[2] : '',
    ownershipType,
  };
}

export function leseAuskunft(text: string): Eigentuemer[] {
  return (text || '')
    .split('\n')
    .map(z => z.trim())
    .filter(z => z.length > 8)
    .filter(z => !KEINE_ZEILE.test(z))
    .filter(z => /\d{4}\s+\S/.test(z))
    .map(zerlegeZeile)
    .filter(o => o.name);
}

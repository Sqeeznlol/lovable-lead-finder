import { supabase } from '@/integrations/supabase/client';

/**
 * Die Suche in Aurora: ein Satz wie «Alle W2 in Dietikon» wird zu einem
 * Filter, die Datenbank liefert die Liste (Funktion suche_parzellen,
 * Migration 20261116080000).
 *
 * Julian, 16. November: «ein Feld KI Suche, wo ich sagen kann: Alle W2
 * in Dietikon ... oder sonstiges Zeugs».
 *
 * Verstanden wird nach festen Regeln, nicht von einem Sprachmodell. Die
 * Fragen an den Bestand sind immer dieselben (Ort, Zone, Grösse,
 * Baujahr, Heizung, Potenzial, Schutz), und eine Regel antwortet
 * sofort, kostet nichts und rät nie. Was die Regeln nicht verstehen,
 * zeigt die Seite als «nicht verstanden» an, statt es stillschweigend
 * zu übergehen.
 *
 * Umlaute werden vor dem Verstehen umgeschrieben (ö → oe): `\b` in
 * JavaScript kennt nur a bis z, und «Öl» oder «über» fänden sonst nie
 * einen Wortanfang.
 */

export interface SucheFilter {
  gemeinden?: string[];
  plz?: string[];
  zone?: string;
  flaeche_min?: number; flaeche_max?: number;
  baujahr_min?: number; baujahr_max?: number;
  geschosse_min?: number; geschosse_max?: number;
  wohnungen_min?: number; wohnungen_max?: number;
  heizung?: number[];
  reserve_min?: number;
  art?: 'efh' | 'mfh';
  unbebaut?: boolean;
  eigentuemer?: 'bekannt' | 'unbekannt';
  denkmal?: 'mit' | 'ohne';
  sortierung?: 'potenzial' | 'flaeche' | 'baujahr' | 'adresse';
}

export interface Gemeinde { gemeinde: string; kanton: string; parzellen: number }

export interface Verstanden {
  filter: SucheFilter;
  /** Was erkannt wurde, je ein kurzer Satzteil für die Anzeige. */
  teile: string[];
  /** Die erkannten Orte, wie man sie schreibt (ohne «(ZH)»). */
  orte: string[];
  /** Wörter, mit denen die Regeln nichts anfangen konnten. */
  offen: string[];
  /** Ein Ort, der genannt, aber nicht im Bestand ist. */
  fremderOrt?: string;
}

// Energieträger nach dem Gebäuderegister (Merkmal GENH, Kodes am
// 16. November in gwr_kode nachgesehen).
export const HEIZUNG: Record<number, string> = {
  7500: 'keine', 7501: 'Wärmepumpe (Luft)', 7510: 'Erdwärme', 7511: 'Erdwärme', 7512: 'Erdwärme', 7513: 'Wärmepumpe (Wasser)',
  7520: 'Gas', 7530: 'Heizöl', 7540: 'Holz', 7541: 'Holz', 7542: 'Holz (Pellets)', 7543: 'Holz (Schnitzel)',
  7550: 'Abwärme', 7560: 'Strom', 7570: 'Sonne', 7580: 'Fernwärme', 7581: 'Fernwärme', 7582: 'Fernwärme',
  7598: 'unbestimmt', 7599: 'andere',
};

const HEIZ_WOERTER: [RegExp, number[], string][] = [
  [/\b(fossil\w*|oel\s*(oder|und|\/)\s*gas|gas\s*(oder|und|\/)\s*oel)\b/, [7520, 7530], 'Öl oder Gas'],
  [/\b(heiz)?oel(heizung\w*)?\b/, [7530], 'Heizöl'],
  [/\bgas(heizung\w*)?\b/, [7520], 'Gas'],
  [/\bwaermepumpe\w*/, [7501, 7510, 7511, 7512, 7513], 'Wärmepumpe'],
  [/\b(erdwaerme|erdsonde)\w*/, [7510, 7511, 7512], 'Erdwärme'],
  [/\bfernwaerme\w*/, [7580, 7581, 7582], 'Fernwärme'],
  [/\b(holz|pellet|schnitzel)\w*/, [7540, 7541, 7542, 7543], 'Holz'],
  [/\b(elektro\w*|strom)(heizung\w*)?\b/, [7560], 'Strom'],
];

const ZONE_TEXT: Record<string, string> = { W: 'Wohnzone', WG: 'Wohn- und Gewerbezone', K: 'Kernzone', Z: 'Zentrumszone', D: 'Dorfzone', LH: 'Landhauszone', Q: 'Quartiererhaltungszone' };

/** «W2» → «Wohnzone, 2 Geschosse»; für Überschriften und den Satz. */
export function zoneText(kurz: string): string {
  const m = /^([A-Z]+)(\d)?$/.exec(kurz);
  if (!m) return kurz;
  const art = ZONE_TEXT[m[1]] ?? m[1];
  return m[2] ? `${art}, ${m[2]} Geschosse` : art;
}

/** Klein und ohne Umlaute: so, wie die Regeln den Satz lesen. */
export function einfach(s: string): string {
  return s.toLocaleLowerCase('de-CH').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a');
}

// Wörter ohne eigene Bedeutung in einer Suche.
const FUELL = new Set(('alle alles zeige zeig mir mich bitte suche such finde finden gib liste von vom in im an am auf bei mit und oder ' +
  'der die das den dem des ein eine einen einem einer parzellen parzelle objekte objekt liegenschaften liegenschaft grundstuecke ' +
  'grundstueck haeuser haus gebaeude zone zonen gemeinde gemeinden kanton kt ort orten welche wo gibt es sind ist hat haben nur ' +
  'm2 m² qm quadratmeter jahr jahre baujahr gebaut erstellt stockwerk stockwerke stock geschoss geschosse geschossen etagen ' +
  'wohnung wohnungen sortiert sortieren nach zuerst zh tg').split(' '));

const zahl = (s: string) => Number(s.replace(/['’\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/[.,]$/, '').replace(',', '.'));
const ohneZusatz = (g: string) => g.replace(/\s*\((ZH|TG)\)\s*$/i, '').replace(/\s+(ZH|TG)$/i, '').trim();
const roh = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const de = (n: number) => n.toLocaleString('de-CH');

/**
 * Den Satz verstehen. `gemeinden` sind die Gemeinden des Bestands (aus
 * suche_gemeinden): nur sie werden als Ort erkannt.
 */
export function satzVerstehen(satz: string, gemeinden: Gemeinde[]): Verstanden {
  const filter: SucheFilter = {};
  const teile: string[] = [];
  // Was erkannt ist, wird im Text durch ein Leerzeichen ersetzt; was
  // übrig bleibt und kein Füllwort ist, gilt als nicht verstanden.
  let t = ` ${einfach(satz).replace(/[«»"„“?!;:]/g, ' ').replace(/\s+/g, ' ')} `;
  const weg = (gefunden: string) => { t = t.replace(gefunden, ' '); };
  let m: RegExpExecArray | null;

  // ---------------------------------------------------------------- Ort
  // Längere Namen zuerst: sonst gewänne «Wil» gegen «Wila». Eine
  // Gemeinde mit zwei Schreibweisen im Bestand («Küsnacht (ZH)» und
  // «Küsnacht ZH») ist ein Ort mit beiden Namen.
  const nachName = new Map<string, Gemeinde[]>();
  for (const g of gemeinden) {
    const k = einfach(ohneZusatz(g.gemeinde));
    if (k) nachName.set(k, [...(nachName.get(k) ?? []), g]);
  }
  const orte: string[] = [];
  for (const n of [...nachName.keys()].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(^|[\\s,/(])${roh(n)}(\\s*\\(?(zh|tg)\\)?)?(?=[\\s,/)]|$)`);
    const treffer = re.exec(t);
    if (!treffer) continue;
    const alle = nachName.get(n)!;
    filter.gemeinden = [...(filter.gemeinden ?? []), ...alle.map(g => g.gemeinde)];
    orte.push(ohneZusatz(alle[0].gemeinde));
    t = t.replace(re, '$1 ');
  }
  // Postleitzahlen im Bestand liegen zwischen 8000 und 9999 -- so
  // verwechselt sich keine mit einem Baujahr oder einer Fläche.
  for (const p of t.matchAll(/\b([89]\d{3})\b(?!\s*(m2|m²|qm|m\b|'|’))/g)) {
    filter.plz = [...(filter.plz ?? []), p[1]];
    orte.push(p[1]);
  }
  t = t.replace(/\b[89]\d{3}\b(?!\s*(m2|m²|qm|m\b|'|’))/g, ' ');
  if (orte.length) teile.push(orte.join(', '));

  // --------------------------------------------------------------- Zone
  if ((m = /\b(\d)\s*-?\s*geschossigen?\s*(wohnzonen?)\b/.exec(t)) || (m = /\b(wohnzonen?),?\s*(\d)\s*-?\s*geschossig\w*/.exec(t))) {
    filter.zone = `W${/\d/.exec(m[0])![0]}`; weg(m[0]);
  } else if ((m = /\b(wg|w|k|z|d|lh)\s?([1-7])\s?g?\b/.exec(t))) {
    filter.zone = `${m[1].toUpperCase()}${m[2]}`; weg(m[0]);
  } else {
    const worte: [RegExp, string][] = [
      [/\b(wohn-?\s*und\s*gewerbezonen?|mischzonen?)\b(\s*(\d)\b)?/, 'WG'], [/\blandhauszonen?\b(\s*(\d)\b)?/, 'LH'],
      [/\bkernzonen?\b(\s*(\d)\b)?/, 'K'], [/\bzentrumszonen?\b(\s*(\d)\b)?/, 'Z'],
      [/\bdorfzonen?\b(\s*(\d)\b)?/, 'D'], [/\bwohnzonen?\b(\s*(\d)\b)?/, 'W'],
    ];
    for (const [re, k] of worte) {
      if (!(m = re.exec(t))) continue;
      const g = m[m.length - 1];
      filter.zone = g ? `${k}${g}` : k; weg(m[0]);
      break;
    }
  }
  if (filter.zone) teile.push(zoneText(filter.zone));

  // ------------------------------------------------------------ Baujahr
  const J = '(1[6-9]\\d{2}|20[0-4]\\d)';
  if ((m = new RegExp(`\\b(zwischen|von)\\s*${J}\\s*(und|bis|-|–)\\s*${J}\\b`).exec(t)) || (m = new RegExp(`\\b${J}\\s*(-|–|bis)\\s*${J}\\b`).exec(t))) {
    const j = m.slice(1).filter(x => /^\d{4}$/.test(x ?? '')).map(Number);
    filter.baujahr_min = Math.min(...j); filter.baujahr_max = Math.max(...j); weg(m[0]);
  } else if ((m = /\b(1[6-9]\d0|20[0-4]0)er(\s*jahre?n?)?\b/.exec(t))) {
    filter.baujahr_min = Number(m[1]); filter.baujahr_max = Number(m[1]) + 9; weg(m[0]);
  } else {
    if ((m = new RegExp(`\\b(vor|aelter\\s*als|frueher\\s*als)\\s*${J}\\b`).exec(t))) { filter.baujahr_max = Number(m[2]) - 1; weg(m[0]); }
    else if ((m = new RegExp(`\\b(bis|spaetestens)\\s*${J}\\b`).exec(t))) { filter.baujahr_max = Number(m[2]); weg(m[0]); }
    if ((m = new RegExp(`\\b(nach|neuer\\s*als|juenger\\s*als)\\s*${J}\\b`).exec(t))) { filter.baujahr_min = Number(m[2]) + 1; weg(m[0]); }
    else if ((m = new RegExp(`\\b(ab|seit)\\s*${J}\\b`).exec(t))) { filter.baujahr_min = Number(m[2]); weg(m[0]); }
    if (filter.baujahr_min == null && filter.baujahr_max == null && (m = new RegExp(`\\b(baujahr|gebaut|erstellt)\\s*(im\\s*jahr\\s*|in\\s*)?${J}\\b`).exec(t))) {
      filter.baujahr_min = filter.baujahr_max = Number(m[3]); weg(m[0]);
    }
  }
  if (filter.baujahr_min != null && filter.baujahr_max != null) teile.push(filter.baujahr_min === filter.baujahr_max ? `gebaut ${filter.baujahr_min}` : `gebaut ${filter.baujahr_min}–${filter.baujahr_max}`);
  else if (filter.baujahr_max != null) teile.push(`gebaut bis ${filter.baujahr_max}`);
  else if (filter.baujahr_min != null) teile.push(`gebaut ab ${filter.baujahr_min}`);

  // ------------------------------------- Potenzial (vor der Fläche: «Potenzial ab 200 m²»)
  const F = "(\\d[\\d'’.]*)\\s*(m2|m²|qm|quadratmeter)";
  if ((m = new RegExp(`\\b(potenzial|potential|reserve|ausbaupotenzial|hnf)\\w*(\\s*(von|ab|ueber|mehr\\s*als|mindestens|min\\.?|>)?\\s*${F})?`).exec(t))) {
    filter.reserve_min = m[4] ? zahl(m[4]) : 1; weg(m[0]);
    teile.push(filter.reserve_min > 1 ? `Potenzial ab ${de(filter.reserve_min)} m² HNF` : 'mit Potenzial');
  }

  // ------------------------------------------------------------- Fläche
  if ((m = new RegExp(`\\b(zwischen\\s*)?(\\d[\\d'’.]*)\\s*(bis|-|–|und)\\s*${F}`).exec(t))) {
    filter.flaeche_min = zahl(m[2]); filter.flaeche_max = zahl(m[4]); weg(m[0]);
  } else {
    if ((m = new RegExp(`\\b(ueber|ab|mehr\\s*als|groesser\\s*als|mindestens|min\\.?|>)\\s*${F}`).exec(t))) { filter.flaeche_min = zahl(m[2]); weg(m[0]); }
    if ((m = new RegExp(`\\b(unter|bis|weniger\\s*als|kleiner\\s*als|hoechstens|max\\.?|<)\\s*${F}`).exec(t))) { filter.flaeche_max = zahl(m[2]); weg(m[0]); }
  }
  if (filter.flaeche_min != null && filter.flaeche_max != null) teile.push(`${de(filter.flaeche_min)}–${de(filter.flaeche_max)} m²`);
  else if (filter.flaeche_min != null) teile.push(`ab ${de(filter.flaeche_min)} m²`);
  else if (filter.flaeche_max != null) teile.push(`bis ${de(filter.flaeche_max)} m²`);

  // ---------------------------------------------- Geschosse, Wohnungen
  const anzahl = (wort: string, min: 'geschosse_min' | 'wohnungen_min', max: 'geschosse_max' | 'wohnungen_max', titel: (a: string) => string) => {
    let r: RegExpExecArray | null;
    if ((r = new RegExp(`\\b(ab|mindestens|mehr\\s*als|ueber)\\s*(\\d+)\\s*-?\\s*(${wort})`).exec(t))) {
      filter[min] = Number(r[2]) + (/mehr|ueber/.test(r[1]) ? 1 : 0); weg(r[0]); teile.push(titel(`ab ${filter[min]}`)); return;
    }
    if ((r = new RegExp(`\\b(bis|hoechstens|weniger\\s*als|unter)\\s*(\\d+)\\s*-?\\s*(${wort})`).exec(t))) {
      filter[max] = Number(r[2]) - (/weniger|unter/.test(r[1]) ? 1 : 0); weg(r[0]); teile.push(titel(`bis ${filter[max]}`)); return;
    }
    if ((r = new RegExp(`\\b(\\d+)\\s*-?\\s*(${wort})`).exec(t))) {
      filter[min] = filter[max] = Number(r[1]); weg(r[0]); teile.push(titel(r[1]));
    }
  };
  anzahl('geschoss\\w*|stockwerk\\w*|stoeckig\\w*|etage\\w*|vollgeschoss\\w*', 'geschosse_min', 'geschosse_max', a => `${a} Geschosse`);
  anzahl('wohnung\\w*|whg\\.?', 'wohnungen_min', 'wohnungen_max', a => `${a} Wohnungen`);

  // ------------------------------------------------------------ Heizung
  for (const [re, kodes, titel] of HEIZ_WOERTER) {
    if (!(m = re.exec(t))) continue;
    filter.heizung = kodes; weg(m[0]); t = t.replace(/\bheizung\w*/g, ' ');
    teile.push(`Heizung ${titel}`);
    break;
  }

  // -------------------------------------------------- Art, bebaut, Eigentümer, Schutz
  if ((m = /\b(efh|einfamilienh\w*)/.exec(t))) { filter.art = 'efh'; weg(m[0]); teile.push('Einfamilienhäuser'); }
  else if ((m = /\b(mfh|mehrfamilienh\w*)/.exec(t))) { filter.art = 'mfh'; weg(m[0]); teile.push('Mehrfamilienhäuser'); }
  if ((m = /\b(unbebaut\w*|bauland|ohne\s*gebaeude|leere?n?)\b/.exec(t))) { filter.unbebaut = true; weg(m[0]); teile.push('unbebaut'); }
  if ((m = /\b(ohne\s*eigentuemer\w*|eigentuemer\w*\s*unbekannt|unbekannte\w*\s*eigentuemer\w*)/.exec(t))) {
    filter.eigentuemer = 'unbekannt'; weg(m[0]); teile.push('Eigentümer unbekannt');
  } else if ((m = /\b(mit\s*eigentuemer\w*|eigentuemer\w*\s*bekannt|bekannte\w*\s*eigentuemer\w*)/.exec(t))) {
    filter.eigentuemer = 'bekannt'; weg(m[0]); teile.push('Eigentümer bekannt');
  }
  if ((m = /\b(nicht|kein\w*|ohne)\s*(denkmal\w*|geschuetzt\w*|schutz\w*|inventar\w*)/.exec(t))) {
    filter.denkmal = 'ohne'; weg(m[0]); teile.push('ohne Denkmalschutz');
  } else if ((m = /\b(denkmal\w*|geschuetzt\w*|inventar\w*)/.exec(t))) {
    filter.denkmal = 'mit'; weg(m[0]); teile.push('mit Denkmalschutz');
  }

  // --------------------------------------------------------- Sortierung
  if ((m = /\b(groesste\w*|grosse\w*)\b/.exec(t))) { filter.sortierung = 'flaeche'; weg(m[0]); teile.push('grösste zuerst'); }
  else if ((m = /\b(aelteste\w*|alte\w*)\b/.exec(t))) { filter.sortierung = 'baujahr'; weg(m[0]); teile.push('älteste zuerst'); }

  const offen = t.split(/[\s,./()+–-]+/).filter(w => w && !FUELL.has(w) && !/^[\d'’]+$/.test(w));

  // Ein grossgeschriebenes Wort nach «in», das kein Ort des Bestands
  // ist: das sagt die Seite so, statt «nicht verstanden» zu melden.
  let fremderOrt: string | undefined;
  if (!filter.gemeinden && !filter.plz) {
    const r = /\b(?:in|im|bei|von)\s+([A-ZÄÖÜ][\wäöüéè-]+(?:\s+[A-ZÄÖÜ][\wäöüéè-]+)?)/.exec(satz);
    if (r) fremderOrt = r[1];
  }
  return { filter, teile, orte, offen, fremderOrt };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export async function gemeindenLaden(): Promise<Gemeinde[]> {
  const r = await db().rpc('suche_gemeinden');
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as Gemeinde[];
}

export interface Treffer {
  id: string; egrid: string | null;
  adresse: string | null; plz: string | null; gemeinde: string | null; parzelle: string | null;
  flaeche: number | null; zone: string | null; zone_kurz: string | null; az: number | null;
  baujahr: number | null; geschosse: number | null; wohnungen: number | null; heizung: number | null;
  art: string | null; reserve: number | null; eigentuemer: string | null;
  denkmal: string | null; denkmal_titel: string | null; isos: string | null;
  /** LV95: Ost und Nord, unten links und oben rechts. */
  rahmen: [number, number, number, number] | null;
  umriss: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null;
}

export interface Ergebnis {
  anzahl: number; im_ort: number; ohne_zone: number;
  zonen: { kurz: string; anzahl: number }[];
  zeilen: Treffer[];
}

export const SEITE = 50;

export async function suchen(filter: SucheFilter, ab = 0): Promise<Ergebnis> {
  const r = await db().rpc('suche_parzellen', { p_filter: filter, p_grenze: SEITE, p_ab: ab });
  if (r.error) throw new Error(r.error.message);
  return r.data as Ergebnis;
}

/**
 * Luftbild und Umriss einer Parzelle als ein quadratischer Ausschnitt:
 * der Rahmen mit Rand, damit man die Nachbarschaft sieht. Gibt die
 * Adresse des Bildes (SWISSIMAGE, WMS des Bundes) und den Pfad des
 * Umrisses in Bildkoordinaten (0 bis 100) zurück.
 */
export function parzellenBild(t: Pick<Treffer, 'rahmen' | 'umriss'>, px = 240): { bild: string; pfad: string } | null {
  if (!t.rahmen) return null;
  const [x0, y0, x1, y1] = t.rahmen;
  const seite = Math.max(x1 - x0, y1 - y0, 20) * 1.35;
  const l = (x0 + x1) / 2 - seite / 2, u = (y0 + y1) / 2 - seite / 2;
  const bild = 'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=&FORMAT=image/jpeg' +
    `&CRS=EPSG:2056&BBOX=${[l, u, l + seite, u + seite].map(v => v.toFixed(1)).join(',')}&WIDTH=${px}&HEIGHT=${px}`;
  const ringe: number[][][] = !t.umriss ? [] : t.umriss.type === 'Polygon'
    ? (t.umriss.coordinates as number[][][])
    : (t.umriss.coordinates as number[][][][]).flat();
  const pfad = ringe.map(r => r.map(([x, y], i) => `${i ? 'L' : 'M'}${(((x - l) / seite) * 100).toFixed(2)} ${(((u + seite - y) / seite) * 100).toFixed(2)}`).join(' ') + ' Z').join(' ');
  return { bild, pfad };
}

/** Beispiele unter dem Feld: zeigen, was die Suche versteht. */
export const BEISPIELE = [
  'Alle W2 in Dietikon',
  'Einfamilienhäuser in Uster vor 1970 mit Ölheizung',
  'Kloten über 1000 m² mit Potenzial',
  'W3 in 8953 ohne Denkmalschutz',
];

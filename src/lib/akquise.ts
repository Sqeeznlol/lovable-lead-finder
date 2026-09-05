/**
 * Einschätzung, ob sich ein Anruf lohnt.
 *
 * Die Potenzial-Rechnung sagt, was baulich möglich wäre. Sie sagt nichts
 * darüber, ob jemand verkaufen würde -- und genau daran entscheidet sich,
 * ob ein Anruf Zeit kostet oder Geld bringt.
 *
 * Drei Fragen bestimmen das Ergebnis:
 *
 *   1. Lohnt sich die Entwicklung wirtschaftlich? Die Marge muss die
 *      Mühe tragen, und sie hängt stark von der Lage ab: dieselbe Reserve
 *      ist am See ein Vielfaches wert wie im Tösstal.
 *   2. Ist der Eigentümer erreichbar und ansprechbar? Eine
 *      Erbengemeinschaft verkauft eher als eine Pensionskasse, eine
 *      Privatperson eher als eine Immobilien-AG.
 *   3. Steht ein Anlass bevor? Ein Haus von 1955, das nie renoviert
 *      wurde, steht vor einer Sanierung, die sich oft nicht mehr lohnt --
 *      das ist der Moment, in dem verkauft wird.
 */

import { calculatePotential, type PotentialInput } from './potential';
import { gemeindeprofil, type Lagestufe } from './gemeinden-zh';

export type Empfehlung = 'anrufen' | 'pruefen' | 'zurueckstellen' | 'nein';

export interface AkquiseInput extends PotentialInput {
  gemeinde?: string | null;
  owner_name?: string | null;
  eigentuemer_name?: string | null;
  wohnungen?: number | string | null;
  gebaeude_anzahl?: number | null;
}

export interface AkquiseUrteil {
  empfehlung: Empfehlung;
  /** 0–100, für die Sortierung innerhalb einer Empfehlung. */
  punkte: number;
  /** Was dafür spricht. */
  dafuer: string[];
  /** Was dagegen spricht. */
  dagegen: string[];
  /** Erlös in dieser Gemeinde, CHF je m² HNF. */
  erloesProM2: number;
  lage: Lagestufe;
  /** Marge mit dem Preisniveau dieser Gemeinde gerechnet, CHF. */
  margeLagegerecht: number | null;
}

/** Eigentümertypen, geordnet nach Verkaufsbereitschaft. */
export type Eigentuemertyp =
  | 'erbengemeinschaft' | 'privat' | 'firma' | 'institutionell' | 'oeffentlich' | 'unbekannt';

const MUSTER: [RegExp, Eigentuemertyp][] = [
  [/erbengemeinschaft|erbeng\.|erben\s+(des|der|von)|nachlass/i, 'erbengemeinschaft'],
  [/pensionskasse|vorsorge|stiftung|versicherung|swiss life|axa|zurich vers|anlagestiftung|immobilien ?fonds|anlagefonds/i, 'institutionell'],
  [/gemeinde|stadt |kanton|bund|schweizerische eidgenossenschaft|kirchgemeinde|kirche|genossenschaft/i, 'oeffentlich'],
  [/\bAG\b|\bGmbH\b|\bSA\b|\bimmobilien\b|\bholding\b|\bverwaltung\b/i, 'firma'],
];

export function eigentuemertyp(name?: string | null): Eigentuemertyp {
  if (!name || !name.trim()) return 'unbekannt';
  for (const [muster, typ] of MUSTER) {
    if (muster.test(name)) return typ;
  }
  // Zwei oder mehr Namen deuten auf eine Erbengemeinschaft oder Miteigentum
  if (/\bund\b|&|,/.test(name) && name.length > 12) return 'erbengemeinschaft';
  return 'privat';
}

/** Wie ansprechbar ist dieser Eigentümertyp? 0–1. */
const ANSPRECHBAR: Record<Eigentuemertyp, number> = {
  erbengemeinschaft: 1.0,   // Verkauf ist oft die einzige Einigung
  privat: 0.8,              // ansprechbar, entscheidet selbst
  unbekannt: 0.5,           // muss zuerst ermittelt werden
  firma: 0.35,              // verkauft nur bei passendem Preis
  institutionell: 0.1,      // hält langfristig, verkauft praktisch nie
  oeffentlich: 0.05,        // verkauft fast nie, langwierige Verfahren
};

const TYP_LABEL: Record<Eigentuemertyp, string> = {
  erbengemeinschaft: 'Erbengemeinschaft',
  privat: 'Privatperson',
  firma: 'Firma',
  institutionell: 'Institutioneller Anleger',
  oeffentlich: 'Öffentliche Hand',
  unbekannt: 'Eigentümer unbekannt',
};

export function beurteile(p: AkquiseInput): AkquiseUrteil {
  const r = calculatePotential(p);
  const profil = gemeindeprofil(p.gemeinde);
  const dafuer: string[] = [];
  const dagegen: string[] = [];

  // Marge mit dem Preisniveau dieser Gemeinde statt mit dem Pauschalwert
  const margeLagegerecht =
    r.hnfDelta != null && r.investition != null
      ? r.hnfDelta * profil.erloesProM2 - r.investition
      : null;

  // ---- Ausschluss ----------------------------------------------------
  if (r.killer.includes('Zonenangabe fehlt')) {
    return {
      empfehlung: 'nein', punkte: 0,
      dafuer: [],
      dagegen: ['Zonenangabe in den Daten unbrauchbar — ohne Zone keine Rechnung'],
      erloesProM2: profil.erloesProM2, lage: profil.stufe, margeLagegerecht: null,
    };
  }
  if (r.killer.includes('Keine Bauzone') || r.killer.includes('Keine Wohnnutzung')) {
    return {
      empfehlung: 'nein', punkte: 0,
      dafuer: [], dagegen: [r.killer[0]],
      erloesProM2: profil.erloesProM2, lage: profil.stufe, margeLagegerecht: null,
    };
  }
  if (r.killer.some(k => k.startsWith('Bauzonenfläche unplausibel'))) {
    return {
      empfehlung: 'pruefen', punkte: 40,
      dafuer: ['Grosse Fläche — falls die Zonenangabe stimmt, sehr interessant'],
      dagegen: ['Bauzonenfläche unplausibel gross — vor dem Anruf im GIS prüfen'],
      erloesProM2: profil.erloesProM2, lage: profil.stufe, margeLagegerecht: null,
    };
  }
  if (r.killer.includes('Denkmalschutz')) {
    return {
      empfehlung: 'nein', punkte: 0,
      dafuer: [], dagegen: ['Denkmalschutz — Ersatzneubau nicht möglich'],
      erloesProM2: profil.erloesProM2, lage: profil.stufe, margeLagegerecht: null,
    };
  }

  let punkte = 0;

  // ---- 1. Wirtschaftlichkeit (0-45) ----------------------------------
  if (margeLagegerecht != null && margeLagegerecht > 0) {
    const mio = margeLagegerecht / 1e6;
    punkte += Math.min(mio / 5, 1) * 45;
    if (mio >= 2) dafuer.push(`Marge rund ${mio.toFixed(1)} Mio in ${profil.stufe === 'spitze' ? 'Spitzenlage' : 'dieser Lage'}`);
    else if (mio >= 0.5) dafuer.push(`Marge rund ${mio.toFixed(1)} Mio`);
    else dagegen.push('Marge unter einer halben Million');
  } else if (r.hnfDelta === null) {
    dagegen.push('Kein Potenzial berechenbar — Zone oder Fläche fehlt');
  } else {
    dagegen.push('Kein wirtschaftlicher Spielraum');
  }

  // ---- 2. Eigentümer (0-30) ------------------------------------------
  const typ = eigentuemertyp(p.owner_name ?? p.eigentuemer_name);
  const ansprechbar = ANSPRECHBAR[typ];
  punkte += ansprechbar * 30;

  if (typ === 'erbengemeinschaft') dafuer.push('Erbengemeinschaft — verkauft erfahrungsgemäss eher');
  else if (typ === 'privat') dafuer.push('Privateigentum — Entscheid liegt bei einer Person');
  else if (typ === 'institutionell') dagegen.push('Institutioneller Anleger — hält langfristig');
  else if (typ === 'oeffentlich') dagegen.push('Öffentliche Hand — verkauft praktisch nie');
  else if (typ === 'firma') dagegen.push('Firma im Grundbuch — verkauft nur bei passendem Preis');
  else dagegen.push('Eigentümer noch nicht ermittelt');

  // ---- 3. Anlass zum Verkauf (0-25) ----------------------------------
  const bj = p.renovationsjahr ?? p.baujahr;
  if (p.baujahr && p.baujahr < 1850) {
    // Vor 1850 gebaute Häuser stehen fast immer im Ortsbildschutz oder im
    // kommunalen Inventar, auch wenn die Liste keinen Eintrag führt.
    dagegen.push(`Baujahr ${p.baujahr} — Schutzstatus sehr wahrscheinlich, vorab abklären`);
    punkte -= 20;
  }
  if (bj) {
    const alter = new Date().getFullYear() - bj;
    if (alter >= 60) {
      punkte += 25;
      dafuer.push(`Bau von ${bj} — Sanierungsstau, klassischer Verkaufsanlass`);
    } else if (alter >= 45) {
      punkte += 18;
      dafuer.push(`Bau von ${bj} — Sanierung steht an`);
    } else if (alter >= 30) {
      punkte += 10;
    } else {
      dagegen.push(`Bau von ${bj} — zu jung für einen Ersatzneubau`);
    }
  } else {
    punkte += 8;
  }

  // Kleine Objekte lassen sich einfacher kaufen als Mehrparteienhäuser
  const whg = Number(p.wohnungen) || 0;
  if (whg > 0 && whg <= 3) dafuer.push(`Nur ${whg} Wohnung${whg > 1 ? 'en' : ''} — überschaubare Verhältnisse`);
  else if (whg >= 12) dagegen.push(`${whg} Wohnungen — viele Mietverhältnisse aufzulösen`);

  if ((p.gebaeude_anzahl ?? 1) > 1) {
    dafuer.push(`${p.gebaeude_anzahl} Gebäude auf einer Parzelle — Arealentwicklung möglich`);
  }

  // ---- 4. Woran man das Potenzial im Gespräch festmacht ---------------
  // Die Marge ist eine Zahl, die niemand am Telefon glaubt. Was überzeugt,
  // sind die zwei Beobachtungen dahinter: es fehlt ein Geschoss, und das
  // Haus steht verloren auf einer grossen Parzelle. Beide werden ohnehin
  // gerechnet -- sie standen bloss nirgends.

  const gebautGeschosse = Number(p.geschosse) || null;
  if (r.vollgeschosse != null && gebautGeschosse != null) {
    const fehlend = r.vollgeschosse - gebautGeschosse;
    if (fehlend >= 1) {
      // Ein ganzes ungenutztes Geschoss ist das greifbarste Argument
      // überhaupt und lässt sich in einem Satz erklären.
      punkte += Math.min(fehlend, 2) * 8;
      dafuer.push(
        fehlend === 1
          ? `${gebautGeschosse} Geschosse gebaut, ${r.vollgeschosse} erlaubt — ein Geschoss ungenutzt`
          : `${gebautGeschosse} Geschosse gebaut, ${r.vollgeschosse} erlaubt — ${fehlend} Geschosse ungenutzt`,
      );
    }
  }

  const bebaubar = Number(p.bebaubar_m2 ?? p.area) || null;
  const fussabdruck = Number(p.gebaeudeflaeche) || null;
  if (bebaubar != null && fussabdruck != null && bebaubar > 0) {
    const belegt = fussabdruck / bebaubar;
    if (belegt < 0.12 && bebaubar >= 800) {
      punkte += 10;
      dafuer.push(
        `Gebäude belegt nur ${Math.round(belegt * 100)} % der Parzelle — viel ungenutztes Land`,
      );
    } else if (belegt < 0.2 && bebaubar >= 600) {
      punkte += 5;
      dafuer.push(`Gebäude belegt ${Math.round(belegt * 100)} % der Parzelle`);
    }
  }

  if (r.reserveQuote != null && r.reserveQuote >= 0.4) {
    dafuer.push(
      `Nur ${Math.round((1 - r.reserveQuote) * 100)} % der zulässigen Fläche genutzt`,
    );
  }

  if (r.confidence === 'tief' || r.confidence === 'keine') {
    dagegen.push('Datenlage dünn — Angaben vor dem Anruf prüfen');
  }

  punkte = Math.max(0, Math.min(100, Math.round(punkte)));

  let empfehlung: Empfehlung =
    punkte >= 65 ? 'anrufen'
    : punkte >= 45 ? 'pruefen'
    : punkte >= 25 ? 'zurueckstellen'
    : 'nein';

  // Zwei Fälle, in denen die Punktzahl in die Irre führt, weil eine grosse
  // Marge alles andere überstimmt. Beide Male ist die Antwort unabhängig
  // davon, wie viel rechnerisch drinliegt:
  //
  //   Ein institutioneller Halter oder die öffentliche Hand verkauft nicht,
  //   auch nicht bei zweistelligen Millionenbeträgen -- Pensionskassen
  //   halten Wohnliegenschaften als Anlage, Gemeinden brauchen ihre
  //   Grundstücke selbst.
  //
  //   Ein Haus von 2012 wird nicht abgerissen. Die Bausubstanz ist neu, der
  //   Eigentümer hat keinen Anlass, und der Ersatzneubau vernichtet Wert.
  if (typ === 'institutionell' || typ === 'oeffentlich') {
    if (empfehlung === 'anrufen' || empfehlung === 'pruefen') {
      empfehlung = 'zurueckstellen';
      dagegen.push('Trotz Potenzial: dieser Eigentümertyp verkauft praktisch nie');
    }
  }

  const alterJetzt = bj ? new Date().getFullYear() - bj : null;
  if (alterJetzt != null && alterJetzt < 25 && empfehlung === 'anrufen') {
    empfehlung = 'pruefen';
    dagegen.push('Bausubstanz zu jung für einen Ersatzneubau');
  }
  if (alterJetzt != null && alterJetzt < 15) {
    empfehlung = 'nein';
  }

  return {
    empfehlung, punkte, dafuer, dagegen,
    erloesProM2: profil.erloesProM2, lage: profil.stufe, margeLagegerecht,
  };
}

export const EMPFEHLUNG_LABEL: Record<Empfehlung, string> = {
  anrufen: 'Anrufen',
  pruefen: 'Prüfen',
  zurueckstellen: 'Zurückstellen',
  nein: 'Nein',
};

export const EIGENTUEMER_LABEL = TYP_LABEL;

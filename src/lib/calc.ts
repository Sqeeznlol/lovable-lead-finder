/**
 * CALC YOU LATER: vom Lead zur Kaufpreisempfehlung.
 *
 * Die Idee (an Julian weitergegeben, 16. November): «De Lele muen chöne
 * en Lead inegeh und es muen mer alles usespucke: Landwert, welli HNF
 * möglich sött si, Kubatur, Baukoste, Verkaufserlös gschätzt, Gwünn,
 * Grössi vode Flächi, möglichi Chance, möglichi Risike ... Wichtig,
 * dases schnell Resultat git, wo verhebed.»
 *
 * Zwei Bewertungen, und die höhere zählt:
 *
 *   Neubau    was nach Erlös, Baukosten, Abbruch und Gewinn für das
 *             Land bleibt -- die Rechnung der Machbarkeitsstudie
 *   Bestand   was das Haus mit seinen Mieten wert ist: vermietbare
 *             Fläche aus dem Fussabdruck, mal Miete, geteilt durch die
 *             Rendite, zu der ein Käufer kauft
 *
 * Die Empfehlung ist dieser Wert minus einen Abschlag, weil die Rechnung
 * auf Annahmen steht. Sie ist ein Vorschlag: bestätigt oder geändert
 * wird sie von einem Menschen (kalkulation_schritt in der Datenbank).
 *
 * Chancen und Risiken sind Regeln über gemessenen Zahlen, kein
 * Sprachmodell: jeder Satz nennt die Zahl, auf der er steht.
 *
 * Diese Datei rechnet nur; geholt wird in calc-daten.ts.
 */
import { ANNAHMEN, chf, m2, studieRechnen, type Annahmen, type Eingabe, type Studie, type ZonenRegeln } from '@/lib/machbarkeit';
import { MIETEN, MIETEN_JAHR } from '@/lib/mieten-daten';

export interface CalcAnnahmen extends Annahmen {
  /** Bruttorendite, zu der ein Käufer ein Mehrfamilienhaus kauft (0 bis 1). */
  rendite: number;
  /** Abschlag auf den Wert: die Luft, die bleibt, weil die Rechnung auf Annahmen steht (0 bis 1). */
  abschlag: number;
}
export const CALC_ANNAHMEN: CalcAnnahmen = { ...ANNAHMEN, rendite: 0.04, abschlag: 0.1 };

/** Eine Wohnung aus einem Inserat: Fläche in m² und Netto-Miete im Monat. */
export interface Vergleich { flaeche: number; miete: number }

/** Was ein Mensch weiss und die Register nicht. Leer heisst: nicht bekannt. */
export interface VonHand {
  /** Ausnützungsziffer und Vollgeschosse aus der Bauordnung, wo kein Zonenplan angebunden ist. */
  az?: number | null;
  vollgeschosse?: number | null;
  /** Vermietbare Fläche, m². */
  wohnflaeche?: number | null;
  /** Miete heute, CHF je m² und Monat. */
  mieteHeute?: number | null;
  /** Netto-Mietertrag im Jahr laut Mieterspiegel, CHF. */
  mietertragJahr?: number | null;
  /** Was Inserate in der Nachbarschaft verlangen (Homegate, Comparis), von Hand übertragen. */
  vergleiche?: Vergleich[];
}

export interface Preis { m: number; q25?: number | null; q75?: number | null }

/** Was das Umfeld sagt -- Grundlage der Chancen und Risiken. */
export interface Umfeld {
  gemeinde?: string | null;
  /** Bezahltes Wohnbauland in der Gemeinde, CHF je m² (amtlich, nur ZH und BL). */
  land?: Preis | null;
  /** Eigentumswohnungen und Einfamilienhäuser in der Gemeinde, CHF je Objekt (amtlich, nur ZH). */
  stwe?: Preis | null;
  efh?: Preis | null;
  denkmal?: boolean;
  isos?: boolean;
  /** Einträge im Kataster der belasteten Standorte. */
  belastet?: number | null;
  /** Güteklasse des öffentlichen Verkehrs, wie der Bund sie nennt. */
  oev?: string | null;
  /** Baugesuche im Umkreis in zwölf Monaten, und der Umkreis in Metern. */
  baugesuche?: number | null;
  baugesucheMeter?: number | null;
}

export interface CalcEingabe {
  grundlage: Omit<Eingabe, 'annahmen'>;
  annahmen: CalcAnnahmen;
  kanton: string | null;
  hand: VonHand;
  umfeld: Umfeld;
  /** Das laufende Jahr -- nur für die Tests eine Eingabe. */
  jahr?: number;
}

export interface Neubau {
  gf: number; hnf: number;
  /** Volumen über Boden, m³: Geschossfläche mal Geschosshöhe. */
  kubatur: number;
  wohnungen: number;
  baukosten: number; abbruch: number; erloes: number;
  /** Was der Entwickler vom Erlös behält. */
  gewinn: number;
  landwert: number; jeM2: number;
  /** Baukosten je m³ Kubatur -- die Zahl, an der ein Bauherr die Annahme misst. */
  jeM3: number;
  /** Was eine Wohnung mittlerer Grösse in dieser Rechnung kostet. */
  wohnungPreis: number;
}

export interface Bestand {
  wohnungen: number | null;
  baujahr: number | null;
  /** Vermietbare Fläche, m². */
  flaeche: number | null;
  flaecheArt: 'hand' | 'fussabdruck' | null;
  /** CHF je m² und Monat. */
  mieteHeute: number | null;
  /** ertrag: aus dem Mieterspiegel. hand: eingegeben. statistik: Durchschnitt des Kantons. */
  mieteArt: 'ertrag' | 'hand' | 'statistik';
  mieteQuelle: string;
  ertragHeute: number;
  wert: number;
  /** Median der Inserate, CHF je m² und Monat; null ohne Inserate. */
  marktmiete: number | null;
  vergleiche: number;
  ertragMarkt: number | null;
  wertMarkt: number | null;
}

export interface Bewertung {
  studie: Studie;
  neubau: Neubau | null;
  bestand: Bestand | null;
  /** Welche der beiden Bewertungen den Preis bestimmt. */
  massgebend: 'neubau' | 'bestand' | null;
  wert: number | null;
  /** Wert minus Abschlag, auf 10'000 abgerundet. */
  empfehlung: number | null;
  /**
   * Der Massstab des Marktes: die Fläche zum Median dessen, was in der
   * Gemeinde für Wohnbauland bezahlt wurde (amtlich, nur ZH und BL).
   */
  landMarkt: { jeM2: number; wert: number } | null;
  chancen: string[];
  risiken: string[];
}

const pos = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) && v > 0 ? v : null);
const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen });
const prozent = (anteil: number) => Math.round(anteil * 100);
/** Ein Satz endet mit einem Punkt -- auch wenn er auf «Mio.» ausgeht, nur mit einem. */
const satz = (s: string) => (s.endsWith('.') ? s : `${s}.`);

export function median(werte: number[]): number | null {
  const s = werte.filter(w => Number.isFinite(w)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mitte = Math.floor(s.length / 2);
  return s.length % 2 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2;
}

/**
 * Was Mieter im Kanton im Durchschnitt zahlen, CHF je m² und Monat
 * (Bundesamt für Statistik, Strukturerhebung). Mit Baujahr der Wert der
 * Bauperiode. Es sind Bestandsmieten: ein Inserat verlangt meist mehr.
 */
export function mieteStatistik(kanton: string | null | undefined, baujahr?: number | null): { wert: number; text: string } | null {
  const k = kanton ? MIETEN[kanton.toUpperCase()] : null;
  if (!k) return null;
  const i = baujahr ? k.perioden.findIndex(([bis]) => baujahr <= bis) : -1;
  const wert = i >= 0 ? k.perioden[i][1] : null;
  if (wert == null) return { wert: k.total, text: `Durchschnitt Kanton ${kanton!.toUpperCase()}, BFS ${MIETEN_JAHR}` };
  const von = i > 0 ? k.perioden[i - 1][0] + 1 : null, bis = k.perioden[i][0];
  const periode = von == null ? `bis ${bis}` : bis >= 9999 ? `ab ${von}` : `${von} bis ${bis}`;
  return { wert, text: `Durchschnitt Kanton ${kanton!.toUpperCase()} für Baujahre ${periode}, BFS ${MIETEN_JAHR}` };
}

/** Die Zone, wie gerechnet wird: was ein Mensch eingibt, gilt vor Zonenplan und Liste. */
export function zoneMitHand(zone: ZonenRegeln | null, hand: VonHand): ZonenRegeln | null {
  const az = pos(hand.az), vg = pos(hand.vollgeschosse);
  if (!az && !vg) return zone;
  return {
    bezeichnung: zone?.bezeichnung ?? null, abkuerzung: zone?.abkuerzung ?? null, gemeinde: zone?.gemeinde ?? null,
    az: az ?? zone?.az ?? null, bmz: zone?.bmz ?? null, uez: zone?.uez ?? null,
    vollgeschosse: vg ?? zone?.vollgeschosse ?? null, dachgeschosse: zone?.dachgeschosse ?? null, untergeschosse: zone?.untergeschosse ?? null,
    hoehe: zone?.hoehe ?? null, hoeheArt: zone?.hoeheArt ?? null, wohnanteilMin: zone?.wohnanteilMin ?? null,
    rechtsstatus: zone?.rechtsstatus ?? null, dokument: zone?.dokument ?? null, quelle: 'hand',
  };
}

export function bewerten(e: CalcEingabe): Bewertung {
  const a = e.annahmen, u = e.umfeld, g = e.grundlage;
  const zone = zoneMitHand(g.zone, e.hand);
  const studie = studieRechnen({ ...g, zone, annahmen: a });
  const flaeche = studie.flaeche;
  const ort = u.gemeinde || 'der Gemeinde';

  // ---- Neubau: was für das Land bleibt
  let neubau: Neubau | null = null;
  if (studie.rechenbar) {
    const v = studie.varianten[0];
    const abbruch = (studie.gfBestand ?? 0) * a.abbruch;
    const baukosten = v.kosten - abbruch;
    const kubatur = studie.gfNeu * a.geschosshoehe;
    neubau = {
      gf: studie.gfNeu, hnf: studie.hnfNeu, kubatur, wohnungen: studie.wohnungen, baukosten, abbruch, erloes: v.erloes,
      gewinn: v.erloes * a.marge, landwert: v.ergebnis, jeM2: flaeche ? v.ergebnis / flaeche : 0,
      jeM3: kubatur > 0 ? baukosten / kubatur : 0, wohnungPreis: a.erloes * a.wohnungM2,
    };
  }

  // ---- Bestand: was das Haus mit seinen Mieten wert ist
  const haupt = [...g.gebaeude].sort((x, y) => (y.grundflaeche ?? 0) - (x.grundflaeche ?? 0))[0];
  const wohnungen = g.gebaeude.reduce((s, x) => s + (x.wohnungen ?? 0), 0) || null;
  const vergleiche = (e.hand.vergleiche ?? []).filter(v => pos(v.flaeche) && pos(v.miete));
  const ertragHand = pos(e.hand.mietertragJahr);
  const flaecheHand = pos(e.hand.wohnflaeche);
  const flaecheB = flaecheHand ?? (studie.gfBestand != null ? studie.gfBestand * a.hnfFaktor : null);
  const statistik = mieteStatistik(e.kanton, haupt?.baujahr);
  const mieteHand = pos(e.hand.mieteHeute);
  const ertragHeute = ertragHand ?? (flaecheB && (mieteHand ?? statistik) ? flaecheB * (mieteHand ?? statistik!.wert) * 12 : null);
  // Ein Mehrfamilienhaus laut Register, oder jemand hat Mieten eingetragen.
  const vermietet = (wohnungen ?? 0) >= 3 || !!ertragHand || !!mieteHand || !!flaecheHand || vergleiche.length > 0;
  let bestand: Bestand | null = null;
  if (vermietet && ertragHeute && pos(a.rendite)) {
    const marktmiete = median(vergleiche.map(v => v.miete / v.flaeche));
    const ertragMarkt = marktmiete && flaecheB ? flaecheB * marktmiete * 12 : null;
    bestand = {
      wohnungen, baujahr: haupt?.baujahr ?? null, flaeche: flaecheB, flaecheArt: flaecheHand ? 'hand' : flaecheB ? 'fussabdruck' : null,
      mieteHeute: ertragHand ? (flaecheB ? ertragHand / 12 / flaecheB : null) : mieteHand ?? statistik!.wert,
      mieteArt: ertragHand ? 'ertrag' : mieteHand ? 'hand' : 'statistik',
      mieteQuelle: ertragHand ? 'Mietertrag laut Eingabe' : mieteHand ? 'Miete laut Eingabe' : statistik!.text,
      ertragHeute, wert: ertragHeute / a.rendite, marktmiete, vergleiche: vergleiche.length,
      ertragMarkt, wertMarkt: ertragMarkt ? ertragMarkt / a.rendite : null,
    };
  }

  // ---- die höhere Bewertung zählt
  const wN = neubau && neubau.landwert > 0 ? neubau.landwert : null;
  const wB = bestand?.wert ?? null;
  const massgebend: Bewertung['massgebend'] = wN == null && wB == null ? null : (wB ?? 0) > (wN ?? 0) ? 'bestand' : 'neubau';
  const wert = massgebend === 'bestand' ? wB : wN;
  const gerundet = wert ? Math.floor((wert * (1 - a.abschlag)) / 10000) * 10000 : 0;
  const empfehlung = gerundet > 0 ? gerundet : null;

  // ---- Chancen und Risiken: jeder Satz mit seiner Zahl
  const chancen: string[] = [], risiken: string[] = [];
  const jahr = e.jahr ?? new Date().getFullYear();

  if (studie.rechenbar && neubau) {
    const unbebaut = studie.gfBestand == null && g.gebaeude.length === 0 && g.registerVollstaendig !== false;
    if (unbebaut) chancen.push('Unbebaut: kein Abbruch und keine Mieter.');
    else if (studie.ausgenuetzt != null && studie.ausgenuetzt < 0.7 && studie.reserve) {
      chancen.push(`Erst ${prozent(studie.ausgenuetzt)} % ausgenützt: ${m2(studie.reserve)} Geschossfläche sind noch frei.`);
    }
    if (u.land) {
      const je = Math.round(neubau.jeM2 / 10) * 10;
      if (neubau.jeM2 > (u.land.q75 ?? u.land.m) * 1.25) {
        risiken.push(`Der Landwert von CHF ${de(je)} je m² liegt deutlich über dem, was in ${ort} für Bauland bezahlt wird (Median CHF ${de(u.land.m)}): Erlös und Baukosten prüfen.`);
      } else if (neubau.jeM2 < (u.land.q25 ?? u.land.m) * 0.75) {
        risiken.push(`In ${ort} wird für Bauland mehr bezahlt (Median CHF ${de(u.land.m)} je m²), als die Rechnung hergibt (CHF ${de(je)}): zu diesem Preis verkauft kaum jemand.`);
      } else {
        chancen.push(`Der Landwert von CHF ${de(je)} je m² liegt im Rahmen dessen, was in ${ort} für Bauland bezahlt wird (Median CHF ${de(u.land.m)}).`);
      }
    }
    if (u.stwe) {
      const p = neubau.wohnungPreis;
      if (u.stwe.q75 && p > u.stwe.q75) {
        risiken.push(`Die Rechnung verkauft eine Wohnung von ${de(a.wohnungM2)} m² für ${chf(p)}. Drei Viertel der Eigentumswohnungen in ${ort} gingen für weniger als ${chf(u.stwe.q75)} weg.`);
      } else if (u.stwe.q25 && p < u.stwe.q25) {
        chancen.push(`Tief gerechnet: eine Wohnung von ${de(a.wohnungM2)} m² für ${chf(p)}. Drei Viertel der Eigentumswohnungen in ${ort} gingen für mehr als ${chf(u.stwe.q25)} weg: der Erlös je m² lässt sich höher ansetzen.`);
      } else if (p <= u.stwe.m) {
        chancen.push(satz(`Vorsichtig gerechnet: eine Wohnung von ${de(a.wohnungM2)} m² für ${chf(p)}, der Median in ${ort} liegt bei ${chf(u.stwe.m)}`));
      }
    }
    if (neubau.landwert <= 0) risiken.push('Mit diesen Annahmen bleibt nach Baukosten und Gewinn nichts für das Land.');
    if (studie.begrenzt === 'huelle') {
      risiken.push(`Die Grenzabstände begrenzen das Volumen, nicht die Ziffer: gerechnet mit ${de(a.grenzabstand, 1)} m rundum, die Bauordnung kann mehr verlangen.`);
    }
    if (g.bebaubarM2 == null) risiken.push('Ohne Umriss gerechnet: ob das Volumen zwischen den Grenzabständen Platz hat, ist offen.');
    if (zone?.quelle === 'hand') risiken.push('Ziffer oder Geschosse sind von Hand eingegeben: in der Bauordnung nachsehen.');
    else if (zone?.quelle === 'bestand') risiken.push('Die Zone stammt aus der eigenen Liste, nicht aus dem amtlichen Zonenplan.');
    if (!studie.ziffer) risiken.push('Die Zone nennt keine Ziffer: es entscheiden Gestaltungsvorschriften und der Einzelfall.');
    if (studie.ausgenuetzt != null && studie.ausgenuetzt > 1) risiken.push('Der Bestand ist grösser als heute erlaubt: ein Neubau fiele kleiner aus.');
    if (neubau.landwert > 0 && neubau.wohnungen < 3) {
      risiken.push(`Nur rund ${neubau.wohnungen} ${neubau.wohnungen === 1 ? 'Wohnung' : 'Wohnungen'}: Planung und Nebenkosten fallen stärker ins Gewicht.`);
    }
    const bauzone = pos(g.bauzoneM2);
    if (bauzone && bauzone < flaeche * 0.98) risiken.push(`Nur ${m2(bauzone)} von ${m2(flaeche)} liegen in der Bauzone.`);
  }
  if (haupt?.baujahr && haupt.baujahr <= jahr - 45) {
    chancen.push(`Baujahr ${haupt.baujahr}: bei einem Haus dieses Alters steht eine grosse Sanierung an.`);
  }
  if ((u.baugesuche ?? 0) >= 3) {
    chancen.push(`${u.baugesuche} Baugesuche im Umkreis von ${de(u.baugesucheMeter ?? 300)} m in zwölf Monaten: hier wird gebaut.`);
  }
  // Der Bund schreibt «A - sehr gute Erschliessung»: die Klasse und ihr Name, ohne den Strich.
  const oev = u.oev?.trim().match(/^([AB])\b(?:\s*[-–]\s*(.+))?$/);
  if (oev) chancen.push(satz(`Öffentlicher Verkehr: Güteklasse ${oev[1]}${oev[2] ? `, ${oev[2]}` : ''}`));

  if (bestand) {
    if (bestand.marktmiete && bestand.mieteHeute && bestand.marktmiete > bestand.mieteHeute * 1.1 && bestand.wertMarkt) {
      chancen.push(`Die Inserate liegen ${prozent(bestand.marktmiete / bestand.mieteHeute - 1)} % über der heutigen Miete: neu vermietet wäre das Haus ${chf(bestand.wertMarkt)} wert.`);
    }
    if (bestand.mieteArt === 'statistik') risiken.push(`Die heutige Miete ist nicht bekannt: gerechnet mit dem ${bestand.mieteQuelle}. Mieterspiegel verlangen.`);
    if ((bestand.wohnungen ?? 0) >= 3) risiken.push(`${bestand.wohnungen} Wohnungen im Haus: Kündigungen und Erstreckungen brauchen Zeit.`);
  }
  if (wN != null && wB != null) {
    if (wN > wB) chancen.push(`Als Bauland ist die Liegenschaft ${chf(wN - wB)} mehr wert als mit den heutigen Mieten.`);
    else risiken.push(`Mit den heutigen Mieten ist das Haus ${chf(wB - wN)} mehr wert als das Land: ein Abbruch lohnt sich nicht.`);
  }
  if (u.denkmal) risiken.push('Denkmalschutz ist eingetragen: Abbruch und Umbau sind eingeschränkt.');
  if (u.isos) risiken.push('Ortsbild von nationaler Bedeutung (ISOS): Neubauten werden streng beurteilt.');
  if ((u.belastet ?? 0) > 0) risiken.push('Im Kataster der belasteten Standorte eingetragen: Untersuchung und Entsorgung einrechnen.');
  if (wohnungen != null && wohnungen <= 2 && u.efh && empfehlung != null && u.efh.m > empfehlung) {
    risiken.push(`Einfamilienhäuser in ${ort} gehen im Median für ${chf(u.efh.m)} weg: liegt das Angebot darunter, verkauft der Eigentümer eher an eine Familie.`);
  }

  const landMarkt = u.land && flaeche ? { jeM2: u.land.m, wert: u.land.m * flaeche } : null;
  return { studie, neubau, bestand, massgebend, wert, empfehlung, landMarkt, chancen, risiken };
}

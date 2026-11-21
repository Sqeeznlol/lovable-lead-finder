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
import { ANNAHMEN, bestandGf, chf, m2, studieRechnen, type Annahmen, type Eingabe, type Gebaeude, type Posten, type Studie, type ZonenRegeln } from '@/lib/machbarkeit';
import { MIETEN, MIETEN_JAHR } from '@/lib/mieten-daten';
import type { Spalten, VerlaufZeile } from '@/lib/preis-herleitung';
import { projektSatz, projektZaehlt, type Projekt } from '@/lib/bauprojekt';

export interface CalcAnnahmen extends Annahmen {
  /** Bruttorendite, zu der ein Käufer ein Mehrfamilienhaus kauft (0 bis 1). */
  rendite: number;
  /** Abschlag auf den Wert: die Luft, die bleibt, weil die Rechnung auf Annahmen steht (0 bis 1). */
  abschlag: number;
  /**
   * Baukosten je m² Nutzfläche für Wohnungen zum Verkauf, von Hand. Leer:
   * nach dem Verkaufspreis (baukostenNachErloes) mit den Zuschlägen für
   * Hang und Nähe zu Zürich. Das Feld `baukosten` (je m² Geschossfläche)
   * der Machbarkeit gilt hier nicht.
   */
  baukostenHnf: number | null;
  /** Baukosten je m² Nutzfläche für Mietwohnungen, vor den Zuschlägen. */
  baukostenMiete: number;
  /** Ab dieser gemeinsamen Fläche (m²) gilt eine Arealüberbauung, mit diesem Bonus auf die Nutzfläche (0 bis 1). */
  arealMin: number;
  arealBonus: number;
  /** Zuschlag auf die Baukosten eines kleinen Projekts (0 bis 1), und bis zu welchen Baukosten ein Projekt klein ist (CHF). */
  klein: number;
  kleinGrenze: number;
  /**
   * Was ein m² vermietbare Fläche im Bestand wert ist, als Anteil am
   * Verkaufspreis je m² (Erlös). Leer oder 0: nur der Ertragswert zählt.
   */
  bestandAnteil?: number;
  /** Dasselbe für Häuser ab Baujahr 1970 (Tim, 20. November), überall, nicht nur in der Stadt Zürich. */
  bestandAnteilJung?: number;
}
/**
 * Julian, 16. November: «Wir brauchen eine Gewinnmarge von 20 %», und
 * «bei Miete rechnest du 6500/m² Baukosten». In den Baukosten sind die
 * Nebenkosten enthalten; der Abbruch kommt dazu.
 */
export const CALC_ANNAHMEN: CalcAnnahmen = {
  ...ANNAHMEN, marge: 0.2, rendite: 0.04, abschlag: 0.1, baukostenHnf: null, baukostenMiete: 6500,
  // Annahme: viele Zürcher Bauordnungen erlauben eine Arealüberbauung ab
  // einer Mindestfläche, mit mehr Ausnützung. Wie viel und ab wann, steht
  // in der Bauordnung der Gemeinde; die Felder lassen sich ändern.
  arealMin: 3000, arealBonus: 0.1,
  // Julian, 18. November (YOMORI): unter 10 Mio. Baukosten 30 % teurer.
  klein: 0.3, kleinGrenze: 10_000_000,
  // Tim, 20. November (Schöneggstrasse 18): «10k/m² HNF ... manchmal ist der
  // Bestand mehr wert als die zu günstig kapitalisierte Miete». 10'000 sind
  // 57.8 % der 17'300, die Stockwerkeigentum dort kostet. Gilt vorerst nur
  // in der Stadt Zürich (inStadtZuerich).
  // Seit dem 21. November mit den Preisen je Quartier: Tims zwei Urteile in
  // der Stadt geben 10'000 von 19'000 (Schöneggstrasse 18, Kreis 4) und
  // 12'000 von 19'650 (Mutschellenstrasse 49, Wollishofen), im Mittel 56.9 %.
  bestandAnteil: 0.569,
  // Tim, 20. November, Rietwisstrasse 7 in Uitikon (Baujahr 2019): «alle
  // Gebäude, welche nach 1970 gebaut wurden, haben noch eine lange
  // Lebensdauer ... im Bestand wesentlich mehr wert als bei einem Neubau ...
  // über Rendite oder über m² HNF ... 12000/m²». 12'000 von 16'700 Erlös
  // sind 71.9 %.
  bestandAnteilJung: 0.719,
};

/** Ab diesem Baujahr hat ein Haus noch eine lange Lebensdauer (Tim, 20. November). */
export const JUNG_AB = 1970;

/**
 * Welcher Anteil am Erlös für den Flächenwert gilt, und unter welchem Feld
 * der Annahmen er steht. Ältere Häuser nur in der Stadt Zürich (Julian,
 * 20. November); Häuser ab 1970 überall (Tim, am selben Tag). Ohne beides:
 * kein Flächenwert.
 */
export function flaechenAnteil(e: Pick<CalcEingabe, 'kanton' | 'umfeld' | 'annahmen'>, baujahr: number | null | undefined): { anteil: number; feld: 'bestandAnteil' | 'bestandAnteilJung' } | null {
  const a = e.annahmen;
  if (baujahr != null && baujahr >= JUNG_AB) return { anteil: a.bestandAnteilJung ?? CALC_ANNAHMEN.bestandAnteilJung!, feld: 'bestandAnteilJung' };
  if (inStadtZuerich(e)) return { anteil: a.bestandAnteil ?? CALC_ANNAHMEN.bestandAnteil!, feld: 'bestandAnteil' };
  return null;
}

/**
 * Die Hauptnutzfläche nach Julians Praxisformel, mit der Objekte
 * tatsächlich beurteilt werden (Migration 20260904120000, potential.ts):
 *
 *   Grundstück × Ausnützung ÷ Vollgeschosse × (Vollgeschosse + 0.66) × 0.77
 *
 * Das Attikageschoss zählt 0.66 eines Vollgeschosses, ausser die Zone
 * verbietet Dachgeschosse ausdrücklich. Eine Baumassenziffer wird über die
 * Geschosshöhe zur Ausnützung. Ohne Ziffer oder Vollgeschosse: null.
 */
export interface Praxis { hnf: number; az: number; vg: number; attika: number; text: string }
export function hnfPraxis(flaeche: number, zone: ZonenRegeln | null, a: Pick<Annahmen, 'geschosshoehe' | 'hnfFaktor' | 'dachFaktor'>): Praxis | null {
  const vg = pos(zone?.vollgeschosse);
  const az = pos(zone?.az) ?? (pos(zone?.bmz) ? zone!.bmz! / a.geschosshoehe : null);
  if (!(flaeche > 0) || !vg || !az) return null;
  const attika = zone!.dachgeschosse === 0 ? 0 : a.dachFaktor;
  const ziffer = pos(zone!.az) ? `AZ ${de(az, 2)}` : `BMZ ${de(zone!.bmz!, 2)} ÷ ${de(a.geschosshoehe, 1)} m`;
  return {
    hnf: (flaeche * az / vg) * (vg + attika) * a.hnfFaktor, az, vg, attika,
    text: `${m2(flaeche)} × ${ziffer} ÷ ${de(vg)} VG × ${de(vg + attika, 2)} × ${de(a.hnfFaktor, 2)}`,
  };
}

/** «Parzelle 3947» oder «Parzellen 3947, 4903 und 4902». */
export function parzellenText(teile: { nummer: string | null }[]): string {
  const nr = teile.map(t => t.nummer ?? 'ohne Nummer');
  if (nr.length === 1) return teile[0].nummer ? `Parzelle ${teile[0].nummer}` : 'der Nachbarparzelle';
  return `Parzellen ${nr.slice(0, -1).join(', ')} und ${nr[nr.length - 1]}`;
}

/** Eine Nachbarparzelle, die man dazukaufen kann. */
export interface NachbarTeil { egrid: string; nummer: string | null; flaeche: number; zone: ZonenRegeln | null; gebaeude: Gebaeude[] }

/**
 * Wie ein Nachbar gerechnet wird. Mit eigener Ziffer nach der Praxisformel.
 * Nennt seine Bauzone Geschosse, aber keine Ziffer, mit der Dichte der
 * Hauptparzelle (Nutzfläche je m² Land). Ohne Bauzone gar nicht.
 *
 * Julian, 17. November, Zürich Aussersihl: alle sechs Nachbarn gesperrt
 * («keine Bauzone mit Ziffer»). Nachgesehen im Zonenplan des Kantons: die
 * Quartiererhaltungszone QI/5a nennt fünf Vollgeschosse und verweist für
 * alles Weitere auf die Bauordnung -- eine Bauzone, nur ohne Ziffer. Die
 * QIII daneben nennt nicht einmal Geschosse.
 */
export type NachbarArt = 'ziffer' | 'dichte' | 'keine';
export function nachbarArt(flaeche: number, zone: ZonenRegeln | null, a: Pick<Annahmen, 'geschosshoehe' | 'hnfFaktor' | 'dachFaktor'>): NachbarArt {
  // Schulhaus, Strasse, Wald: auch mit Ziffer nichts zum Dazukaufen.
  if (!(flaeche > 0) || !zone || zone.bauzone === false) return 'keine';
  if (hnfPraxis(flaeche, zone, a)) return 'ziffer';
  // Ob Bauzone, sagt der Zonenplan; wo die Angabe fehlt (ältere Entwürfe), die Geschosse.
  return zone.bauzone ?? pos(zone.vollgeschosse) != null ? 'dichte' : 'keine';
}

/**
 * Mit Nachbarn zusammen (Julian, 16. November: «Parzelle nebenan, wenn
 * man kaufen kann: dazukaufen, besseres Angebot»). Die Regel: der Nachbar
 * bekommt, was seine Parzelle allein wert ist; was die gemeinsame Rechnung
 * darüber hinaus hergibt, steht für diese Parzelle zur Verfügung.
 */
export interface Zusammen {
  teile: {
    egrid: string; nummer: string | null; flaeche: number; hnf: number | null; wertAllein: number;
    /** Die Zone nennt keine Ziffer: gerechnet mit der Dichte der Hauptparzelle. */
    geliehen?: boolean;
  }[];
  /** Nutzfläche je m² Land der Hauptparzelle -- gesetzt, wenn ein Nachbar damit gerechnet ist. */
  dichte?: number | null;
  flaeche: number; hnfOhneBonus: number; bonus: number; hnf: number; abbruch: number;
  landwert: number; nachbarWert: number; fuerUns: number; mehr: number; lohnt: boolean; empfehlung: number | null;
}

/**
 * Baukosten je m² Nutzfläche, inklusive Nebenkosten, nach dem Verkaufspreis:
 * wer teurer verkauft, baut teurer aus. Julian, 16. November: unter 15'000
 * je m² Verkaufspreis rund 6'000, darüber 7'000, über 20'000 8'000, über
 * 25'000 9'000 -- «triff etwas exaktere Annahmen in diesen Preisranges».
 * Darum keine Treppe, sondern eine Gerade durch die Mitte jeder Stufe
 * (12'500 → 6'000, 17'500 → 7'000, 22'500 → 8'000, 27'500 → 9'000),
 * unten bei 6'000 und oben bei 9'000 begrenzt.
 */
export function baukostenNachErloes(erloes: number): number {
  return Math.round(Math.min(9000, Math.max(6000, 6000 + (erloes - 12500) * 0.2)) / 50) * 50;
}

/**
 * Am Hang baut man teurer (Julian: «Hanglagen sind 10/20 % teurer»).
 * Neigung in Prozent aus dem Geländemodell des Bundes. Wo der Hang
 * beginnt, ist eine Annahme: ab 10 % Steigung +10 %, ab 20 % +20 %.
 */
export function hangZuschlag(neigung: number | null | undefined): number {
  if (neigung == null || !Number.isFinite(neigung)) return 0;
  return neigung >= 20 ? 0.2 : neigung >= 10 ? 0.1 : 0;
}

/** Zürich HB in Landeskoordinaten (Suchdienst des Bundes, 16. November). */
export const ZUERICH_HB: [number, number] = [2683190, 1248066];
/**
 * «Die Nähe an Zürich ist ebenfalls teurer» (Julian). Wie viel, hat er
 * nicht gesagt; angenommen: +10 % am Hauptbahnhof, gleichmässig weniger
 * bis 0 % in 25 km Entfernung.
 */
export function zuerichZuschlag(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return 0;
  return Math.round(0.1 * Math.max(0, 1 - km / 25) * 1000) / 1000;
}
export const zuerichKm = (e: number, n: number) => Math.hypot(e - ZUERICH_HB[0], n - ZUERICH_HB[1]) / 1000;

/**
 * Julian, 18. November, am Projekt YOMORI (Wallisellerstrasse 9, Kloten):
 * «Bei Projekten unter 10 Mio. Baukosten sind die Baukosten 30 % höher.»
 * Ein kleiner Bau trägt Planung, Baustelle und Erschliessung auf wenig
 * Fläche. Gemessen wird an den Baukosten vor diesem Zuschlag. YOMORI:
 * 724 m² für CHF 5.5 Mio., also CHF 7'600 je m²; die Preisstufe ergab
 * dort CHF 6'410, mit Zuschlag CHF 8'330.
 */
export function kleinZuschlag(baukosten: number, a: Partial<Pick<CalcAnnahmen, 'klein' | 'kleinGrenze'>> = CALC_ANNAHMEN): number {
  // Eine Kalkulation von vor dem 18. November kennt die Felder nicht: dann gilt die Vorgabe.
  const grenze = a.kleinGrenze ?? CALC_ANNAHMEN.kleinGrenze, zuschlag = a.klein ?? CALC_ANNAHMEN.klein;
  return baukosten > 0 && baukosten < grenze ? zuschlag : 0;
}

/** Eine Wohnung aus einem Inserat: Fläche in m² und Netto-Miete im Monat. */
export interface Vergleich { flaeche: number; miete: number }
/** Eine Eigentumswohnung aus einem Inserat: Fläche in m² und Kaufpreis. */
export interface Kauf { flaeche: number; preis: number }

/**
 * Woher der Erlös je m² stammt. Er ist der grösste Hebel der Rechnung:
 * am 16. November rechnete die Hochweidstrasse 9 in Kilchberg mit
 * CHF 9'500, wo neue Wohnungen über CHF 20'000 je m² kosten.
 */
export interface ErloesQuelle {
  art: 'annahme' | 'amtlich' | 'berechnet' | 'angabe' | 'hand' | 'inserate' | 'land';
  text: string;
  /** Warum diese Zahl: Satz für Satz aus den Preisen der letzten Jahre (lib/preis-herleitung). */
  begruendung?: string[];
  verlauf?: VerlaufZeile[];
  spanne?: [number, number] | null;
  spalten?: Spalten;
}
export type { VerlaufZeile };
export const ERLOES_ANNAHME: ErloesQuelle = { art: 'annahme', text: 'Annahme, nicht für diesen Ort gemessen' };

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
  /**
   * Netto-Miete im Monat je Wohnung (Schlüssel: Wohnung.id), aus dem
   * Mieterspiegel des Eigentümers oder aus einem Inserat dieser Adresse.
   * Tim, 20. November: «Anzahl Wohnungen, deren Grösse und die inserierten Preise».
   */
  wohnungMiete?: Record<string, number>;
  /** Was Kaufinserate in der Nachbarschaft verlangen, von Hand übertragen. */
  kaeufe?: Kauf[];
  /**
   * Die Zahlen eines bekannten Projekts (Pläne, Bauentscheid, Angebot des
   * Bauherrn). Sie gehen Formel und Register vor (Julian, 18. November, am
   * Projekt YOMORI: 724 m² Nutzfläche, CHF 5.5 Mio. Baukosten).
   * Nutzfläche in m²; Baukosten in CHF gesamt, ohne Abbruch, mit allen
   * Zuschlägen: sie ersetzen Preisstufe, Hang, Nähe zu Zürich und Grösse.
   */
  projektHnf?: number | null;
  projektBaukosten?: number | null;
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
  /** Steigung des Geländes in Prozent (Geländemodell des Bundes). */
  neigung?: number | null;
  /** Luftlinie zum Zürcher Hauptbahnhof, km. */
  zuerichKm?: number | null;
}

export interface CalcEingabe {
  /** Nachbarparzellen, die man dazukaufen kann. */
  nachbarn?: NachbarTeil[];
  grundlage: Omit<Eingabe, 'annahmen'>;
  annahmen: CalcAnnahmen;
  kanton: string | null;
  hand: VonHand;
  umfeld: Umfeld;
  /** Das laufende Jahr -- nur für die Tests eine Eingabe. */
  jahr?: number;
  /** Woher der Erlös stammt; ohne Angabe eine Annahme. */
  erloesQuelle?: ErloesQuelle;
  /**
   * Nutzfläche je m² Land, geliehen von der Hauptparzelle: nur für einen
   * Nachbarn, dessen Bauzone keine Ziffer nennt (nachbarArt).
   */
  dichte?: number | null;
  /**
   * Was auf der Parzelle geplant, bewilligt oder im Bau ist (Gebäuderegister).
   * Ist es bewilligt oder im Bau, rechnet der Neubau mit seiner Wohnfläche
   * statt mit der Formel (Julian, 18. November).
   */
  projekt?: Projekt | null;
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
  /** Wie die Nutzfläche gerechnet ist: bewilligtes Projekt, Praxisformel, sonst Machbarkeit (Hülle). */
  hnfText: string;
  /** Gerechnet mit der Wohnfläche eines bewilligten Projekts (Gebäuderegister). */
  projekt: boolean;
  /** Gerechnet mit den Zahlen eines Projekts, von Hand eingegeben. */
  projektHand: boolean;
  /** Was die Formel ohne Projekt ergäbe, m² Nutzfläche. */
  hnfFormel: number;
  /** Baukosten je m² Nutzfläche mit Zuschlägen, und woraus sie bestehen. */
  baukostenJeM2: number;
  kosten: Kosten;
}

/** Die Baukosten je m² Nutzfläche und woraus sie bestehen. */
export interface Kosten { grund: number; hang: number; zuerich: number; klein: number; jeM2: number; vonHand: boolean }

/** Ein Neubau mit Mietwohnungen: was ein Anleger dafür zahlt, und was für das Land bleibt. */
export interface NeubauMiete {
  hnf: number;
  /** CHF je m² und Monat, und woher. */
  miete: number; mieteQuelle: string;
  ertrag: number; wert: number;
  baukosten: number; baukostenJeM2: number; abbruch: number; gewinn: number;
  landwert: number; jeM2: number;
}

export interface Bestand {
  wohnungen: number | null;
  baujahr: number | null;
  /** Vermietbare Fläche, m². */
  flaeche: number | null;
  /**
   * hand: eingegeben. register: Summe der Wohnungen im Gebäuderegister.
   * fussabdruck: geschätzt. gemischt: Haus mit Gewerbe, aus dem Fussabdruck,
   * weil das Register nur die Wohnungen führt.
   */
  flaecheArt: 'hand' | 'register' | 'fussabdruck' | 'gemischt' | null;
  /** Die Wohnungen laut Register, m²; bei «gemischt» der Teil der Fläche, der Wohnung ist. */
  flaecheWohnungen: number | null;
  /** Der Mieterspiegel: jede Wohnung mit Fläche und Miete, und woher die Miete stammt. */
  spiegel: SpiegelZeile[];
  /** CHF je m² und Monat. */
  mieteHeute: number | null;
  /** ertrag: Jahresertrag eingegeben. spiegel: Mieten je Wohnung eingegeben. hand: Miete je m² eingegeben. statistik: Durchschnitt des Kantons. */
  mieteArt: 'ertrag' | 'spiegel' | 'hand' | 'statistik';
  mieteQuelle: string;
  ertragHeute: number;
  /** Das Höhere aus Ertragswert und Flächenwert. */
  wert: number;
  /** Ertrag ÷ Rendite. */
  wertMiete: number;
  /** Fläche × Wert je m² (Tim, 20. November); null ohne Fläche oder Anteil. */
  wertFlaeche: number | null;
  /** CHF je m² vermietbare Fläche, für den Flächenwert. */
  jeM2: number | null;
  /** Welcher der beiden zählt. */
  wertArt: 'miete' | 'flaeche';
  /** Median der Inserate, CHF je m² und Monat; null ohne Inserate. */
  marktmiete: number | null;
  vergleiche: number;
  ertragMarkt: number | null;
  wertMarkt: number | null;
}

export interface SpiegelZeile {
  id: string; nr: string | null; geschoss: string | null; zimmer: number | null; flaeche: number | null;
  /** Netto-Miete im Monat, CHF; null ohne Fläche und ohne Eingabe. */
  miete: number | null;
  /** eingabe: Mieterspiegel oder Inserat. sonst: Fläche mal Miete je m². */
  quelle: 'eingabe' | 'gerechnet';
}

export interface Bewertung {
  studie: Studie;
  neubau: Neubau | null;
  neubauMiete: NeubauMiete | null;
  bestand: Bestand | null;
  /** Welche der drei Bewertungen den Preis bestimmt. */
  massgebend: 'neubau' | 'miete' | 'bestand' | null;
  wert: number | null;
  /** Wert minus Abschlag, auf 10'000 abgerundet; mit Nachbarn, wenn das mehr bringt. */
  empfehlung: number | null;
  /** Die Empfehlung für diese Parzelle allein. */
  empfehlungAllein: number | null;
  zusammen: Zusammen | null;
  /** Woher jede Zahl stammt: die Abschnitte der Machbarkeit und die Praxisformel. */
  herkunft: { titel: string; zeilen: Posten[] }[];
  /**
   * Der Massstab des Marktes: die Fläche zum Median dessen, was in der
   * Gemeinde für Wohnbauland bezahlt wurde (amtlich, nur ZH und BL).
   */
  landMarkt: { jeM2: number; wert: number } | null;
  erloesQuelle: ErloesQuelle;
  /**
   * Der Erlös je m² Nutzfläche, bei dem für dieses Grundstück genau der
   * Median dessen bleibt, was in der Gemeinde für Bauland bezahlt wurde.
   * Ein Abgleich mit dem Markt, auf 100 gerundet; null ohne amtlichen Landpreis.
   */
  erloesLand: number | null;
  /** Median der Kaufinserate je m²; null ohne Inserate. */
  erloesInserate: number | null;
  kaeufe: number;
  chancen: string[];
  risiken: string[];
}

/** Die Stadt Zürich, nicht der Kanton: die Gemeinde heisst in den amtlichen Preisen wie im Register «Zürich». */
export const inStadtZuerich = (e: Pick<CalcEingabe, 'kanton' | 'umfeld'>): boolean =>
  e.kanton === 'ZH' && (e.umfeld?.gemeinde ?? '').trim().toLowerCase() === 'zürich';

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
    rechtsstatus: zone?.rechtsstatus ?? null, dokument: zone?.dokument ?? null, quelle: 'hand', bauzone: zone?.bauzone ?? null,
  };
}

export function bewerten(e: CalcEingabe): Bewertung {
  const a = e.annahmen, u = e.umfeld, g = e.grundlage;
  const zone = zoneMitHand(g.zone, e.hand);
  const studie = studieRechnen({ ...g, zone, annahmen: a });
  const flaeche = studie.flaeche;
  const ort = u.gemeinde || 'der Gemeinde';
  // Nutzfläche nach der Praxisformel; nur wo die Zone keine Ziffer nennt,
  // die Machbarkeit mit Hülle und Grenzabständen.
  const bauzone = pos(g.bauzoneM2) && g.bauzoneM2! < flaeche * 0.98 ? g.bauzoneM2! : flaeche;
  const praxis = hnfPraxis(bauzone, zone, a);
  // Ein Nachbar ohne eigene Ziffer und ohne Umriss: die Dichte der Hauptparzelle.
  const geliehen = !praxis && !studie.rechenbar && pos(e.dichte) && nachbarArt(flaeche, zone, a) === 'dichte' ? flaeche * e.dichte! : null;
  // Ein bewilligtes Projekt hat seine eigenen Zahlen: sie gelten vor jeder Formel.
  const projekt = projektZaehlt(e.projekt) ? e.projekt : null;
  // Zahlen eines Projekts von Hand gehen allem vor: sie stammen aus den Plänen.
  const handHnf = pos(e.hand.projektHnf), handKosten = pos(e.hand.projektBaukosten);
  const formelHnf = praxis?.hnf ?? (studie.rechenbar ? studie.hnfNeu : geliehen ?? 0);
  const rechenbar = !!handHnf || !!projekt || !!praxis || studie.rechenbar || geliehen != null;
  const hnf = handHnf ?? (projekt ? projekt.wohnflaeche : formelHnf);
  const gf = handHnf || projekt ? hnf / a.hnfFaktor : praxis ? praxis.hnf / a.hnfFaktor : studie.rechenbar ? studie.gfNeu : (geliehen ?? 0) / a.hnfFaktor;
  const wohnungenNeu = !handHnf && projekt && projekt.wohnungen ? projekt.wohnungen : Math.floor(hnf / a.wohnungM2);

  // ---- Neubau: was für das Land bleibt
  const zuschlag = (1 + hangZuschlag(u.neigung)) * (1 + zuerichZuschlag(u.zuerichKm));
  // Je m² Nutzfläche, für eine Nutzfläche nf: ob ein Projekt klein ist, hängt an seiner Grösse.
  const kostenBei = (erloes: number, nf = hnf): Kosten => {
    if (handKosten && hnf > 0) { const je = Math.round(handKosten / hnf); return { grund: je, hang: 0, zuerich: 0, klein: 0, jeM2: je, vonHand: true }; }
    if (a.baukostenHnf) return { grund: a.baukostenHnf, hang: 0, zuerich: 0, klein: 0, jeM2: a.baukostenHnf, vonHand: true };
    const grund = baukostenNachErloes(erloes);
    const vor = grund * zuschlag, klein = kleinZuschlag(nf * vor, a);
    return { grund, hang: hangZuschlag(u.neigung), zuerich: zuerichZuschlag(u.zuerichKm), klein, jeM2: Math.round(vor * (1 + klein) / 10) * 10, vonHand: false };
  };
  const abbruch = (studie.gfBestand ?? 0) * a.abbruch;
  // Landwert = Erlös − Baukosten − Abbruch − Gewinn, alles je m² Nutzfläche.
  const landBei = (erloes: number) => hnf * (erloes * (1 - a.marge) - kostenBei(erloes).jeM2) - abbruch;
  let neubau: Neubau | null = null;
  if (rechenbar) {
    const kosten = kostenBei(a.erloes);
    const erloes = hnf * a.erloes, baukosten = handKosten ?? hnf * kosten.jeM2;
    const kubatur = gf * a.geschosshoehe;
    const landwert = erloes - baukosten - abbruch - erloes * a.marge;
    neubau = {
      gf, hnf, kubatur, wohnungen: wohnungenNeu, baukosten, abbruch, erloes, projekt: !handHnf && !!projekt, projektHand: !!handHnf, hnfFormel: formelHnf,
      hnfText: handHnf ? 'Projekt, von Hand eingegeben'
        : projekt ? `${projektSatz(projekt)} (Gebäuderegister${projekt.stand ? `, Stand ${projekt.stand}` : ''})`
        : praxis ? `Praxisformel: ${praxis.text}` : geliehen != null ? 'Annahme: dieselbe Dichte wie die Hauptparzelle' : 'Machbarkeit: Ziffer und Hülle, die engere gilt',
      gewinn: erloes * a.marge, landwert, jeM2: flaeche ? landwert / flaeche : 0,
      jeM3: kubatur > 0 ? baukosten / kubatur : 0, wohnungPreis: a.erloes * a.wohnungM2,
      baukostenJeM2: kosten.jeM2, kosten,
    };
  }

  // ---- Neubau zum Vermieten: was ein Anleger zahlt, minus Bau und Gewinn
  let neubauMiete: NeubauMiete | null = null;
  const neuMiete = median((e.hand.vergleiche ?? []).filter(v => pos(v.flaeche) && pos(v.miete)).map(v => v.miete / v.flaeche));
  const neuStatistik = mieteStatistik(e.kanton, 9999);
  if (rechenbar && pos(a.rendite) && (neuMiete || neuStatistik)) {
    const miete = neuMiete ?? neuStatistik!.wert;
    const ertrag = hnf * miete * 12, wert = ertrag / a.rendite;
    const vor = a.baukostenMiete * zuschlag;
    const baukostenJeM2 = handKosten ? Math.round(handKosten / hnf) : Math.round(vor * (1 + kleinZuschlag(hnf * vor, a)) / 10) * 10;
    const baukosten = handKosten ?? hnf * baukostenJeM2, gewinn = wert * a.marge;
    const landwert = wert - baukosten - abbruch - gewinn;
    neubauMiete = {
      hnf, miete, mieteQuelle: neuMiete ? 'Median der eingetragenen Inserate' : neuStatistik!.text,
      ertrag, wert, baukosten, baukostenJeM2, abbruch, gewinn, landwert, jeM2: flaeche ? landwert / flaeche : 0,
    };
  }

  // ---- Bestand: was das Haus mit seinen Mieten wert ist
  const haupt = [...g.gebaeude].sort((x, y) => (y.grundflaeche ?? 0) - (x.grundflaeche ?? 0))[0];
  const wohnungen = g.gebaeude.reduce((s, x) => s + (x.wohnungen ?? 0), 0) || null;
  const vergleiche = (e.hand.vergleiche ?? []).filter(v => pos(v.flaeche) && pos(v.miete));
  const ertragHand = pos(e.hand.mietertragJahr);
  const flaecheHand = pos(e.hand.wohnflaeche);
  // Die Wohnungen laut Register: ihre Fläche ist die vermietbare, genauer als jeder Fussabdruck.
  const liste = g.gebaeude.flatMap(x => x.wohnungsliste ?? []);
  const flaecheRegister = liste.length && liste.every(w => pos(w.flaeche)) ? liste.reduce((s, w) => s + w.flaeche!, 0) : null;
  const schaetzung = studie.gfBestand != null ? studie.gfBestand * a.hnfFaktor : null;
  // Ein Haus mit Gewerbe: das Register kennt nur die Wohnungen, Läden und Büros fehlen.
  const gemischt = !flaecheHand && flaecheRegister != null && schaetzung != null && schaetzung > flaecheRegister
    && g.gebaeude.some(x => x.kategorie === 1040);
  const flaecheB = flaecheHand ?? (gemischt ? schaetzung : flaecheRegister) ?? schaetzung;
  const statistik = mieteStatistik(e.kanton, haupt?.baujahr);
  const mieteHand = pos(e.hand.mieteHeute);
  const satzJeM2 = mieteHand ?? statistik?.wert ?? null;
  const eingegeben = e.hand.wohnungMiete ?? {};
  const spiegel: SpiegelZeile[] = liste.map(w => {
    const m = pos(eingegeben[w.id]);
    return { ...w, miete: m ?? (pos(w.flaeche) && satzJeM2 ? w.flaeche! * satzJeM2 : null), quelle: m ? 'eingabe' : 'gerechnet' };
  });
  const ausSpiegel = spiegel.some(z => z.quelle === 'eingabe') && spiegel.every(z => z.miete != null) && !flaecheHand
    ? spiegel.reduce((s, z) => s + z.miete!, 0) * 12 : null;
  // Bei Gewerbe im Haus kommt zum Mieterspiegel der Rest der Fläche, zur Miete je m².
  const rest = gemischt && satzJeM2 ? (flaecheB! - flaecheRegister!) * satzJeM2 * 12 : 0;
  const ertragHeute = ertragHand ?? (ausSpiegel != null ? ausSpiegel + rest : null) ?? (flaecheB && satzJeM2 ? flaecheB * satzJeM2 * 12 : null);
  // Ein Mehrfamilienhaus laut Register, oder jemand hat Mieten eingetragen.
  const vermietet = (wohnungen ?? 0) >= 3 || !!ertragHand || !!mieteHand || !!flaecheHand || vergleiche.length > 0 || ausSpiegel != null;
  let bestand: Bestand | null = null;
  if (vermietet && ertragHeute && pos(a.rendite)) {
    const marktmiete = median(vergleiche.map(v => v.miete / v.flaeche));
    const ertragMarkt = marktmiete && flaecheB ? flaecheB * marktmiete * 12 : null;
    const eingabeZahl = spiegel.filter(z => z.quelle === 'eingabe').length;
    const art: Bestand['mieteArt'] = ertragHand ? 'ertrag' : ausSpiegel ? 'spiegel' : mieteHand ? 'hand' : 'statistik';
    const wertMiete = ertragHeute / a.rendite;
    // Entwürfe von vor dem 20. November kennen den Anteil nicht: dann gilt Tims Vorgabe. 0 schaltet den Flächenwert ab.
    // Ältere Häuser nur in der Stadt Zürich, Häuser ab 1970 überall (flaechenAnteil).
    const anteil = flaechenAnteil(e, haupt?.baujahr)?.anteil ?? 0;
    const jeM2 = pos(anteil) && pos(a.erloes) ? Math.round((a.erloes * anteil!) / 100) * 100 : null;
    const wertFlaeche = jeM2 && flaecheB ? flaecheB * jeM2 : null;
    bestand = {
      wohnungen, baujahr: haupt?.baujahr ?? null, flaeche: flaecheB,
      flaecheArt: flaecheHand ? 'hand' : gemischt ? 'gemischt' : flaecheRegister ? 'register' : flaecheB ? 'fussabdruck' : null,
      flaecheWohnungen: flaecheRegister,
      spiegel,
      mieteHeute: art === 'ertrag' || art === 'spiegel' ? (flaecheB ? ertragHeute / 12 / flaecheB : null) : satzJeM2,
      mieteArt: art,
      mieteQuelle: art === 'ertrag' ? 'Mietertrag laut Eingabe'
        : art === 'spiegel' ? `${eingabeZahl} von ${spiegel.length} Wohnungen laut Eingabe${eingabeZahl < spiegel.length ? `, die übrigen mit ${mieteHand ? 'der eingegebenen Miete je m²' : statistik!.text}` : ''}${gemischt ? `; Gewerbe (${de(Math.round(flaecheB! - flaecheRegister!))} m²) mit ${mieteHand ? 'der eingegebenen Miete je m²' : statistik!.text}` : ''}`
        : art === 'hand' ? 'Miete laut Eingabe' : statistik!.text,
      ertragHeute, wert: Math.max(wertMiete, wertFlaeche ?? 0), wertMiete, wertFlaeche, jeM2,
      wertArt: wertFlaeche != null && wertFlaeche > wertMiete ? 'flaeche' : 'miete', marktmiete, vergleiche: vergleiche.length,
      ertragMarkt, wertMarkt: ertragMarkt ? ertragMarkt / a.rendite : null,
    };
  }

  // ---- die höhere Bewertung zählt
  const kandidaten = ([['neubau', neubau?.landwert], ['miete', neubauMiete?.landwert], ['bestand', bestand?.wert]] as const)
    .filter((k): k is readonly ['neubau' | 'miete' | 'bestand', number] => k[1] != null && k[1] > 0);
  const bester = kandidaten.reduce<typeof kandidaten[number] | null>((m, k) => (!m || k[1] > m[1] ? k : m), null);
  const massgebend: Bewertung['massgebend'] = bester?.[0] ?? null;
  const wert = bester?.[1] ?? null;
  // Das Land, wenn man neu baut: zum Verkaufen oder zum Vermieten, was mehr bringt.
  const wN = Math.max(neubau?.landwert ?? 0, neubauMiete?.landwert ?? 0) || null;
  const wB = bestand?.wert ?? null;
  const runden = (w: number | null) => { const r = w ? Math.floor((w * (1 - a.abschlag)) / 10000) * 10000 : 0; return r > 0 ? r : null; };
  const empfehlungAllein = runden(wert);

  // ---- mit Nachbarn zusammen
  let zusammen: Zusammen | null = null;
  const nachbarn = (e.nachbarn ?? []).filter(n => nachbarArt(n.flaeche, n.zone, a) !== 'keine');
  if (nachbarn.length && neubau && flaeche > 0) {
    // Was diese Parzelle je m² Land hergibt: damit rechnet ein Nachbar, dessen Zone keine Ziffer nennt.
    const dichte = hnf / flaeche;
    const teile = nachbarn.map(n => {
      const eigen = hnfPraxis(n.flaeche, n.zone, a)?.hnf ?? null;
      // Das Projekt gehört zu dieser Parzelle, nicht zum Nachbarn.
      const allein = bewerten({ ...e, grundlage: { flaeche: n.flaeche, bebaubarM2: null, zone: n.zone, gebaeude: n.gebaeude, registerVollstaendig: true }, hand: {}, nachbarn: [], dichte, projekt: null });
      return { egrid: n.egrid, nummer: n.nummer, flaeche: n.flaeche, hnf: eigen ?? n.flaeche * dichte, geliehen: eigen == null,
        wertAllein: allein.wert ?? 0, gfBestand: bestandGf(n.gebaeude) ?? 0 };
    });
    const flaecheZ = flaeche + teile.reduce((s, t) => s + t.flaeche, 0);
    const hnfOhneBonus = hnf + teile.reduce((s, t) => s + (t.hnf ?? 0), 0);
    const bonus = flaecheZ >= a.arealMin ? a.arealBonus : 0;
    const hnfZ = hnfOhneBonus * (1 + bonus);
    const abbruchZ = abbruch + teile.reduce((s, t) => s + t.gfBestand * a.abbruch, 0);
    // Zusammen ist das Projekt grösser: ob es noch klein ist, entscheidet seine eigene Grösse.
    const jeM2Z = neubau.kosten.vonHand ? neubau.baukostenJeM2 : kostenBei(a.erloes, hnfZ).jeM2;
    const landwert = hnfZ * (a.erloes * (1 - a.marge) - jeM2Z) - abbruchZ;
    const nachbarWert = teile.reduce((s, t) => s + t.wertAllein, 0);
    const fuerUns = landwert - nachbarWert;
    const mehr = fuerUns - (wert ?? 0);
    zusammen = {
      teile: teile.map(({ gfBestand: _, ...t }) => t), dichte: teile.some(t => t.geliehen) ? dichte : null,
      flaeche: flaecheZ, hnfOhneBonus, bonus, hnf: hnfZ, abbruch: abbruchZ,
      // Erst ab CHF 10'000 mehr zählt es als besseres Angebot, nicht wegen Rundung.
      landwert, nachbarWert, fuerUns, mehr, lohnt: mehr >= 10000, empfehlung: runden(fuerUns),
    };
  }
  // Dazukaufen zählt nur, wenn es dieser Parzelle mehr bringt als allein.
  const empfehlung = zusammen?.lohnt && (zusammen.empfehlung ?? 0) > (empfehlungAllein ?? 0) ? zusammen.empfehlung : empfehlungAllein;

  // ---- der Erlös am Markt gemessen
  const erloesQuelle = e.erloesQuelle ?? ERLOES_ANNAHME;
  const kaeufe = (e.hand.kaeufe ?? []).filter(k => pos(k.flaeche) && pos(k.preis));
  const erloesInserate = median(kaeufe.map(k => k.preis / k.flaeche));
  // Der Erlös, bei dem genau der Landpreis der Gemeinde bleibt. Die
  // Baukosten steigen mit dem Erlös; darum gesucht statt umgestellt.
  let erloesLand: number | null = null;
  if (u.land && neubau && neubau.hnf > 0) {
    const ziel = u.land.m * flaeche;
    let lo = 2000, hi = 80000;
    if (landBei(hi) >= ziel && landBei(lo) <= ziel) {
      for (let i = 0; i < 40; i++) { const mitte = (lo + hi) / 2; if (landBei(mitte) < ziel) lo = mitte; else hi = mitte; }
      erloesLand = Math.round(hi / 100) * 100;
    }
  }

  // ---- Chancen und Risiken: jeder Satz mit seiner Zahl
  const chancen: string[] = [], risiken: string[] = [];
  const jahr = e.jahr ?? new Date().getFullYear();
  const registerStand = e.projekt?.stand ? `, Stand ${e.projekt.stand}` : '';
  if (handHnf) {
    chancen.push(`Gerechnet mit den Zahlen des Projekts, von Hand eingegeben: ${m2(handHnf)} Nutzfläche${handKosten ? `, ${chf(handKosten)} Baukosten` : ''}${formelHnf > 0 ? `; die Formel ergäbe ${m2(formelHnf)}` : ''}.`);
  } else if (projekt) {
    chancen.push(`${satz(projektSatz(projekt))} Gerechnet ist mit diesem Projekt (Gebäuderegister${registerStand})${formelHnf > 0 ? `; die Formel ergäbe ${m2(formelHnf)} Nutzfläche` : ''}.`);
  } else if (e.projekt) {
    // Eingereicht, aber nicht bewilligt: es kann noch scheitern, darum rechnet die Formel.
    risiken.push(`${satz(projektSatz(e.projekt))} So plant der Eigentümer selbst (Gebäuderegister${registerStand}); gerechnet ist nach der Formel${formelHnf > 0 ? ` mit ${m2(formelHnf)} Nutzfläche` : ''}.`);
  }

  if (neubau) {
    const unbebaut = studie.gfBestand == null && g.gebaeude.length === 0 && g.registerVollstaendig !== false;
    if (unbebaut) chancen.push('Unbebaut: kein Abbruch und keine Mieter.');
    else if (studie.ausgenuetzt != null && studie.ausgenuetzt < 0.7 && studie.reserve) {
      chancen.push(`Erst ${prozent(studie.ausgenuetzt)} % ausgenützt: ${m2(studie.reserve)} Geschossfläche sind noch frei.`);
    }
    if (u.land) {
      const je = Math.round(neubau.jeM2 / 10) * 10;
      // Welcher Erlös zum bezahlten Landpreis passt: das macht die Abweichung handhabbar.
      const passt = erloesLand ? ` Zum Landpreis passt ein Erlös um CHF ${de(erloesLand)} je m² Nutzfläche, gerechnet ist mit CHF ${de(a.erloes)}.` : '';
      if (neubau.jeM2 > (u.land.q75 ?? u.land.m) * 1.25) {
        risiken.push(`Der Landwert von CHF ${de(je)} je m² liegt deutlich über dem, was in ${ort} für Bauland bezahlt wird (Median CHF ${de(u.land.m)}): Erlös und Baukosten prüfen.${passt}`);
      } else if (neubau.jeM2 < (u.land.q25 ?? u.land.m) * 0.75) {
        risiken.push(`In ${ort} wird für Bauland mehr bezahlt (Median CHF ${de(u.land.m)} je m²), als die Rechnung hergibt (CHF ${de(je)}): zu diesem Preis verkauft kaum jemand.${passt}`);
      } else {
        chancen.push(`Der Landwert von CHF ${de(je)} je m² liegt im Rahmen dessen, was in ${ort} für Bauland bezahlt wird (Median CHF ${de(u.land.m)}).`);
      }
    }
    if (u.stwe) {
      const p = neubau.wohnungPreis;
      if (u.stwe.q75 && p > u.stwe.q75) {
        risiken.push(`Die Rechnung verkauft eine Wohnung von ${de(a.wohnungM2)} m² für ${chf(p)}. Drei Viertel der Eigentumswohnungen in ${ort} gingen für weniger als ${chf(u.stwe.q75)} weg.`);
      } else if (u.stwe.q25 && p < u.stwe.q25) {
        // Die Statistik nennt den Preis je Wohnung, nicht ihre Grösse: darum kein Schluss auf den Preis je m².
        chancen.push(`${satz(`Tief gerechnet: eine Wohnung von ${de(a.wohnungM2)} m² kostet hier ${chf(p)}`)} Drei Viertel der Eigentumswohnungen in ${ort} gingen für mehr als ${chf(u.stwe.q25)} weg; wie gross sie waren, sagt die Statistik nicht.`);
      } else if (p <= u.stwe.m) {
        chancen.push(satz(`Vorsichtig gerechnet: eine Wohnung von ${de(a.wohnungM2)} m² für ${chf(p)}, der Median in ${ort} liegt bei ${chf(u.stwe.m)}`));
      }
    }
    if (neubau.landwert <= 0) risiken.push('Mit diesen Annahmen bleibt nach Baukosten und Gewinn nichts für das Land.');
    if (!projekt && studie.begrenzt === 'huelle') {
      risiken.push(`Die Grenzabstände begrenzen das Volumen, nicht die Ziffer: gerechnet mit ${de(a.grenzabstand, 1)} m rundum, die Bauordnung kann mehr verlangen.`);
    }
    if (!projekt && g.bebaubarM2 == null) risiken.push('Ohne Umriss gerechnet: ob das Volumen zwischen den Grenzabständen Platz hat, ist offen.');
    if (zone?.quelle === 'hand') risiken.push('Ziffer oder Geschosse sind von Hand eingegeben: in der Bauordnung nachsehen.');
    else if (zone?.quelle === 'bestand') risiken.push('Die Zone stammt aus der eigenen Liste, nicht aus dem amtlichen Zonenplan.');
    if (!projekt && !studie.ziffer) risiken.push('Die Zone nennt keine Ziffer: es entscheiden Gestaltungsvorschriften und der Einzelfall.');
    if (!projekt && studie.ausgenuetzt != null && studie.ausgenuetzt > 1) risiken.push('Der Bestand ist grösser als heute erlaubt: ein Neubau fiele kleiner aus.');
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
    const wie = bestand?.wertArt === 'flaeche' ? 'nach seiner Fläche' : 'mit den heutigen Mieten';
    if (wN > wB) chancen.push(`Als Bauland ist die Liegenschaft ${chf(wN - wB)} mehr wert als ${wie}.`);
    else risiken.push(`${wie[0].toUpperCase()}${wie.slice(1)} ist das Haus ${chf(wB - wN)} mehr wert als das Land: ein Abbruch lohnt sich nicht.`);
  }
  if (neubau && erloesQuelle.art === 'annahme' && !u.land) {
    risiken.push(`Der Erlös von CHF ${de(a.erloes)} je m² ist eine Annahme, nicht für diesen Ort gemessen: zwei, drei Kaufinserate eintragen.`);
  }
  if (erloesInserate && Math.abs(erloesInserate / a.erloes - 1) > 0.15) {
    risiken.push(`Die Kaufinserate verlangen CHF ${de(Math.round(erloesInserate / 100) * 100)} je m², gerechnet ist mit CHF ${de(a.erloes)}.`);
  }
  // Die Praxisformel kennt keine Grenzabstände. Sind sie enger, steht es hier.
  if (!projekt && praxis && studie.rechenbar && studie.begrenzt === 'huelle' && studie.hnfNeu < praxis.hnf * 0.9) {
    risiken.push(`Mit ${de(a.grenzabstand, 1)} m Grenzabstand rundum haben nur ${m2(studie.hnfNeu)} Nutzfläche Platz; gerechnet ist nach der Praxisformel mit ${m2(praxis.hnf)}.`);
  }
  if (zusammen) {
    const wer = parzellenText(zusammen.teile);
    const verkauft = zusammen.teile.length === 1 ? 'der Nachbar zu seinem eigenen Wert verkauft' : 'die Nachbarn je zu ihrem eigenen Wert verkaufen';
    const areal = zusammen.bonus > 0 ? `, mit Arealüberbauung (+${prozent(zusammen.bonus)} % ab ${m2(a.arealMin)})` : '';
    if (zusammen.lohnt) chancen.push(`Mit ${wer} dazugekauft: ${chf(zusammen.mehr)} mehr für diese Parzelle${areal}, wenn ${verkauft}.`);
    else risiken.push(`Mit ${wer} dazugekauft bleibt für diese Parzelle nicht mehr als allein${zusammen.bonus > 0 ? '' : ` (gemeinsam ${m2(zusammen.flaeche)}, eine Arealüberbauung gilt hier erst ab ${m2(a.arealMin)})`}.`);
    const ohne = zusammen.teile.filter(t => t.geliehen);
    if (ohne.length && zusammen.dichte) {
      const fuer = ohne.length === 1 ? (ohne[0].nummer ? `Parzelle ${ohne[0].nummer}` : 'die Nachbarparzelle') : parzellenText(ohne);
      risiken.push(`Für ${fuer} nennt die Zone keine Ziffer: gerechnet mit der Dichte dieser Parzelle (${de(zusammen.dichte, 2)} m² Nutzfläche je m² Land), eine Annahme.`);
    }
  }
  if (neubau && !neubau.kosten.vonHand && neubau.kosten.klein > 0) {
    risiken.push(`Kleines Projekt: unter ${chf(a.kleinGrenze ?? CALC_ANNAHMEN.kleinGrenze)} Baukosten, darum ${prozent(neubau.kosten.klein)} % teurer gerechnet (Planung und Baustelle auf wenig Fläche).`);
  }
  if (neubau && !neubau.kosten.vonHand && neubau.kosten.hang > 0) {
    risiken.push(`Hanglage: das Gelände steigt um ${de(Math.round(u.neigung!))} %, die Baukosten sind ${prozent(neubau.kosten.hang)} % höher gerechnet.`);
  }
  if (u.denkmal) risiken.push('Denkmalschutz ist eingetragen: Abbruch und Umbau sind eingeschränkt.');
  if (u.isos) risiken.push('Ortsbild von nationaler Bedeutung (ISOS): Neubauten werden streng beurteilt.');
  if ((u.belastet ?? 0) > 0) risiken.push('Im Kataster der belasteten Standorte eingetragen: Untersuchung und Entsorgung einrechnen.');
  if (wohnungen != null && wohnungen <= 2 && u.efh && empfehlung != null && u.efh.m > empfehlung) {
    risiken.push(`Einfamilienhäuser in ${ort} gehen im Median für ${chf(u.efh.m)} weg: liegt das Angebot darunter, verkauft der Eigentümer eher an eine Familie.`);
  }

  const landMarkt = u.land && flaeche ? { jeM2: u.land.m, wert: u.land.m * flaeche } : null;
  // ---- jede Zahl mit ihrer Herkunft: die Machbarkeit, dazu die Praxisformel
  const amtlich = zone?.quelle === 'kanton' ? 'amtlich' : 'annahme';
  const herkunft: Bewertung['herkunft'] = [
    ...(handHnf ? [{ titel: 'Projekt, von Hand eingegeben', zeilen: [
      // Drei Arten kennt die Herkunft (amtlich, berechnet, Annahme): eine Zahl von Hand ist keine amtliche.
      { titel: 'Nutzfläche', wert: m2(handHnf), art: 'annahme' as const, quelle: 'von Hand, aus Plänen oder Angaben des Bauherrn' },
      ...(handKosten ? [{ titel: 'Baukosten', wert: chf(handKosten), art: 'annahme' as const, quelle: 'von Hand, ohne Abbruch, mit allen Zuschlägen' }] : []),
    ] }] : []),
    ...(e.projekt ? [{ titel: `${e.projekt.status === 'projektiert' ? 'Eingereichtes' : e.projekt.status === 'im Bau' ? 'Begonnenes' : 'Bewilligtes'} Projekt (Gebäuderegister)`, zeilen: [
      { titel: 'Stand', wert: e.projekt.status, art: 'amtlich' as const, quelle: `Gebäuderegister des Bundes${registerStand}` },
      { titel: 'Neubauten mit Wohnungen', wert: de(e.projekt.gebaeude), art: 'amtlich' as const, quelle: 'Gebäuderegister' },
      { titel: 'Wohnungen', wert: de(e.projekt.wohnungen), art: 'amtlich' as const, quelle: 'Gebäuderegister' },
      ...(e.projekt.wohnflaeche ? [{ titel: 'Wohnfläche', wert: m2(e.projekt.wohnflaeche), art: 'amtlich' as const, quelle: 'Summe der Wohnungsflächen im Register' }] : []),
      ...(e.projekt.geschosse ? [{ titel: 'Geschosse', wert: de(e.projekt.geschosse), art: 'amtlich' as const, quelle: 'Gebäuderegister' }] : []),
    ] }] : []),
    ...studie.abschnitte.map(s => (s.titel === 'Was Platz hat'
      ? { titel: 'Was zwischen den Grenzabständen Platz hat (Machbarkeit)', zeilen: s.zeilen.filter(z => z.titel !== 'Wohnungen') }
      : s)),
    ...(praxis ? [{ titel: 'Hauptnutzfläche nach Praxisformel (gerechnet)', zeilen: [
      { titel: 'Grundstück in der Bauzone', wert: m2(bauzone), art: 'amtlich' as const, quelle: 'Amtliche Vermessung' },
      { titel: pos(zone?.az) ? 'Ausnützungsziffer' : 'Ausnützung aus Baumassenziffer', wert: de(praxis.az, 2), art: amtlich as Posten['art'],
        quelle: pos(zone?.az) ? 'Zone' : `BMZ ${de(zone!.bmz!, 2)} ÷ ${de(a.geschosshoehe, 1)} m Geschosshöhe` },
      { titel: 'Vollgeschosse', wert: de(praxis.vg), art: amtlich as Posten['art'], quelle: 'Zone' },
      { titel: 'Attika', wert: praxis.attika ? `${de(praxis.attika, 2)} Vollgeschoss` : 'keines', art: 'annahme' as const,
        quelle: praxis.attika ? 'Praxisformel' : 'die Zone erlaubt kein Dachgeschoss' },
      { titel: 'Hauptnutzfläche', wert: m2(praxis.hnf), art: 'berechnet' as const, quelle: praxis.text },
      { titel: 'Wohnungen', wert: `rund ${de(Math.floor(praxis.hnf / a.wohnungM2))}`, art: 'annahme' as const, quelle: `je ${de(a.wohnungM2)} m² Hauptnutzfläche` },
    ] }] : []),
  ];

  return { studie, neubau, neubauMiete, bestand, massgebend, wert, empfehlung, empfehlungAllein, zusammen, herkunft, landMarkt, erloesQuelle, erloesLand, erloesInserate, kaeufe: kaeufe.length, chancen, risiken };
}

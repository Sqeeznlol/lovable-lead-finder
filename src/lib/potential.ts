/**
 * Potenzial- und Investitionsrechnung für Liegenschaften (Kanton ZH).
 *
 * Ziel: Die Vorauswahl soll nicht mehr von Hand gemacht werden müssen. Aus den
 * Daten, die bereits in der Master-Liste stehen (Zone, Grundstücksfläche,
 * Gebäudefläche, Geschosse, Baujahr), wird automatisch berechnet:
 *
 *   1. Wie viel anrechenbare Geschossfläche (aGF) die Zone erlaubt
 *   2. Wie viel davon der Bestand heute nutzt
 *   3. Wie gross die ungenutzte Reserve ist (absolut in m² und als Quote)
 *   4. Was ein Ausbau/Ersatzneubau grob kostet und einbringt
 *
 * Alle Annahmen (AZ pro Zone, HNF-Faktor, Baukosten, Erlös) sind Parameter mit
 * konservativen Defaults — sie lassen sich zentral in den App-Settings ändern,
 * ohne dass Code angefasst werden muss.
 *
 * WICHTIG: Das ist eine Grobabschätzung für die Priorisierung, kein Ersatz für
 * die Bau- und Zonenordnung der Gemeinde. Deshalb liefert jede Berechnung
 * `confidence` und `assumptions` mit, damit im UI sichtbar ist, worauf die
 * Zahl beruht.
 */

/** Ausnützungsziffer (AZ) pro Zone — Defaults für ZH, wenn die BZO-Ziffer fehlt. */
export const DEFAULT_AZ_BY_ZONE: Record<string, number> = {
  W: 0.35,
  W2: 0.45, W2G: 0.5,
  W3: 0.6, W3G: 0.65,
  W4: 0.75, W4G: 0.8,
  W5: 0.9,
  W6: 1.1,
  W7: 1.3,
  WG: 0.55, WG2: 0.55, WG3: 0.7, WG4: 0.85,
  K: 1.0, Z: 0.8,
};

/** Zulässige Vollgeschosse pro Zone (Ableitung, falls AZ fehlt). */
export const DEFAULT_GESCHOSSE_BY_ZONE: Record<string, number> = {
  W: 2, W2: 2, W2G: 2, W3: 3, W3G: 3, W4: 4, W4G: 4, W5: 5, W6: 6, W7: 7,
  WG: 2, WG2: 2, WG3: 3, WG4: 4, K: 4, Z: 3,
};

/**
 * Zonen-Bezeichnungen der ZH-Listen sind Freitext, nicht "W3":
 *   "Wohnzone 1.6 (rechtskräftig, 8460m², 95%)"   -> Ziffer 1.6
 *   "3-geschossige Wohnzone 2.5"                  -> 3 Geschosse, Ziffer 2.5
 *   "Wohnzone 2/50"                               -> 2 Geschosse, ÜZ 50%
 *   "Kantonale Landwirtschaftszone" / "Wald"      -> keine Bauzone
 *
 * Der Parser holt aus dem Text heraus, was verwertbar ist.
 */
export interface ParsedZone {
  /** Ziffer aus dem Zonennamen (je nach Gemeinde AZ oder BMZ — siehe zifferAlsBmz). */
  ziffer: number | null;
  /** Zulässige Vollgeschosse, wenn im Namen genannt. */
  geschosse: number | null;
  /** Überbauungsziffer in Prozent, z.B. "Wohnzone 2/50". */
  ueberbauungsziffer: number | null;
  /** Kurzform wie W3, falls ableitbar. */
  kurz: string | null;
  /** Nicht bebaubar (Landwirtschaft, Wald, Freihaltung, Gewässer). */
  keineBauzone: boolean;
  /** Bebaubar, aber ohne Wohnnutzung (Gewerbe, Industrie, öffentliche Bauten). */
  keineWohnnutzung: boolean;
}

// "Wald" bewusst nur als eigenständiges Wort: es gibt die Gemeinde Wald (ZH)
// und Flurnamen wie "Waldegg", die keine Waldzone sind.
const NICHT_BAUZONE = /landwirtschaftszone|\bwald\b|waldzone|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone/i;

/**
 * Zonen, in denen kein Wohnraum entstehen kann.
 *
 * Das Geschäft besteht darin, Eigentümer zum Verkauf zu bewegen, das Objekt
 * neu zu erstellen und teurer zu verkaufen oder zu vermieten. Wo die Zone
 * keine Wohnnutzung zulässt, geht das nicht -- die Objekte gehören deshalb
 * gar nicht erst in die Arbeitsliste, auch wenn dort baulich Reserve läge.
 */
const KEINE_WOHNNUTZUNG = /gewerbezone|industriezone|arbeitszone|(zone f(ü|ue)r )?(ö|oe)ffentliche(n)? (bauten|zwecke)|(ö|oe)ffentliche bauten/i;

export function parseZone(raw?: string | null): ParsedZone {
  const leer: ParsedZone = {
    ziffer: null, geschosse: null, ueberbauungsziffer: null, kurz: null,
    keineBauzone: false, keineWohnnutzung: false,
  };
  if (!raw) return leer;

  // Klammerzusatz "(rechtskräftig, 8460m², 95%)" enthält Flächenangaben der
  // Zone selbst, nicht des Grundstücks — vor dem Parsen entfernen.
  const text = String(raw).replace(/\([^)]*\)/g, ' ').trim();
  if (NICHT_BAUZONE.test(text)) return { ...leer, keineBauzone: true };
  if (KEINE_WOHNNUTZUNG.test(text)) return { ...leer, keineWohnnutzung: true };

  // Bereits normierte Kurzform ("W3", "W4G")
  const kurzMatch = text.toUpperCase().replace(/\s+/g, '').match(/^([WKZ]{1,2}G?\d?G?)$/);
  if (kurzMatch) return { ...leer, kurz: kurzMatch[1] };

  let geschosse: number | null = null;
  let ueberbauungsziffer: number | null = null;
  let ziffer: number | null = null;

  // "3-geschossige Wohnzone" / "Wohnzone 3-geschossig"
  const geschossMatch = text.match(/(\d+)\s*-?\s*geschossig/i);
  if (geschossMatch) geschosse = Number(geschossMatch[1]);

  // "Wohnzone 2/50" -> 2 Geschosse, 50% Überbauung
  const slashMatch = text.match(/(\d+)\s*\/\s*(\d{2,3})/);
  if (slashMatch) {
    geschosse = geschosse ?? Number(slashMatch[1]);
    ueberbauungsziffer = Number(slashMatch[2]);
  } else {
    // Dezimalziffer im Namen: "Wohnzone 1.6", "Wohnzone G 2.9"
    const zifferMatch = text.match(/(\d+[.,]\d+)/);
    if (zifferMatch) ziffer = Number(zifferMatch[1].replace(',', '.'));
  }

  return { ziffer, geschosse, ueberbauungsziffer, kurz: null, keineBauzone: false, keineWohnnutzung: false };
}

/** Textfelder wie "nicht vorhanden" / "Kein Denkmalschutzobjekt..." bedeuten: kein Eintrag. */
export function istVorhanden(v?: string | null): boolean {
  if (!v) return false;
  const t = String(v).trim().toLowerCase();
  if (t === '' || t === 'none' || t === 'null' || t === '-') return false;
  return !/^(nicht vorhanden|kein|keine|nein|no|n\/a)/.test(t);
}

export interface PotentialConfig {
  /** AZ-Tabelle pro Zone. */
  azByZone: Record<string, number>;
  /**
   * Anteil HNF an der Geschossfläche — zieht Konstruktion, Treppen und
   * Verkehrsflächen ab. 0.77 ist der Erfahrungswert aus unseren Projekten.
   */
  hnfFaktor: number;
  /**
   * Attikageschoss zählt nicht als volles Geschoss: es bringt nur 0.66 der
   * Fläche eines Vollgeschosses, ist aber zusätzlich anrechenbar.
   */
  attikaFaktor: number;
  /** Ob über den Vollgeschossen ein Attikageschoss angenommen wird. */
  mitAttika: boolean;
  /** Baukosten pro m² neu erstellter Geschossfläche, CHF. */
  baukostenProM2GF: number;
  /** Erzielbarer Erlös pro m² HNF (Verkauf), CHF. */
  erloesProM2HNF: number;
  /** Reserve unter diesem Wert (m² aGF) gilt als nicht verwertbar. */
  minReserveM2: number;
  /** Reserve-Quote, ab der ein Objekt als klar interessant gilt (0–1). */
  zielReserveQuote: number;
  /**
   * Wie die Ziffer im Zonennamen ("Wohnzone 1.6") zu lesen ist:
   * true  = Baumassenziffer m³/m² (in vielen ZH-Gemeinden üblich)
   * false = Ausnützungsziffer
   */
  zifferAlsBmz: boolean;
  /** Mittlere Geschosshöhe in m — rechnet BMZ in Geschossfläche um. */
  geschosshoehe: number;
}

export const DEFAULT_POTENTIAL_CONFIG: PotentialConfig = {
  azByZone: DEFAULT_AZ_BY_ZONE,
  hnfFaktor: 0.77,
  attikaFaktor: 0.66,
  mitAttika: true,
  baukostenProM2GF: 3200,
  erloesProM2HNF: 9500,
  minReserveM2: 80,
  zielReserveQuote: 0.35,
  zifferAlsBmz: true,
  geschosshoehe: 3.2,
};

/** Minimal-Interface — passt auf `properties`-Zeilen, ohne den DB-Typ zu importieren. */
export interface PotentialInput {
  zone?: string | null;
  ausnuetzung?: number | string | null;
  area?: number | string | null;
  gebaeudeflaeche?: number | string | null;
  geschosse?: number | string | null;
  vollgeschosse?: number | string | null;
  baujahr?: number | null;
  renovationsjahr?: number | null;
  denkmalschutz?: string | null;
  isos?: string | null;
  wohnungen?: number | string | null;
}

export type Confidence = 'hoch' | 'mittel' | 'tief' | 'keine';

export interface PotentialResult {
  /** Verwendete Ausnützungsziffer. */
  az: number | null;
  /** Woher die AZ stammt. */
  azQuelle: 'objekt' | 'zone' | 'geschosse' | null;
  /** Zulässige anrechenbare Geschossfläche in m². */
  gfZulaessig: number | null;
  /** Heute genutzte Geschossfläche in m² (Gebäudefläche × Geschosse). */
  gfBestand: number | null;
  /** Ungenutzte Reserve in m² aGF (nie negativ). */
  reserveGf: number | null;
  /** Reserve / zulässige aGF, 0–1. */
  reserveQuote: number | null;
  /** Ob der Bestand die Zone bereits überschreitet (Besitzstand). */
  ueberbaut: boolean;
  /** Zulässige Vollgeschosse, die der HNF-Rechnung zugrunde liegen. */
  vollgeschosse: number | null;
  /** Anrechenbare Geschosse total, inkl. Attika-Anteil. */
  anrechenbareGeschosse: number | null;
  hnfBestand: number | null;
  hnfNeu: number | null;
  hnfDelta: number | null;
  /** Grobe Investitionssumme für die Reserve, CHF. */
  investition: number | null;
  /** Grober Erlös aus der zusätzlichen HNF, CHF. */
  erloes: number | null;
  /** Erlös − Investition, CHF. */
  marge: number | null;
  /** Marge / Investition, 0–1. */
  margeQuote: number | null;
  confidence: Confidence;
  assumptions: string[];
  killer: string[];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


/** Ausnützungsziffer bestimmen — Objektwert vor Zonenziffer vor Zonentabelle. */
export function resolveAz(
  p: PotentialInput,
  cfg: PotentialConfig = DEFAULT_POTENTIAL_CONFIG,
): { az: number | null; quelle: PotentialResult['azQuelle']; parsed: ParsedZone } {
  const parsed = parseZone(p.zone);

  // Nicht bebaubar oder ohne Wohnnutzung -> gar keine Ausnützung
  if (parsed.keineBauzone || parsed.keineWohnnutzung) return { az: null, quelle: null, parsed };

  const own = num(p.ausnuetzung);
  if (own && own > 0 && own < 5) return { az: own, quelle: 'objekt', parsed };

  // Ziffer aus dem Zonennamen ("Wohnzone 1.6")
  if (parsed.ziffer != null && parsed.ziffer > 0) {
    const az = cfg.zifferAlsBmz ? parsed.ziffer / cfg.geschosshoehe : parsed.ziffer;
    return { az, quelle: 'zone', parsed };
  }

  // "Wohnzone 2/50": Geschosse x Überbauungsziffer
  if (parsed.geschosse && parsed.ueberbauungsziffer) {
    return { az: parsed.geschosse * (parsed.ueberbauungsziffer / 100), quelle: 'zone', parsed };
  }

  // Kurzform W3 aus der Zonentabelle
  if (parsed.kurz && cfg.azByZone[parsed.kurz] != null) {
    return { az: cfg.azByZone[parsed.kurz], quelle: 'zone', parsed };
  }

  // Nur Geschosszahl bekannt -> konservativ 30% Überbauung annehmen
  if (parsed.geschosse) {
    return { az: parsed.geschosse * 0.3, quelle: 'geschosse', parsed };
  }
  if (parsed.kurz && DEFAULT_GESCHOSSE_BY_ZONE[parsed.kurz] != null) {
    return { az: DEFAULT_GESCHOSSE_BY_ZONE[parsed.kurz] * 0.3, quelle: 'geschosse', parsed };
  }

  return { az: null, quelle: null, parsed };
}

export function calculatePotential(
  p: PotentialInput,
  cfg: PotentialConfig = DEFAULT_POTENTIAL_CONFIG,
): PotentialResult {
  const assumptions: string[] = [];
  const killer: string[] = [];

  const area = num(p.area);
  const gebFlaeche = num(p.gebaeudeflaeche);
  const geschosse = num(p.geschosse) ?? num(p.vollgeschosse);
  const { az, quelle, parsed } = resolveAz(p, cfg);

  if (parsed.keineBauzone) killer.push('Keine Bauzone');
  if (parsed.keineWohnnutzung) killer.push('Keine Wohnnutzung');
  if (quelle === 'zone') {
    assumptions.push(
      parsed.ziffer != null && cfg.zifferAlsBmz
        ? `AZ ${az?.toFixed(2)} aus BMZ ${parsed.ziffer} ÷ ${cfg.geschosshoehe} m Geschosshöhe`
        : `AZ ${az?.toFixed(2)} aus Zonenangabe`,
    );
  }
  if (quelle === 'geschosse') assumptions.push(`AZ ${az?.toFixed(2)} aus zulässigen Vollgeschossen geschätzt`);
  if (quelle === 'objekt') assumptions.push(`AZ ${az} aus Objektdaten`);

  const gfZulaessig = az != null && area != null ? area * az : null;

  let gfBestand: number | null = null;
  if (gebFlaeche != null) {
    if (geschosse != null && geschosse > 0) {
      gfBestand = gebFlaeche * geschosse;
    } else {
      // Ohne Geschossangabe konservativ 2 Vollgeschosse annehmen.
      gfBestand = gebFlaeche * 2;
      assumptions.push('Geschosse unbekannt — 2 Vollgeschosse angenommen');
    }
  }

  const rawReserve = gfZulaessig != null && gfBestand != null ? gfZulaessig - gfBestand : null;
  const ueberbaut = rawReserve != null && rawReserve < 0;
  const reserveGf = rawReserve != null ? Math.max(rawReserve, 0) : null;
  const reserveQuote = reserveGf != null && gfZulaessig ? reserveGf / gfZulaessig : null;

  // HNF nach der Praxisformel:
  //   Grundstück x Ausnutzung / Anzahl VG x (Anzahl VG + anrechenbare) x 0.77
  // Die Division durch die Vollgeschosse ergibt die Fläche eines Geschosses;
  // die Multiplikation mit (VG + Attika-Anteil) zählt das zusätzlich
  // anrechenbare Attikageschoss dazu, das nur 0.66 eines Vollgeschosses bringt.
  const vgZulaessig = parsed.geschosse ?? geschosse ?? 2;
  if (parsed.geschosse == null) {
    assumptions.push(
      geschosse != null
        ? `${geschosse} Vollgeschosse aus dem Bestand übernommen (Zone nennt keine)`
        : 'Vollgeschosse unbekannt — 2 angenommen',
    );
  }
  const anrechenbareGeschosse = vgZulaessig + (cfg.mitAttika ? cfg.attikaFaktor : 0);
  if (cfg.mitAttika) {
    assumptions.push(`Attika als ${cfg.attikaFaktor} Vollgeschoss angerechnet`);
  }

  const hnfBestand = gfBestand != null ? gfBestand * cfg.hnfFaktor : null;
  const hnfNeu =
    gfZulaessig != null && vgZulaessig > 0
      ? (gfZulaessig / vgZulaessig) * anrechenbareGeschosse * cfg.hnfFaktor
      : null;
  const hnfDelta = hnfNeu != null && hnfBestand != null ? Math.max(hnfNeu - hnfBestand, 0) : null;

  const investition = reserveGf != null ? reserveGf * cfg.baukostenProM2GF : null;
  const erloes = hnfDelta != null ? hnfDelta * cfg.erloesProM2HNF : null;
  const marge = erloes != null && investition != null ? erloes - investition : null;
  const margeQuote = marge != null && investition ? marge / investition : null;

  // Die Listen schreiben "nicht vorhanden" statt leer — Text auswerten, nicht
  // bloss auf "gefüllt" prüfen, sonst gilt jedes Objekt als geschützt.
  if (istVorhanden(p.denkmalschutz)) killer.push('Denkmalschutz');
  if (istVorhanden(p.isos)) killer.push('ISOS-Ortsbild');
  if (reserveGf != null && reserveGf < cfg.minReserveM2) killer.push(`Reserve < ${cfg.minReserveM2} m²`);
  if (ueberbaut) killer.push('Bestand überschreitet Zone (Besitzstand)');

  let confidence: Confidence = 'keine';
  if (gfZulaessig != null && gfBestand != null) {
    if (quelle === 'objekt' && geschosse != null) confidence = 'hoch';
    else if (quelle === 'zone' && geschosse != null) confidence = 'mittel';
    else confidence = 'tief';
  }

  const round = (v: number | null, d = 0) =>
    v == null ? null : Math.round(v * 10 ** d) / 10 ** d;

  return {
    az,
    azQuelle: quelle,
    gfZulaessig: round(gfZulaessig),
    gfBestand: round(gfBestand),
    reserveGf: round(reserveGf),
    reserveQuote: round(reserveQuote, 3),
    ueberbaut,
    vollgeschosse: vgZulaessig,
    anrechenbareGeschosse: round(anrechenbareGeschosse, 2),
    hnfBestand: round(hnfBestand),
    hnfNeu: round(hnfNeu),
    hnfDelta: round(hnfDelta),
    investition: round(investition),
    erloes: round(erloes),
    marge: round(marge),
    margeQuote: round(margeQuote, 3),
    confidence,
    assumptions,
    killer,
  };
}

/**
 * Potenzial-Score 0–100. Leitgrösse ist die zusätzlich erreichbare HNF —
 * je mehr verkaufbare Fläche ein Objekt hergibt, desto interessanter.
 *
 *   HNF-Zuwachs absolut  0–40 Pt.   (Deckel bei 1200 m² HNF)
 *   HNF-Zuwachs relativ  0–25 Pt.   (Verdoppelung = voll)
 *   Marge-Quote          0–15 Pt.
 *   Baujahr/Alter        0–15 Pt.   (alt = eher Ersatzneubau)
 *   Zonenqualität        0–5 Pt.
 *   Killer               −25 Pt. je Killer
 */
export function potentialScore(
  p: PotentialInput,
  cfg: PotentialConfig = DEFAULT_POTENTIAL_CONFIG,
  pre?: PotentialResult,
): number {
  const r = pre ?? calculatePotential(p, cfg);
  if (r.hnfDelta == null) return 0;

  let score = Math.min(r.hnfDelta / 1200, 1) * 40;

  // Relativer Zuwachs: 1000 m² mehr auf einem kleinen Bestand wiegen schwerer
  // als dieselben 1000 m² auf einem bereits grossen Haus.
  const relativ = r.hnfBestand && r.hnfBestand > 0 ? r.hnfDelta / r.hnfBestand : 1;
  score += Math.min(relativ, 1) * 25;

  score += Math.min(Math.max(r.margeQuote ?? 0, 0) / 0.5, 1) * 15;

  const bj = p.renovationsjahr ?? p.baujahr;
  if (bj) {
    if (bj <= 1930) score += 15;
    else if (bj <= 1960) score += 12;
    else if (bj <= 1975) score += 8;
    else if (bj <= 1990) score += 4;
  }

  score += Math.min((r.az ?? 0) / 1.3, 1) * 5;
  score -= r.killer.length * 25;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Harte Ausschlusskriterien: Objekte, die gar nicht erst in die Liste gehören.
 * Landwirtschaftszone/Wald und geschützte Objekte lassen sich nicht kaufen und
 * weiterentwickeln — sie werden ausgefiltert, nicht bloss schlechter bewertet.
 */
export function istAusgeschlossen(p: PotentialInput): boolean {
  const z = parseZone(p.zone);
  return z.keineBauzone || z.keineWohnnutzung || istVorhanden(p.denkmalschutz);
}

/** Grund des Ausschlusses, für die Anzeige. */
export function ausschlussGrund(p: PotentialInput): string | null {
  const z = parseZone(p.zone);
  if (z.keineBauzone) return 'Keine Bauzone';
  if (z.keineWohnnutzung) return 'Keine Wohnnutzung';
  if (istVorhanden(p.denkmalschutz)) return 'Denkmalschutz';
  return null;
}

export function potentialTier(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}

export function formatChf(v: number | null | undefined): string {
  if (v == null) return '—';
  return `CHF ${Math.round(v).toLocaleString('de-CH')}`;
}

export function formatM2(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v).toLocaleString('de-CH')} m²`;
}

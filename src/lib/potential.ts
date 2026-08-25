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

export interface PotentialConfig {
  /** AZ-Tabelle pro Zone. */
  azByZone: Record<string, number>;
  /** Anteil HNF an anrechenbarer Geschossfläche (Verkehrsflächen/Konstruktion abgezogen). */
  hnfFaktor: number;
  /** Baukosten pro m² neu erstellter Geschossfläche, CHF. */
  baukostenProM2GF: number;
  /** Erzielbarer Erlös pro m² HNF (Verkauf), CHF. */
  erloesProM2HNF: number;
  /** Reserve unter diesem Wert (m² aGF) gilt als nicht verwertbar. */
  minReserveM2: number;
  /** Reserve-Quote, ab der ein Objekt als klar interessant gilt (0–1). */
  zielReserveQuote: number;
}

export const DEFAULT_POTENTIAL_CONFIG: PotentialConfig = {
  azByZone: DEFAULT_AZ_BY_ZONE,
  hnfFaktor: 0.8,
  baukostenProM2GF: 3200,
  erloesProM2HNF: 9500,
  minReserveM2: 80,
  zielReserveQuote: 0.35,
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

function normZone(zone?: string | null): string | null {
  if (!zone) return null;
  // "W3 (2 Vollgeschosse)" -> "W3", "w4g" -> "W4G"
  const m = String(zone).toUpperCase().replace(/\s+/g, '').match(/^([WKZ]{1,2}G?\d?G?)/);
  return m ? m[1] : String(zone).toUpperCase().trim();
}

/** Ausnützungsziffer bestimmen — Objektwert vor Zonentabelle vor Geschoss-Heuristik. */
export function resolveAz(
  p: PotentialInput,
  cfg: PotentialConfig = DEFAULT_POTENTIAL_CONFIG,
): { az: number | null; quelle: PotentialResult['azQuelle'] } {
  const own = num(p.ausnuetzung);
  if (own && own > 0 && own < 5) return { az: own, quelle: 'objekt' };

  const zone = normZone(p.zone);
  if (zone && cfg.azByZone[zone] != null) return { az: cfg.azByZone[zone], quelle: 'zone' };

  // Fallback: aus zulässigen Vollgeschossen der Zone eine AZ ableiten
  // (Annahme: rund 30% Überbauungsziffer pro Geschoss).
  if (zone && DEFAULT_GESCHOSSE_BY_ZONE[zone] != null) {
    return { az: DEFAULT_GESCHOSSE_BY_ZONE[zone] * 0.3, quelle: 'geschosse' };
  }
  return { az: null, quelle: null };
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
  const { az, quelle } = resolveAz(p, cfg);

  if (quelle === 'zone') assumptions.push(`AZ ${az} aus Zonentabelle (${normZone(p.zone)})`);
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

  const hnfBestand = gfBestand != null ? gfBestand * cfg.hnfFaktor : null;
  const hnfNeu = gfZulaessig != null ? gfZulaessig * cfg.hnfFaktor : null;
  const hnfDelta = hnfNeu != null && hnfBestand != null ? Math.max(hnfNeu - hnfBestand, 0) : null;

  const investition = reserveGf != null ? reserveGf * cfg.baukostenProM2GF : null;
  const erloes = hnfDelta != null ? hnfDelta * cfg.erloesProM2HNF : null;
  const marge = erloes != null && investition != null ? erloes - investition : null;
  const margeQuote = marge != null && investition ? marge / investition : null;

  if (p.denkmalschutz && String(p.denkmalschutz).trim() !== '') killer.push('Denkmalschutz');
  if (p.isos && String(p.isos).trim() !== '') killer.push('ISOS-Ortsbild');
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
 * Potenzial-Score 0–100 — ersetzt das reine "gross = gut" des alten Deal-Scores
 * durch "viel ungenutzte Reserve = gut".
 *
 *   Reserve absolut   0–35 Pt.   (Deckel bei 1500 m² aGF)
 *   Reserve-Quote     0–30 Pt.
 *   Marge-Quote       0–15 Pt.
 *   Baujahr/Alter     0–15 Pt.   (alt = eher Ersatzneubau)
 *   Zonenqualität     0–5 Pt.
 *   Killer            −25 Pt. je Killer
 */
export function potentialScore(
  p: PotentialInput,
  cfg: PotentialConfig = DEFAULT_POTENTIAL_CONFIG,
  pre?: PotentialResult,
): number {
  const r = pre ?? calculatePotential(p, cfg);
  if (r.reserveGf == null) return 0;

  let score = Math.min(r.reserveGf / 1500, 1) * 35;
  score += Math.min((r.reserveQuote ?? 0) / cfg.zielReserveQuote, 1) * 30;
  score += Math.min(Math.max(r.margeQuote ?? 0, 0) / 0.5, 1) * 15;

  const bj = p.renovationsjahr ?? p.baujahr;
  if (bj) {
    if (bj <= 1930) score += 15;
    else if (bj <= 1960) score += 12;
    else if (bj <= 1975) score += 8;
    else if (bj <= 1990) score += 4;
  }

  const az = r.az ?? 0;
  score += Math.min(az / 1.3, 1) * 5;

  score -= r.killer.length * 25;

  return Math.max(0, Math.min(100, Math.round(score)));
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

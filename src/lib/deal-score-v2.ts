/**
 * deal-score-v2.ts — Bewertung "Lohnt sich Kauf + Ersatzneubau?"
 *
 * Grundthese, die V1 verletzt:
 *   Der Wert eines Objekts für uns steckt NICHT im Bestand, sondern in der
 *   AUSNUTZUNGSRESERVE = (Grundstücksfläche × zulässige AZ) − bereits gebaute Geschossfläche.
 *   Ein kleines altes Haus auf grosser Parzelle in W3 ist Gold.
 *   Ein grosses neues MFH auf kleiner Parzelle in W2 ist wertlos.
 *
 * V1 vergibt 25 Punkte für GROSSE Gebäudefläche → belohnt exakt die Objekte,
 * bei denen das Potenzial bereits verbaut ist. Das ist der Hauptfehler.
 *
 * Keine Imports ausser zone-config → läuft überall (Browser, Node, Deno, Worker).
 */

import {
  resolveAZ,
  normalizeZone,
  isBauzone,
  lageFaktor,
  berechneHNF,
  berechneBestandHNF,
  getProfil,
  type Dachtyp,
} from './zone-config';

export const SCORE_VERSION = 3;

/** Minimal-Interface — passt auf `Tables<'properties'>`, aber ohne Supabase-Abhängigkeit. */
export interface ScoreInput {
  id?: string;
  egrid?: string | null;
  area?: number | null;              // Grundstücksfläche m²
  gebaeudeflaeche?: number | null;   // Gebäudegrundfläche (Footprint) m²
  hnf_schaetzung?: number | null;    // Hauptnutzfläche m² (aus Master-Import)
  wohnflaeche?: number | null;
  nutzflaeche?: number | null;
  geschosse?: number | null;
  wohnungen?: number | null;
  baujahr?: number | null;
  renovationsjahr?: number | null;
  zone?: string | null;
  gemeinde?: string | null;
  ausnuetzung?: number | null;
  denkmalschutz?: string | null;
  isos?: string | null;
  geb_status?: string | null;
  kategorie?: string | null;
  gebaeudeart?: string | null;
  owner_name?: string | null;
  /** Optional: überschreibt die Annahme 'Attika' */
  dachtyp?: Dachtyp;
}

export interface ScoreResult {
  score: number;                 // 0–100
  tier: 'A' | 'B' | 'C' | 'D' | 'X';
  hnfNeu: number;                // realisierbare HNF nach Ersatzneubau m²
  hnfBestand: number;            // heutige HNF m²
  hnfDelta: number;              // Zugewinn m² — DIE Kennzahl
  hnfFaktor: number;             // hnfNeu / hnfBestand
  reserveGF: number;             // Alias hnfDelta (Rückwärtskompatibilität)
  reserveQuote: number;          // 0–1
  zulaessigeGF: number;          // gesamte Geschossfläche inkl. UG/Attika
  bestandGF: number;
  vg: number;
  az: number;
  azQuelle: string;
  dataQuality: number;           // 0–1 — wie verlässlich ist der Score?
  killers: string[];             // wenn nicht leer → Score = 0, NICHT abfragen
  reasons: string[];             // menschenlesbare Begründung (für UI + Vertrauen)
  parts: Record<string, number>; // Punkte pro Kriterium (Debug/Tuning)
  version: number;
}

/** Tuning-Parameter an einem Ort. Kannst du später aus der DB laden. */
export const SCORE_CONFIG = {
  /** Unter diesem HNF-Zugewinn lohnt sich kein Projekt → Killer */
  minHnfDelta: 120,
  /** Ab diesem HNF-Zugewinn volle Punktzahl */
  hnfDeltaVoll: 500,
  /** Default-Dachtyp für die Neubau-Annahme */
  dachtyp: 'attika' as Dachtyp,
  /** Parzelle zu klein für Ersatzneubau */
  minArea: 300,
  /** Über so vielen Wohnungen: StWEG-Wahrscheinlichkeit hoch → praktisch unkaufbar */
  maxWohnungen: 12,
  /** Neubauten fassen wir nicht an */
  maxBaujahr: 2005,
  /** Kürzlich saniert = Eigentümer verkauft nicht / Restwert zu hoch */
  renovationSperrjahre: 15,
  gewichte: {
    hnfDelta: 35,
    hnfFaktor: 15,
    abbruchreife: 20,
    parzelle: 10,
    eigentuemer: 10,
    lage: 10,
  },
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function calculateDealScoreV2(p: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  const killers: string[] = [];
  const parts: Record<string, number> = {};

  const zone = normalizeZone(p.zone);
  const area = num(p.area);
  const baujahr = num(p.baujahr);
  const wohnungen = num(p.wohnungen);

  // ---------- Datenqualität ----------
  const felder = [area > 0, !!zone, baujahr > 0, num(p.gebaeudeflaeche) > 0 || num(p.hnf_schaetzung) > 0];
  const dataQuality = felder.filter(Boolean).length / felder.length;

  // ---------- AUSSCHLUSSKRITERIEN (Killer) ----------
  if (p.geb_status && p.geb_status !== 'Bestehend') {
    killers.push(`Gebäudestatus "${p.geb_status}"`);
  }
  if (!isBauzone(zone)) {
    killers.push(zone ? `Zone ${zone} ist keine Wohn-/Bauzone` : 'Zone unbekannt');
  }
  if (p.denkmalschutz && p.denkmalschutz.trim() !== '' && p.denkmalschutz.toLowerCase() !== 'nein') {
    killers.push('Denkmalschutz / Inventar');
  }
  if (p.isos && p.isos.trim() !== '' && /^(a|A)/.test(p.isos.trim())) {
    killers.push('ISOS-Ortsbildschutz Kategorie A');
  }
  if (baujahr > SCORE_CONFIG.maxBaujahr) {
    killers.push(`Neubau (${baujahr})`);
  }
  const renov = num(p.renovationsjahr);
  if (renov > 0 && new Date().getFullYear() - renov < SCORE_CONFIG.renovationSperrjahre) {
    killers.push(`Saniert ${renov}`);
  }
  if (area > 0 && area < SCORE_CONFIG.minArea) {
    killers.push(`Parzelle nur ${Math.round(area)} m²`);
  }
  if (wohnungen > SCORE_CONFIG.maxWohnungen) {
    killers.push(`${wohnungen} Wohnungen → StWEG-Risiko`);
  }

  // ---------- HNF-Berechnung ----------
  //   HNF = area × AZ / VG × (VG + anrechenbare) × 0.77
  //   anrechenbare = UG + Attika×0.66  (oder DG×1.0 bei Schrägdach)
  const { az, quelle: azQuelle } = resolveAZ(p.zone, p.gemeinde, p.ausnuetzung);

  const neu = berechneHNF({
    area,
    az,
    zone: p.zone,
    vg: undefined,                       // aus Zonenprofil
    dachtyp: p.dachtyp ?? SCORE_CONFIG.dachtyp,
  });

  const { hnf: hnfBestand, quelle: bestandQuelle } = berechneBestandHNF(p);

  const hnfNeu = neu.hnf;
  const hnfDelta = Math.max(0, hnfNeu - hnfBestand);
  const hnfFaktorRel = hnfBestand > 0 ? hnfNeu / hnfBestand : hnfNeu > 0 ? 99 : 0;
  const reserveQuote = hnfNeu > 0 ? clamp01(hnfDelta / hnfNeu) : 0;

  if (az > 0 && area > 0 && hnfBestand > 0 && hnfDelta < SCORE_CONFIG.minHnfDelta) {
    killers.push(`Nur +${Math.round(hnfDelta)} m² HNF — bereits ausgenutzt`);
  }

  if (killers.length > 0) {
    return {
      score: 0, tier: 'X',
      hnfNeu: Math.round(hnfNeu), hnfBestand: Math.round(hnfBestand),
      hnfDelta: Math.round(hnfDelta), hnfFaktor: Number(hnfFaktorRel.toFixed(2)),
      reserveGF: Math.round(hnfDelta), reserveQuote,
      zulaessigeGF: Math.round(neu.gesamtGF), bestandGF: Math.round(hnfBestand),
      vg: neu.vg, az, azQuelle, dataQuality, killers,
      reasons: [`Ausgeschlossen: ${killers.join(', ')}`],
      parts, version: SCORE_VERSION,
    };
  }

  const G = SCORE_CONFIG.gewichte;

  // ---------- 1. HNF-Zugewinn absolut (35) ----------
  // Wurzelkurve: die ersten 150 m² zählen überproportional, danach abflachend.
  const rAbs = clamp01(Math.sqrt(hnfDelta / SCORE_CONFIG.hnfDeltaVoll));
  parts.hnfDelta = rAbs * G.hnfDelta;
  if (hnfDelta > 0) {
    reasons.push(
      `+${Math.round(hnfDelta)} m² HNF (neu ${Math.round(hnfNeu)} m² vs. Bestand ${Math.round(hnfBestand)} m²)`,
    );
    reasons.push(
      `AZ ${az.toFixed(2)} (${azQuelle}) · ${neu.vg} VG + ${neu.anrechenbare.toFixed(2)} anrechenbar → ×${neu.multiplikator.toFixed(2)}`,
    );
  }

  // ---------- 2. HNF-Faktor / Hebel (15) ----------
  // Faktor 2.0 = Verdopplung der verkaufbaren Fläche = volle Punkte
  const hebel = clamp01((hnfFaktorRel - 1) / 1.0);
  parts.hnfFaktor = hebel * G.hnfFaktor;
  if (hnfFaktorRel > 1.4 && hnfFaktorRel < 90) {
    reasons.push(`${hnfFaktorRel.toFixed(1)}× mehr HNF als heute (Bestand aus ${bestandQuelle})`);
  }

  // ---------- 3. Abbruchreife (20) ----------
  // Ziel: Bestand soll wertlos sein, aber KEIN Schutzobjekt.
  let bj = 0;
  if (baujahr === 0) {
    bj = 0.4; // unbekannt → neutral-negativ
    reasons.push('Baujahr unbekannt');
  } else if (baujahr < 1920) {
    bj = 0.25; reasons.push(`Baujahr ${baujahr} — Schutz-/Inventarrisiko`);
  } else if (baujahr <= 1945) {
    bj = 0.55;
  } else if (baujahr <= 1960) {
    bj = 0.85; reasons.push(`Baujahr ${baujahr} — Nachkriegsbau, abbruchreif`);
  } else if (baujahr <= 1980) {
    bj = 1.0; reasons.push(`Baujahr ${baujahr} — Ersatzneubau-Klassiker`);
  } else if (baujahr <= 1995) {
    bj = 0.6;
  } else {
    bj = 0.25;
  }
  parts.abbruchreife = bj * G.abbruchreife;

  // ---------- 4. Parzellengrösse / Machbarkeit (10) ----------
  let pz: number;
  if (area === 0) pz = 0.3;
  else if (area < 500) pz = 0.4;
  else if (area < 800) pz = 0.75;
  else if (area <= 3000) pz = 1.0;
  else if (area <= 6000) pz = 0.8;
  else pz = 0.65; // gross = Gestaltungsplanpflicht, aber Arealüberbauung mit AZ-Bonus möglich
  parts.parzelle = pz * G.parzelle;
  if (area >= 6000) reasons.push(`${Math.round(area)} m² — Arealüberbauung möglich (AZ-Bonus prüfen)`);

  // ---------- 5. Eigentümerstruktur / Kaufbarkeit (10) ----------
  let et: number;
  if (wohnungen === 0) et = 0.7;
  else if (wohnungen <= 2) et = 1.0;
  else if (wohnungen <= 4) et = 0.85;
  else if (wohnungen <= 8) et = 0.5;
  else et = 0.25;
  const owner = (p.owner_name || '').toLowerCase();
  if (/erbengemeinschaft|erben\b/.test(owner)) { et = Math.min(1, et + 0.25); reasons.push('Erbengemeinschaft — hohe Verkaufsbereitschaft'); }
  if (/\b(stadt|gemeinde|kanton|schweizerische eidgenossenschaft|sbb)\b/.test(owner)) { et = 0.05; reasons.push('Öffentliche Hand — verkauft praktisch nie'); }
  if (/pensionskasse|vorsorge|stiftung|immobilien ag|anlagestiftung/.test(owner)) { et = Math.min(et, 0.3); reasons.push('Institutioneller Eigentümer'); }
  parts.eigentuemer = et * G.eigentuemer;

  // ---------- 6. Lage (10) ----------
  const lf = lageFaktor(p.gemeinde);
  parts.lage = lf * G.lage;

  let score = Object.values(parts).reduce((a, b) => a + b, 0);

  // ---------- Datenqualitäts-Abschlag ----------
  // Wichtig: Bei nur 5 Abfragen/Tag darf kein Objekt mit Lückendaten nach oben rutschen.
  if (dataQuality < 1) {
    const malus = (1 - dataQuality) * 0.35;
    score *= 1 - malus;
    reasons.push(`Datenqualität ${Math.round(dataQuality * 100)}% → Score gedämpft`);
  }

  score = Math.round(Math.max(0, Math.min(100, score)));

  const tier: ScoreResult['tier'] =
    score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';

  return {
    score, tier,
    hnfNeu: Math.round(hnfNeu),
    hnfBestand: Math.round(hnfBestand),
    hnfDelta: Math.round(hnfDelta),
    hnfFaktor: Number(Math.min(hnfFaktorRel, 99).toFixed(2)),
    reserveGF: Math.round(hnfDelta),
    reserveQuote,
    zulaessigeGF: Math.round(neu.gesamtGF),
    bestandGF: Math.round(hnfBestand),
    vg: neu.vg,
    az, azQuelle, dataQuality, killers, reasons, parts, version: SCORE_VERSION,
  };
}

/**
 * Gruppiert Objekte nach EGRID/Parzelle — eine Portal-Abfrage liefert ALLE
 * Eigentümer einer Parzelle. Mehrere Gebäude auf derselben Parzelle einzeln
 * abzufragen verbrennt Kontingent.
 */
export function gruppiereNachParzelle<T extends ScoreInput>(items: T[]): Array<{
  key: string;
  objekte: T[];
  bestesObjekt: T;
  score: ScoreResult;
}> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = it.egrid?.trim() || `id:${it.id}`;
    const arr = map.get(key) || [];
    arr.push(it);
    map.set(key, arr);
  }
  const out: Array<{ key: string; objekte: T[]; bestesObjekt: T; score: ScoreResult }> = [];
  for (const [key, objekte] of map) {
    // Bei mehreren Gebäuden auf einer Parzelle: Bestandsflächen summieren,
    // Grundstücksfläche nur einmal zählen → sonst wird die Reserve überschätzt.
    const merged: ScoreInput = {
      ...objekte[0],
      // Bestand summieren, Grundstücksfläche NICHT — die gehört der Parzelle einmal
      gebaeudeflaeche: objekte.reduce((s, o) => s + num(o.gebaeudeflaeche), 0),
      hnf_schaetzung: objekte.reduce((s, o) => s + num(o.hnf_schaetzung), 0) || null,
      wohnflaeche: objekte.reduce((s, o) => s + num(o.wohnflaeche), 0) || null,
      wohnungen: objekte.reduce((s, o) => s + num(o.wohnungen), 0) || null,
      geschosse: Math.max(...objekte.map((o) => num(o.geschosse))) || null,
      baujahr: Math.min(...objekte.map((o) => num(o.baujahr) || 9999)) || null,
    };
    if (merged.baujahr === 9999) merged.baujahr = null;
    const score = calculateDealScoreV2(merged);
    out.push({ key, objekte, bestesObjekt: objekte[0], score });
  }
  return out.sort((a, b) => b.score.score - a.score.score);
}

// --- Farbhelfer, API-kompatibel zu V1 ---
export function scoreColor(score: number): string {
  if (score >= 75) return 'text-accent';
  if (score >= 55) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-muted-foreground';
}
export function scoreBg(score: number): string {
  if (score >= 75) return 'bg-accent/15 border-accent/30';
  if (score >= 55) return 'bg-primary/15 border-primary/30';
  if (score >= 35) return 'bg-warning/15 border-warning/30';
  return 'bg-muted border-border';
}

/** Drop-in-Ersatz für die alte Signatur. */
export function calculateDealScore(p: ScoreInput): number {
  return calculateDealScoreV2(p).score;
}

/**
 * zone-config.ts — Zonen-Parameter für die Ausnutzungs-Berechnung.
 *
 * Keine Imports, keine Framework-Abhängigkeit → läuft im Browser,
 * in Node (Vercel Function) und in Deno (falls du Edge Functions behältst).
 *
 * WICHTIG: Die AZ-Werte sind Kanton-ZH-Defaults (Grössenordnung Stadt Zürich BZO
 * und typische Gemeinde-BZO). Jede Gemeinde hat ihre eigene BZO — deshalb:
 *   1. Wenn `properties.ausnuetzung` aus dem Import gefüllt ist → die gewinnt IMMER.
 *   2. GEMEINDE_AZ_OVERRIDE erlaubt gemeindespezifische Korrekturen.
 *   3. ZONE_AZ ist nur der Fallback.
 */

/** Maximale Ausnützungsziffer (anrechenbare Geschossfläche / Grundstücksfläche) */
export const ZONE_AZ: Record<string, number> = {
  // Wohnzonen
  W1: 0.30,
  W2: 0.55, W2G: 0.60,
  W2b: 0.40, W2bI: 0.40, W2bII: 0.40, W2bIII: 0.45,
  W3: 0.85, W3G: 0.90,
  W4: 1.20, W4G: 1.25,
  W5: 1.60,
  W6: 2.00,
  W7: 2.40,
  // Wohn-/Gewerbe-Mischzonen
  WG2: 0.65, WG3: 0.95, WG4: 1.30, WG: 0.70,
  // Kernzonen / Zentrumszonen (oft ohne AZ, über Baumasse geregelt → grob geschätzt)
  K: 1.00, KA: 1.00, KB: 1.20, KERN: 1.00,
  Z4: 1.30, Z5: 1.70, Z6: 2.10, Z7: 2.50,
  // Zonen ohne Wohnnutzung → für uns wertlos
  I: 0, IG: 0, G: 0, OE: 0, OeB: 0, FH: 0, L: 0, RE: 0,
};

/**
 * Gemeinde-spezifische AZ-Overrides.
 * Format: { 'Gemeinde': { 'W3': 0.75 } }
 * Trag hier ein, was du aus den BZO deiner Ziel-Gemeinden effektiv kennst —
 * das ist der Hebel mit dem grössten Genauigkeitsgewinn.
 */
export const GEMEINDE_AZ_OVERRIDE: Record<string, Record<string, number>> = {
  // Beispiel:
  // 'Zürich': { W2: 0.60, W3: 0.90, W4: 1.30, W5: 1.70 },
  // 'Winterthur': { W2: 0.55, W3: 0.80, W4: 1.10 },
};

/**
 * Geschoss-Profil pro Zone für die HNF-Formel.
 *   vg     = Anzahl Vollgeschosse (die AZ-Fläche verteilt sich auf diese)
 *   ug     = anrechenbares Untergeschoss (i.d.R. max. 1)
 *   dg     = anrechenbares Dachgeschoss unter Schrägdach (Faktor 1)
 *   attika = Attikageschoss (Faktor 0.66 — NICHT 1)
 *
 * dg und attika schliessen sich in der Praxis aus → siehe `dachtyp` in berechneHNF().
 */
export interface GeschossProfil {
  vg: number;
  ug: number;
  dg: number;
  attika: number;
}

export const ZONE_PROFIL: Record<string, GeschossProfil> = {
  W1:     { vg: 1, ug: 1, dg: 1, attika: 1 },
  W2:     { vg: 2, ug: 1, dg: 1, attika: 1 },
  W2G:    { vg: 2, ug: 1, dg: 1, attika: 1 },
  W2b:    { vg: 2, ug: 1, dg: 1, attika: 1 },
  W2bI:   { vg: 2, ug: 1, dg: 1, attika: 1 },
  W2bII:  { vg: 2, ug: 1, dg: 1, attika: 1 },
  W2bIII: { vg: 2, ug: 1, dg: 1, attika: 1 },
  W3:     { vg: 3, ug: 1, dg: 1, attika: 1 },
  W3G:    { vg: 3, ug: 1, dg: 1, attika: 1 },
  W4:     { vg: 4, ug: 1, dg: 1, attika: 1 },
  W4G:    { vg: 4, ug: 1, dg: 1, attika: 1 },
  W5:     { vg: 5, ug: 1, dg: 1, attika: 1 },
  W6:     { vg: 6, ug: 1, dg: 1, attika: 1 },
  W7:     { vg: 7, ug: 1, dg: 1, attika: 1 },
  WG2:    { vg: 2, ug: 1, dg: 1, attika: 1 },
  WG3:    { vg: 3, ug: 1, dg: 1, attika: 1 },
  WG4:    { vg: 4, ug: 1, dg: 1, attika: 1 },
  WG:     { vg: 2, ug: 1, dg: 1, attika: 1 },
  K:      { vg: 3, ug: 1, dg: 1, attika: 1 },
  KA:     { vg: 3, ug: 1, dg: 1, attika: 1 },
  KB:     { vg: 4, ug: 1, dg: 1, attika: 1 },
  Z4:     { vg: 4, ug: 1, dg: 1, attika: 1 },
  Z5:     { vg: 5, ug: 1, dg: 1, attika: 1 },
  Z6:     { vg: 6, ug: 1, dg: 1, attika: 1 },
  Z7:     { vg: 7, ug: 1, dg: 1, attika: 1 },
};

/** Attikageschoss ist nur zu 66% anrechenbar. */
export const ATTIKA_FAKTOR = 0.66;

/** Umrechnung Geschossfläche → Hauptnutzfläche (Konstruktion + Erschliessung raus). */
export const HNF_FAKTOR = 0.77;

/** Rückwärtskompatibel: total anrechenbare Geschosse (VG + UG + Attika×0.66). */
export const ZONE_GESCHOSSE: Record<string, number> = Object.fromEntries(
  Object.entries(ZONE_PROFIL).map(([z, p]) => [z, p.vg + p.ug + p.attika * ATTIKA_FAKTOR]),
);

export type Dachtyp = 'attika' | 'schraegdach' | 'flach';

export function getProfil(zone: string | null | undefined): GeschossProfil | null {
  const z = normalizeZone(zone);
  if (!z) return null;
  return ZONE_PROFIL[z] ?? null;
}

/**
 * Lage-Faktor pro Gemeinde (0..1). Steuert 10 Punkte im Score.
 * Pflege das nach deinem echten Marktwissen / erzielbaren Verkaufspreisen.
 * Alles was nicht drinsteht bekommt DEFAULT_LAGE_FAKTOR.
 */
export const GEMEINDE_LAGE: Record<string, number> = {
  // Beispiele — anpassen!
  // 'Zürich': 1.0, 'Kilchberg': 1.0, 'Zollikon': 1.0,
  // 'Wädenswil': 0.8, 'Winterthur': 0.7,
  // 'Bülach': 0.6, 'Andelfingen': 0.35,
};
export const DEFAULT_LAGE_FAKTOR = 0.5;

/** Zonen-Präfixe, die überhaupt für Wohnbau in Frage kommen. */
export const BAUZONEN_PREFIX = ['W', 'Z', 'K'];

/** Löst die massgebende AZ für ein Objekt auf. */
export function resolveAZ(
  zone: string | null | undefined,
  gemeinde: string | null | undefined,
  importierteAZ: number | null | undefined,
): { az: number; quelle: 'import' | 'gemeinde' | 'zone' | 'unbekannt' } {
  if (importierteAZ && importierteAZ > 0) {
    // Import kann als % (60) oder als Ziffer (0.6) kommen → normalisieren
    const az = importierteAZ > 5 ? importierteAZ / 100 : importierteAZ;
    return { az, quelle: 'import' };
  }
  const z = normalizeZone(zone);
  if (!z) return { az: 0, quelle: 'unbekannt' };

  const g = (gemeinde || '').trim();
  const override = GEMEINDE_AZ_OVERRIDE[g]?.[z];
  if (override) return { az: override, quelle: 'gemeinde' };

  const fromZone = ZONE_AZ[z];
  if (fromZone !== undefined) return { az: fromZone, quelle: 'zone' };

  return { az: 0, quelle: 'unbekannt' };
}

/** 'w3 ' → 'W3', 'W 3' → 'W3', 'W3/2.6' → 'W3' */
export function normalizeZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  const z = zone.toString().trim().toUpperCase().replace(/\s+/g, '').split('/')[0];
  return z || null;
}

export function isBauzone(zone: string | null | undefined): boolean {
  const z = normalizeZone(zone);
  if (!z) return false;
  return BAUZONEN_PREFIX.some((p) => z.startsWith(p));
}

export function lageFaktor(gemeinde: string | null | undefined): number {
  if (!gemeinde) return DEFAULT_LAGE_FAKTOR;
  return GEMEINDE_LAGE[gemeinde.trim()] ?? DEFAULT_LAGE_FAKTOR;
}

// ============================================================
//  HNF-Berechnung (Julians Formel)
// ============================================================
//
//   HNF ≈ Grundstücksfläche × AZ / VG × (VG + anrechenbare) × 0.77
//
//   wobei:  anrechenbare = UG + (Attika × 0.66  ODER  Dachgeschoss × 1.0)
//
// Wichtig: die Attika/UG-Fläche liegt ÜBER der AZ-begrenzten Vollgeschossfläche.
// Wer nur `area × AZ` rechnet, unterschätzt die verkaufbare Fläche deutlich —
// in W2 um rund 80%, in W5 um rund 33%.

export interface HNFInput {
  area: number;                 // Grundstücksfläche m²
  az: number;                   // Ausnützungsziffer (0.85 nicht 85)
  vg?: number;                  // Vollgeschosse — sonst aus Zonenprofil
  ug?: number;                  // anrechenbare Untergeschosse
  dachtyp?: Dachtyp;            // 'attika' (0.66) | 'schraegdach' (1.0) | 'flach' (0)
  zone?: string | null;
  hnfFaktor?: number;           // Default 0.77
}

export interface HNFResult {
  hnf: number;                  // Hauptnutzfläche m²
  gesamtGF: number;             // Geschossfläche inkl. UG/Attika
  aGF: number;                  // anrechenbare Geschossfläche = area × AZ
  gfProGeschoss: number;
  vg: number;
  anrechenbare: number;         // Summe der Zusatzgeschoss-Faktoren
  multiplikator: number;        // gesamtGF / aGF
  annahmen: string[];
}

export function berechneHNF(input: HNFInput): HNFResult {
  const annahmen: string[] = [];
  const profil = getProfil(input.zone);

  const vg = input.vg ?? profil?.vg ?? 2;
  if (input.vg == null) annahmen.push(`VG=${vg} aus Zonenprofil`);

  const ug = input.ug ?? profil?.ug ?? 1;

  const dachtyp: Dachtyp = input.dachtyp ?? 'attika';
  const dachAnteil =
    dachtyp === 'attika' ? (profil?.attika ?? 1) * ATTIKA_FAKTOR
    : dachtyp === 'schraegdach' ? (profil?.dg ?? 1)
    : 0;
  if (!input.dachtyp) annahmen.push(`Attika angenommen (${ATTIKA_FAKTOR} statt 1.0)`);

  const anrechenbare = ug + dachAnteil;
  const hnfFaktor = input.hnfFaktor ?? HNF_FAKTOR;

  const aGF = input.area * input.az;
  const gfProGeschoss = vg > 0 ? aGF / vg : 0;
  const gesamtGF = gfProGeschoss * (vg + anrechenbare);
  const hnf = gesamtGF * hnfFaktor;

  return {
    hnf,
    gesamtGF,
    aGF,
    gfProGeschoss,
    vg,
    anrechenbare,
    multiplikator: aGF > 0 ? gesamtGF / aGF : 0,
    annahmen,
  };
}

/**
 * Bestandes-HNF aus vorhandenen Daten schätzen — muss auf DERSELBEN Basis
 * gerechnet werden wie die Neubau-HNF, sonst ist die Differenz Unsinn.
 */
export function berechneBestandHNF(p: {
  hnf_schaetzung?: number | null;
  wohnflaeche?: number | null;
  gebaeudeflaeche?: number | null;
  geschosse?: number | null;
  zone?: string | null;
}): { hnf: number; quelle: string } {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const hnf = n(p.hnf_schaetzung);
  if (hnf > 0) return { hnf, quelle: 'hnf_schaetzung' };

  // Wohnfläche ≈ HNF bei Wohnbauten
  const wf = n(p.wohnflaeche);
  if (wf > 0) return { hnf: wf, quelle: 'wohnflaeche' };

  // Footprint × Geschosse = GF → × 0.77 = HNF
  const foot = n(p.gebaeudeflaeche);
  if (foot > 0) {
    const profil = getProfil(p.zone);
    const g = n(p.geschosse) || profil?.vg || 2;
    // Bestandsbauten haben meist UG + DG, aber selten voll ausgebaut → +1.0 statt +1.66
    const gesamt = g + 1.0;
    return { hnf: foot * gesamt * HNF_FAKTOR, quelle: `footprint×${gesamt}×${HNF_FAKTOR}` };
  }

  return { hnf: 0, quelle: 'unbekannt' };
}

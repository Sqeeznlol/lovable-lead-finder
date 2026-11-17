/**
 * Woher die Machbarkeitsstudie ihre Zahlen holt (gerechnet wird in
 * machbarkeit.ts):
 *
 *   Umriss, bebaubare Grundfläche, Gebäude   Datenbank, Funktion
 *                                            machbarkeit_grundlage
 *   Was die Zone erlaubt (Kanton Zürich)     Zonenplan des Kantons, WFS
 *   Was die Zone erlaubt (sonst)             eigene Liste -- als Annahme
 *                                            gekennzeichnet
 *
 * Die Feldnamen des Zürcher Dienstes sind nachgesehen (Abruf einer
 * Zonenfläche in Uster am 15. November), nicht angenommen:
 *   ausnuetzungsziffer_max, baumassenziffer_max, ueberbauungsziffer_max,
 *   vollgeschosse_max, dachgeschosse_max, untergeschosse_max,
 *   gebaeudehoehe_max, gesamthoehe, firsthoehe_max, fassadenhoehe,
 *   wohnanteil_min, rechtsstatus, typ_gde_bezeichnung,
 *   typ_gde_abkuerzung, typ_gemeindename, dokument
 * Grenzabstände führt der Dienst nicht; sie stehen nur in der
 * Bauordnung der Gemeinde.
 */
import { supabase } from '@/integrations/supabase/client';
import { ZONEN_EBENE, ZONEN_WFS } from '@/lib/karte3d';
import { DEFAULT_GESCHOSSE_BY_ZONE, resolveAz } from '@/lib/potential';
import type { Gebaeude, ZonenRegeln } from '@/lib/machbarkeit';

// Die erzeugten Typen kennen die Funktion noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

type Ring = number[][];
export interface Flaeche { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] }
export interface Grundlage {
  umriss_da: boolean; abstand: number; flaeche_umriss: number | null; umfang: number | null; bebaubar_m2: number | null;
  punkt: [number, number] | null; rahmen: [number, number, number, number] | null;
  umriss: Flaeche | null; innen: Flaeche | null; nachbarn: number; gebaeude: Gebaeude[];
}

export async function grundlageLaden(parzelleId: string, abstand: number): Promise<Grundlage | null> {
  const r = await db().rpc('machbarkeit_grundlage', { p_parzelle: parzelleId, p_abstand: abstand });
  if (r.error) throw r.error;
  return (r.data as Grundlage | null) ?? null;
}

const zahl = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** 70 -> 0.7. Werte bis 5 gelten schon als Ziffer -- eine Ausnützung über 500 % gibt es nicht. */
const prozent = (v: unknown): number | null => { const n = zahl(v); return n == null ? null : n > 5 ? n / 100 : n; };
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Die Höhenangaben der Zone: die niedrigste zählt, mit ihrem Namen. */
const HOEHEN: [string, string][] = [
  ['gebaeudehoehe_max', 'Gebäudehöhe'], ['fassadenhoehe', 'Fassadenhöhe'], ['fassadenhoehe_traufseitig', 'Fassadenhöhe traufseitig'],
  ['gesamthoehe', 'Gesamthöhe'], ['firsthoehe_max', 'Firsthöhe'],
];

/**
 * Die Zonenarten des Kantons, in denen privat gebaut wird. Nachgesehen am
 * 17. November an 3'300 Zonenflächen um Zürich, Kilchberg und Uster:
 * C11 Wohnzonen, C12 Industrie und Gewerbe, C13 Wohnzonen mit
 * Gewerbeerleichterung, Quartiererhaltungs- und Kernzonen, C14
 * Zentrumszonen. Nicht dazu gehören C15 öffentliche Bauten, C16 Erholung,
 * C2 Landwirtschaft, C3 Freihaltung und Gewässer, C4 Bahn, Strassen,
 * Reserve, Wald. Eine Ziffer nennen von 971 Quartiererhaltungszonen eine
 * und von 187 Kernzonen fünf: Bauzonen sind es trotzdem.
 */
export const istBauzoneZh = (code: string | null): boolean | null => (code ? /^C1[1-4]/.test(code) : null);

/** Eine Zonenfläche des Zürcher Dienstes in die Regeln der Studie übersetzen. */
export function regelnAusZh(p: Record<string, unknown>): ZonenRegeln {
  const hoehen = HOEHEN.map(([feld, titel]) => ({ wert: zahl(p[feld]), titel })).filter(h => h.wert != null && h.wert > 0);
  const hoehe = hoehen.sort((a, b) => a.wert! - b.wert!)[0];
  return {
    bauzone: istBauzoneZh(text(p.typ_zh_code)),
    bezeichnung: text(p.typ_gde_bezeichnung) ?? text(p.typ_zh_bezeichnung),
    abkuerzung: text(p.typ_gde_abkuerzung),
    gemeinde: text(p.typ_gemeindename),
    // Ausnützungs- und Überbauungsziffer führt der Dienst in Prozent:
    // gemessen an 400 Zonenflächen um Zürich-Nord stehen dort 70, 100,
    // 205 bzw. 22 -- gemeint sind 0.70, 1.00, 2.05 und 0.22. Die
    // Baumassenziffer steht dagegen in m³/m² (4.0, 6.0, 12.0).
    az: prozent(p.ausnuetzungsziffer_max),
    bmz: zahl(p.baumassenziffer_max),
    uez: prozent(p.ueberbauungsziffer_max),
    vollgeschosse: zahl(p.vollgeschosse_max),
    dachgeschosse: zahl(p.dachgeschosse_max),
    untergeschosse: zahl(p.untergeschosse_max),
    hoehe: hoehe?.wert ?? null,
    hoeheArt: hoehe?.titel ?? null,
    wohnanteilMin: zahl(p.wohnanteil_min),
    rechtsstatus: text(p.rechtsstatus),
    dokument: text(p.dokument),
    quelle: 'kanton',
  };
}

export const ZONEN_FRIST_MS = 8000;

/** Die Zone am Punkt (LV95), aus dem Zonenplan des Kantons Zürich. Null: keine gefunden. */
export async function zoneZh(e: number, n: number, signal?: AbortSignal, fristMs = ZONEN_FRIST_MS): Promise<ZonenRegeln | null> {
  const q = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', TYPENAMES: ZONEN_EBENE, COUNT: '5',
    BBOX: `${e - 0.5},${n - 0.5},${e + 0.5},${n + 0.5},urn:ogc:def:crs:EPSG::2056`, OUTPUTFORMAT: 'geojson',
  });
  // Mit Frist: hängt der Dienst des Kantons, wartete die Studie sonst
  // endlos, statt mit der eigenen Liste zu rechnen und das zu sagen.
  const frist = new AbortController();
  const uhr = setTimeout(() => frist.abort(), fristMs);
  signal?.addEventListener('abort', () => frist.abort());
  let j: { features?: { properties: Record<string, unknown> }[] };
  try {
    const r = await fetch(`${ZONEN_WFS}?${q}`, { signal: frist.signal });
    if (!r.ok) throw new Error(`Zonenplan des Kantons antwortet mit ${r.status}.`);
    j = await r.json();
  } finally {
    clearTimeout(uhr);
  }
  const alle = (j?.features ?? []).map(f => f.properties);
  // Eine Zone in Revision kann neben der geltenden liegen: die geltende zählt.
  const gilt = alle.find(p => text(p.rechtsstatus) === 'inKraft') ?? alle[0];
  return gilt ? regelnAusZh(gilt) : null;
}

/** Ersatz, wo kein amtlicher Zonenplan angebunden ist: was die eigene Liste zur Zone weiss. */
export function zoneAusBestand(p: { zone?: string | null; ausnuetzung?: number | string | null; vollgeschosse_zulaessig?: number | null; gemeinde?: string | null }):
  { regeln: ZonenRegeln; bauzoneM2: number | null } | null {
  if (!p.zone) return null;
  const { az, parsed } = resolveAz({ zone: p.zone, ausnuetzung: p.ausnuetzung });
  if (parsed.keineBauzone) return null;
  const vg = p.vollgeschosse_zulaessig ?? parsed.geschosse ?? (parsed.kurz ? DEFAULT_GESCHOSSE_BY_ZONE[parsed.kurz] ?? null : null);
  return {
    regeln: {
      bezeichnung: p.zone.replace(/\s*\(.*\)\s*$/, ''), abkuerzung: parsed.kurz ?? null, gemeinde: p.gemeinde ?? null,
      az, bmz: null, uez: parsed.ueberbauungsziffer ? parsed.ueberbauungsziffer / 100 : null,
      vollgeschosse: vg, dachgeschosse: null, untergeschosse: null, hoehe: null, hoeheArt: null, wohnanteilMin: null,
      rechtsstatus: null, dokument: null, quelle: 'bestand', bauzone: true,
    },
    bauzoneM2: parsed.zonenflaeche ?? null,
  };
}

// ----------------------------------------------------------- Zeichnung
/** Umriss und bebaubare Fläche als SVG-Pfade in einem Rahmen von `groesse` Pixeln, Norden oben. */
export function zeichnung(g: Pick<Grundlage, 'rahmen' | 'umriss' | 'innen'>, groesse = 320, rand = 12): { umriss: string; innen: string | null; meterJePixel: number } | null {
  if (!g.rahmen || !g.umriss) return null;
  const [x0, y0, x1, y1] = g.rahmen;
  const breite = Math.max(1, x1 - x0), hoehe = Math.max(1, y1 - y0);
  const k = (groesse - 2 * rand) / Math.max(breite, hoehe);
  const dx = rand + (groesse - 2 * rand - breite * k) / 2, dy = rand + (groesse - 2 * rand - hoehe * k) / 2;
  const punkt = ([x, y]: number[]) => `${(dx + (x - x0) * k).toFixed(1)} ${(dy + (y1 - y) * k).toFixed(1)}`;
  const pfad = (f: Flaeche) => {
    const polygone = (f.type === 'Polygon' ? [f.coordinates] : f.coordinates) as Ring[][];
    return polygone.map(ringe => ringe.map(r => `M${r.map(punkt).join('L')}Z`).join('')).join('');
  };
  return { umriss: pfad(g.umriss), innen: g.innen ? pfad(g.innen) : null, meterJePixel: 1 / k };
}

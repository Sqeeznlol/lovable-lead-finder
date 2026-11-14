/**
 * Daten für das Ladebild und für "Was auf der Parzelle gilt" (Julian,
 * 13. November: "es soll auch zu sehen sein BZO, Denkmal, Heizung").
 * Beides kommt über die eigenen Serverfunktionen api/modell und
 * api/oereb, weil die Kacheln binär sind und rund die Hälfte der
 * Kantone keinen ÖREB-Abruf aus dem Browser erlaubt.
 */
import type { Befund } from '@/lib/check-daten';
import { supabase } from '@/integrations/supabase/client';

export interface Koerper { h: number; r: number[][] }
export interface Modell { eigene: Koerper[]; nachbarn: Koerper[]; geschosse: number }
export interface Auszug {
  stand: string | null; zone: { text: string; anteil: number | null } | null; weitere: string[]; es: string | null;
  baulinien: { laenge: number; linien: number[][][] } | null; ordnung: { titel: string; url: string } | null;
  betroffen: { code: string; text: string }[]; nichtBetroffen: { code: string; text: string }[];
}
export interface Umgebung {
  solar: { kwh: number; flaeche: number; eignung: string } | null;
  waermenetz: { name: string | null; betreiber: string | null; telefon: string | null; web: string | null; meter: number } | null;
  oev: string | null; radon: number | null;
}
export interface Ziffern {
  zone: string | null; kuerzel: string | null; gemeinde: string | null; quelle: string;
  az: number | null; bmz: number | null; uez: number | null; gruen: number | null; frei: number | null;
  vollgeschosse: number | null; dachgeschosse: number | null; untergeschosse: number | null; attika: number | null;
  gebaeudehoehe: number | null; fassadenhoehe: number | null; fassadenhoehe_giebel: number | null; gesamthoehe: number | null; firsthoehe: number | null;
  wohnanteil: number | null;
  /** Ziffer ohne genannte Art (Luzern); wird so angezeigt, nicht gedeutet. */
  unbestimmt?: number | null;
}
export interface Recht { egrid: string | null; pdf: string | null; auszug: Auszug | null; bund: { kulturgueter: { name: string | null; kategorie: string | null }[] | null }; umgebung?: Umgebung | null; ziffern?: Ziffern | null }

async function holen<T>(pfad: string, ms: number, signal?: AbortSignal): Promise<T> {
  const ab = new AbortController(), t = setTimeout(() => ab.abort(), ms);
  signal?.addEventListener('abort', () => ab.abort());
  try { const r = await fetch(pfad, { signal: ab.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json() as T; } finally { clearTimeout(t); }
}
export const gebaeudeLaden = (e: number, n: number, signal?: AbortSignal) =>
  holen<{ gebaeude: Koerper[] }>(`/api/modell?e=${e.toFixed(1)}&n=${n.toFixed(1)}`, 9000, signal).then(j => j.gebaeude);
export const rechtLaden = (e: number, n: number, signal?: AbortSignal) =>
  holen<Recht>(`/api/oereb?e=${e.toFixed(1)}&n=${n.toFixed(1)}`, 25000, signal);

function drin(p: number[], ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [x, y] = ring[j];
    if ((b > p[1]) !== (y > p[1]) && p[0] < (x - a) * (p[1] - b) / (y - b) + a) c = !c;
  }
  return c;
}
const mitte = (r: number[][]) => r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);

/** Parzelle relativ zum Punkt der Adresse, wie die Gebäude aus api/modell. */
export function parzelleRelativ(b: Befund, e: number, n: number): number[][] {
  const groesster = b.teile.map(t => t[0]).sort((u, v) => v.length - u.length)[0] ?? [];
  return groesster.map(([x, y]) => [x - e, y - n]);
}

/** Eigene Gebäude: Mittelpunkt auf der Parzelle. Geschosse aus dem Gebäuderegister, sonst aus der Höhe. */
export function modellAus(gebaeude: Koerper[], parzelle: number[][], b: Befund): Modell {
  const eigene = gebaeude.filter(g => drin(mitte(g.r), parzelle));
  const nachbarn = gebaeude.filter(g => !eigene.includes(g));
  const ges = b.haeuser.filter(h => h.status === 1004).map(h => h.geschosse ?? 0);
  const hoch = Math.max(0, ...eigene.map(g => g.h));
  const geschosse = Math.max(1, Math.min(12, ges.length ? Math.max(...ges) : Math.round(hoch / 3)));
  return { eigene, nachbarn, geschosse };
}

export type Zeile = { titel: string; wert: string; zusatz?: string; quelle: string; link?: string; art?: 'ok' | 'linie' | 'zone' };

const ES = (t: string) => { const m = t.match(/stufe\s*(IV|III|II|I)\b/i); return m ? `Empfindlichkeitsstufe ${m[1].toUpperCase()}` : t; };
const hat = (l: { code: string }[], re: RegExp) => l.some(t => re.test(t.code));

/** Die Zeilen für "Was auf der Parzelle gilt"; nur was abgefragt ist, nichts geschätzt. */
export function rechtZeilen(r: Recht | null, b: Befund, zif: Ziffern | null = r?.ziffern ?? null): Zeile[] {
  const z: Zeile[] = [];
  const a = r?.auszug, kanton = b.kanton ? `ÖREB-Kataster ${b.kanton}` : 'ÖREB-Kataster';
  if (a?.zone) z.push({ titel: 'Zone', wert: a.zone.text, zusatz: a.weitere.slice(0, 2).join(' · ') || undefined, quelle: kanton, art: 'zone' });
  // Ohne Auszug (Zug, Luzern, Solothurn liefern kein JSON) kennt die Nutzungsplanung
  // des Kantons die Zone genauer als die Bundeskategorie: "Kernzone C" statt "Zentrumszonen".
  else if (zif?.zone) z.push({ titel: 'Zone', wert: zif.kuerzel ? `${zif.zone} [${zif.kuerzel}]` : zif.zone, quelle: zif.quelle, art: 'zone' });
  else if (b.zone) z.push({ titel: 'Zone', wert: b.zone, quelle: 'Bauzonen Schweiz', art: 'zone' });
  const erlaubt = erlaubtText(zif);
  if (erlaubt && zif) z.push({ titel: 'Erlaubt', wert: erlaubt.wert, zusatz: erlaubt.zusatz, quelle: zif.quelle });
  if (a?.ordnung) z.push({ titel: 'Bauordnung', wert: a.ordnung.titel, quelle: kanton, link: a.ordnung.url });
  if (a?.baulinien && a.baulinien.laenge > 0) z.push({ titel: 'Baulinie', wert: `${a.baulinien.laenge} m auf der Parzelle`, quelle: kanton, art: 'linie' });
  if (a?.es) z.push({ titel: 'Lärm', wert: ES(a.es), quelle: kanton });
  if (a && hat(a.betroffen, /^ch\.Sicherheitszonenplan$/)) z.push({ titel: 'Flughafen', wert: 'Sicherheitszone eines Flughafens', quelle: 'BAZL' });
  // Heizung steht schon beim Gebäude; hier nicht doppelt.
  const kgs = r?.bund.kulturgueter;
  if (kgs) z.push(kgs.length
    ? { titel: 'Denkmal', wert: kgs[0].name ?? 'Kulturgut', zusatz: `Kulturgüterinventar des Bundes${kgs[0].kategorie ? `, Kategorie ${kgs[0].kategorie}` : ''}`, quelle: 'Bund' }
    : { titel: 'Denkmal', wert: 'Kein Kulturgut des Bundes', zusatz: 'kantonale Inventare nicht geprüft', quelle: 'Bund', art: 'ok' });
  if (a) {
    if (hat(a.betroffen, /^ch\.BelasteteStandorte/)) z.push({ titel: 'Altlasten', wert: 'Eintrag im Kataster der belasteten Standorte', quelle: kanton });
    else if (hat(a.nichtBetroffen, /^ch\.BelasteteStandorte/)) z.push({ titel: 'Altlasten', wert: 'Kein Eintrag', quelle: kanton, art: 'ok' });
    const wasser = /^ch\.(Grundwasserschutz|Gewaesserraum|StatischeWaldgrenzen|Waldabstandslinien)/;
    const nicht = a.nichtBetroffen.filter(t => wasser.test(t.code)), doch = a.betroffen.filter(t => wasser.test(t.code));
    if (doch.length) z.push({ titel: 'Wasser, Wald', wert: [...new Set(doch.map(t => t.text))].slice(0, 2).join(' · '), quelle: kanton });
    else if (nicht.length) z.push({ titel: 'Wasser, Wald', wert: 'Nicht betroffen', zusatz: 'Grundwasserschutz, Gewässerraum, Wald', quelle: kanton, art: 'ok' });
  }
  return z;
}

/** Kurzname der Zone aus dem Auszug: "Wohnzone eingeschossig (W1)" ergibt "W1". */
export function zonenKuerzel(text: string | null | undefined): string | null {
  const m = text?.match(/\(([A-ZÄÖÜ][\wÄÖÜäöü./-]{0,9})\)\s*$/) ?? text?.match(/\[([A-ZÄÖÜ][\wÄÖÜäöü./-]{0,9})\]\s*$/);
  return m ? m[1] : null;
}

const tausend = (x: number) => Math.round(x).toLocaleString('de-CH');
/** Energie und Lage: nur was der Bund für diese Stelle führt. */
export function umgebungZeilen(u: Umgebung | null | undefined): Zeile[] {
  if (!u) return [];
  const z: Zeile[] = [];
  if (u.solar) z.push({ titel: 'Solardach', wert: `${u.solar.eignung} geeignet`, zusatz: `bis ${tausend(u.solar.kwh)} kWh Strom im Jahr auf ${tausend(u.solar.flaeche)} m² Dach`, quelle: 'BFE' });
  // Die Wärmenetze sind Standorte der Zentralen, kein Versorgungsgebiet: darum nur "in der Nähe".
  if (u.waermenetz) z.push({ titel: 'Fernwärme', wert: `${u.waermenetz.name ?? 'Wärmenetz'}, rund ${tausend(Math.round(u.waermenetz.meter / 10) * 10)} m entfernt`, zusatz: u.waermenetz.betreiber ? `Betreiber: ${u.waermenetz.betreiber}` : undefined, quelle: 'BFE', link: u.waermenetz.web ?? undefined });
  else z.push({ titel: 'Fernwärme', wert: 'Kein Wärmenetz im Umkreis von 1,5 km', quelle: 'BFE' });
  if (u.oev) z.push({ titel: 'ÖV', wert: u.oev.replace(/^([A-D]) - /, 'Güteklasse $1, ').replace(/Erschliessung$/, 'Erschliessung'), quelle: 'ARE' });
  if (u.radon != null) z.push({ titel: 'Radon', wert: `${u.radon} % Wahrscheinlichkeit über dem Referenzwert`, quelle: 'BAG', art: u.radon < 10 ? 'ok' : undefined });
  return z;
}

const zahl = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 2 });
/** "Baumassenziffer 1,2 · 1 Vollgeschoss + 1 Dachgeschoss", darunter die Höhen; nur was der Zonenplan führt. */
export function erlaubtText(z: Ziffern | null | undefined): { wert: string; zusatz?: string } | null {
  if (!z) return null;
  const dichte = [z.az != null ? `Ausnützungsziffer ${zahl(z.az)}` : null, z.bmz != null ? `Baumassenziffer ${zahl(z.bmz)}` : null,
    z.uez != null ? `Überbauungsziffer ${zahl(z.uez)}` : null].filter(Boolean);
  const geschosse = z.vollgeschosse != null ? [`${z.vollgeschosse} Vollgeschoss${z.vollgeschosse === 1 ? '' : 'e'}`,
    z.dachgeschosse ? `${z.dachgeschosse} Dachgeschoss${z.dachgeschosse === 1 ? '' : 'e'}` : null, z.attika ? 'Attika' : null].filter(Boolean).join(' + ') : null;
  const hoehen = [z.gesamthoehe != null ? `Gesamthöhe ${zahl(z.gesamthoehe)} m` : null, z.gebaeudehoehe != null ? `Gebäudehöhe ${zahl(z.gebaeudehoehe)} m` : null,
    z.fassadenhoehe != null ? `Fassadenhöhe ${zahl(z.fassadenhoehe)} m${z.fassadenhoehe_giebel != null ? ` (Giebelseite ${zahl(z.fassadenhoehe_giebel)} m)` : ''}` : null,
    z.gruen != null ? `Grünflächenziffer mind. ${zahl(z.gruen)}` : null].filter(Boolean);
  if (z.unbestimmt != null) dichte.push(`Nutzungsziffer ${zahl(z.unbestimmt)} (Art im Plan nicht angegeben)`);
  const wert = [...dichte, geschosse].filter(Boolean).join(' · ');
  if (!wert && !hoehen.length) return null;
  return { wert: wert || hoehen.shift()!, zusatz: hoehen.join(' · ') || undefined };
}


type ZifferZeile = { kanton: string; code: string | null; bezeichnung: string | null; abkuerzung: string | null; ziffer: number; art: string | null; art_kurz: string | null };
const LEER: Omit<Ziffern, 'zone' | 'kuerzel' | 'gemeinde' | 'quelle'> = { az: null, bmz: null, uez: null, gruen: null, frei: null, vollgeschosse: null, dachgeschosse: null,
  untergeschosse: null, attika: null, gebaeudehoehe: null, fassadenhoehe: null, fassadenhoehe_giebel: null, gesamthoehe: null, firsthoehe: null, wohnanteil: null, unbestimmt: null };

/** Ziffern aus der Nutzungsplanung der Kantone (Tabelle zone_ziffer, geodienste.ch); null wenn keine. */
export function zifferAus(zeilen: ZifferZeile[]): Ziffern | null {
  if (!zeilen.length) return null;
  const z: Ziffern = { ...LEER, zone: zeilen[0].bezeichnung, kuerzel: zeilen[0].abkuerzung, gemeinde: null, quelle: `Nutzungsplanung Kanton ${zeilen[0].kanton}` };
  for (const x of zeilen) {
    const v = Number(x.ziffer);
    if (!(v > 0)) continue;
    if (x.art_kurz === 'az') z.az ??= v; else if (x.art_kurz === 'bmz') z.bmz ??= v; else if (x.art_kurz === 'uez') z.uez ??= v;
    else if (x.art_kurz === 'gruen') z.gruen ??= v; else z.unbestimmt ??= v;
  }
  return z.az ?? z.bmz ?? z.uez ?? z.gruen ?? z.unbestimmt ? z : null;
}
export async function zifferLaden(e: number, n: number): Promise<Ziffern | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (supabase as any).rpc('zone_ziffer_am', { p_e: e, p_n: n });
  return r.error ? null : zifferAus((r.data ?? []) as ZifferZeile[]);
}

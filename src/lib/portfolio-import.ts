import { supabase } from '@/integrations/supabase/client';
import { nameNorm } from '@/hooks/use-eigentuemer-suche';
import { adresseWaehlen } from '@/lib/adresswahl';
import { bundParzelle } from '@/lib/bund-parzelle';

/**
 * Ein Kundenportfolio aus einer Adressliste anlegen -- Schritt 1 und 2
 * von Tims Arrondierungs-Ablauf: "Kunde liefert Portfolio oder
 * Adressliste, System findet die Parzellen".
 *
 * Zugeordnet wird über die EGRID, nicht über den Adresstext: Im Bestand
 * steht "Sonneggstrasse 47", der Kunde schreibt "Sonneggstr. 47, 8006
 * Zürich". Ein Textvergleich trifft das nicht, und ein unscharfer
 * Vergleich trifft gern die falsche Parzelle -- genau das ist hier schon
 * einmal passiert (20260912150000_falsche_zuordnung_gubler.sql).
 * Darum: Adresse beim Bund verorten, dort die Parzelle (EGRID) am Punkt
 * nachschlagen, und dann per EGRID im Bestand, wo sie eindeutig ist
 * (uniq_properties_egrid).
 */
export type Zuordnung = 'zugeordnet' | 'mehrdeutig' | 'nicht gefunden' | 'offen';

export interface Zeile {
  roh: string;
  /** Schon als EGRID geliefert -- dann ohne Umweg. */
  egrid: string | null;
}

/**
 * Lage vom Bund für eine Parzelle, die nicht im Bestand steht: Der
 * Bestand deckt Zürich und Thurgau, die Fonds halten schweizweit. Mit
 * der Lage steht die Liegenschaft trotzdem im Universum.
 */
export interface Lage {
  e: number; n: number; flaeche: number | null; gemeinde: string | null; kanton: string | null; nachbarn: string[];
}

export interface Ergebnis extends Zeile {
  zuordnung: Zuordnung;
  parzelleId: string | null;
  /** Was der Bund an Adresse gefunden hat, zum Gegenlesen. */
  gefunden: string | null;
  grund: string | null;
  lage?: Lage | null;
}

const EGRID = /\bCH[0-9A-Z]{12}\b/;

/**
 * Die eingefügte Liste in Zeilen: eine Adresse oder EGRID je Zeile.
 * Aus einer Tabelle (Excel, CSV) kommen Spalten mit Tabulator oder
 * Semikolon; sie werden zu einer Adresse zusammengesetzt. Kopfzeilen
 * wie "Adresse;PLZ;Ort" fallen weg.
 */
export function zeilenLesen(text: string): Zeile[] {
  const aus: Zeile[] = [];
  const gesehen = new Set<string>();
  for (const roh of text.split(/\r?\n/)) {
    const teile = roh.split(/[\t;]/).map(t => t.trim().replace(/^"|"$/g, '').trim()).filter(Boolean);
    if (!teile.length) continue;
    const zeile = teile.join(', ').replace(/\s+/g, ' ');
    if (/^(adresse|address|strasse|egrid)\b/i.test(zeile) && !/\d/.test(zeile)) continue;
    const egrid = zeile.toUpperCase().match(EGRID)?.[0] ?? null;
    const schluessel = egrid ?? zeile.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    aus.push({ roh: zeile, egrid });
  }
  return aus;
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

async function egridAmPunkt(e: number, n: number): Promise<string | null> {
  const p = new URLSearchParams({
    geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
    returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de',
  });
  const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?${p}`)).json();
  const g = String(j?.results?.[0]?.attributes?.egris_egrid ?? '');
  return EGRID.test(g) ? g : null;
}

/**
 * Gemeinde und Kanton aus der Trefferzeile des Bundes: "neubrueckstrasse
 * 18 2555 bruegg be 733 bruegg ch be" -- nach der BFS-Nummer die Gemeinde,
 * nach "ch" der Kanton. Das Label trägt den Ortsnamen mit Umlauten.
 */
export function gemeindeUndKanton(detail: string, label: string): { gemeinde: string | null; kanton: string | null } {
  const m = String(detail ?? '').match(/ (\d{4}) (.*?) (\d+) (.*?) ch ([a-z]{2})$/);
  if (!m) return { gemeinde: null, kanton: null };
  const kanton = m[5].toUpperCase();
  // Die Gemeinde heisst meist wie der Ort im Label; sonst der Rohtext.
  const ort = String(label ?? '').replace(/<[^>]+>/g, '').match(/\d{4} (.+)$/)?.[1]?.trim() ?? null;
  const gemeinde = ort && ort.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue') === m[4] ? ort : m[4];
  return { gemeinde, kanton };
}

/** Eine Zeile zuordnen. Wirft nicht: was schiefgeht, steht im Ergebnis. */
export async function zuordnen(z: Zeile): Promise<Ergebnis> {
  const leer = { parzelleId: null, gefunden: null, grund: null };
  try {
    let egrid = z.egrid;
    let gefunden: string | null = null;
    let ort: { gemeinde: string | null; kanton: string | null } = { gemeinde: null, kanton: null };
    if (!egrid) {
      const s = await (await fetch('https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&origins=address&limit=3&sr=2056&lang=de&searchText='
        + encodeURIComponent(z.roh))).json();
      const treffer = ((s?.results ?? []) as { attrs?: Record<string, unknown> }[]).map(r => r.attrs ?? {});
      const wahl = adresseWaehlen(z.roh, treffer.map(t => String(t.label ?? '')));
      if ('keine' in wahl) return { ...z, ...leer, zuordnung: 'nicht gefunden', grund: 'Adresse beim Bund nicht gefunden' };
      // Mehrere verschiedene Adressen: lieber nachfragen als raten.
      if ('mehrdeutig' in wahl) {
        return { ...z, ...leer, gefunden: wahl.mehrdeutig.join(' | '), zuordnung: 'mehrdeutig', grund: 'Mehrere Adressen -- PLZ oder Ort ergänzen' };
      }
      const t = treffer[wahl.index];
      gefunden = String(t.label ?? '').replace(/<[^>]+>/g, '');
      ort = gemeindeUndKanton(String(t.detail ?? ''), String(t.label ?? ''));
      // Mit sr=2056 steht der Ostwert in y, der Nordwert in x.
      egrid = await egridAmPunkt(Number(t.y), Number(t.x));
      if (!egrid) return { ...z, ...leer, gefunden, zuordnung: 'nicht gefunden', grund: 'Keine Parzelle am Punkt' };
    }
    const { data, error } = await db().from('properties').select('id, address').eq('egrid', egrid).limit(2);
    if (error) return { ...z, ...leer, egrid, gefunden, zuordnung: 'offen', grund: 'Bestand nicht lesbar' };
    const r = (data ?? []) as { id: string; address: string | null }[];
    if (r.length === 0) {
      // Nicht im Bestand, aber beim Bund: Lage, Fläche und Nachbarn
      // mitnehmen, damit die Liegenschaft im Universum steht.
      const b = await bundParzelle(egrid).catch(() => null);
      const lage: Lage | null = b ? { e: b.e, n: b.n, flaeche: b.flaeche || null, gemeinde: ort.gemeinde, kanton: ort.kanton, nachbarn: b.nachbarn } : null;
      return { ...z, ...leer, egrid, gefunden, lage, zuordnung: 'nicht gefunden',
        grund: lage ? `Nicht im Bestand${ort.kanton && !['ZH', 'TG'].includes(ort.kanton) ? ` (${ort.kanton})` : ''} -- Lage vom Bund` : 'Parzelle nicht im Bestand' };
    }
    return { ...z, egrid, parzelleId: r[0].id, gefunden: gefunden ?? r[0].address, grund: null, zuordnung: 'zugeordnet' };
  } catch {
    return { ...z, ...leer, zuordnung: 'offen', grund: 'Dienst nicht erreichbar' };
  }
}

/**
 * Eigner, Mandant, Portfolio und Positionen anlegen. Der Eigner wird
 * wiederverwendet, wenn es ihn als Akteur schon gibt -- nach derselben
 * Regel wie akteur_norm, sonst stünde Swisscanto zweimal da.
 */
export async function portfolioSpeichern(eigner: string, name: string, art: string, ergebnisse: Ergebnis[]): Promise<string> {
  const norm = nameNorm(eigner);
  const vorh = await db().from('akteur').select('id').eq('name_norm', norm).limit(1);
  if (vorh.error) throw vorh.error;
  let akteurId: string = vorh.data?.[0]?.id;
  if (!akteurId) {
    const a = await db().from('akteur').insert({ name: eigner.trim(), art }).select('id').single();
    if (a.error) throw a.error;
    akteurId = a.data.id;
  }
  const m = await db().from('mandant').insert({ akteur_id: akteurId, produkt: 'monitor' }).select('id').single();
  if (m.error) throw m.error;
  const pf = await db().from('portfolio').insert({ mandant_id: m.data.id, name: name.trim() }).select('id').single();
  if (pf.error) throw pf.error;
  const pos = ergebnisse.map(e => ({
    portfolio_id: pf.data.id, parzelle_id: e.parzelleId, roh_adresse: e.roh,
    zuordnung: e.zuordnung === 'zugeordnet' ? 'zugeordnet' : e.zuordnung === 'offen' ? 'offen' : e.zuordnung,
  }));
  if (pos.length) {
    const p = await db().from('portfolio_position').insert(pos);
    if (p.error) throw p.error;
  }
  return pf.data.id as string;
}

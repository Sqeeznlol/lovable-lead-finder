import { supabase } from '@/integrations/supabase/client';
import { parallel } from '@/lib/parallel';
import { bundParzelle } from '@/lib/bund-parzelle';
import { zuordnen, type Ergebnis, type Zeile } from '@/lib/portfolio-import';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export interface Fonds { id: string; name: string; nr: number; liegenschaften: number; flaeche: number; reserve: number; marge: number }
export interface Punkt {
  id: string; fonds: string; e: number | null; n: number | null; adresse: string; gemeinde: string | null;
  flaeche: number | null; zone: string | null; reserve: number | null; marge: number | null; egrid: string | null;
}
export interface Kante { a: string; b: string; fremd: boolean }
export type PotenzialArt = 'arrondierung' | 'nachbar_baut' | 'reserve' | 'offen';
export interface Potenzial {
  art: PotenzialArt; titel: string; wo: string; flaeche: number | null; reserve: number | null; marge: number | null;
  parzelle: string; parzelle2: string | null;
}
export interface Universum {
  gesellschaft: string | null; mandant: string | null; fonds: Fonds[]; punkte: Punkt[]; kanten: Kante[]; potenziale: Potenzial[];
}

/**
 * Die Abfrage in der Datenbank (Migrationen 20261101300000_fonds.sql und
 * 20261101320000_fonds_konten.sql). `team` wählt die Fondsleitung; für
 * einen Fondsmanager zählt sie nicht, er sieht immer die eigene.
 */
export async function universumLaden(team: string | null): Promise<Universum> {
  const r = await db().rpc('fonds_universum', { p_team: team });
  if (r.error) throw r.error;
  return r.data as Universum;
}

/**
 * Eine Farbe je Fonds, gut unterscheidbar auf dunklem Grund. Die ersten
 * vier sind die Farben der Seite (Akzent, Orange, Grün, Violett), damit
 * das Universum zur übrigen Oberfläche gehört.
 */
export const FONDSFARBEN = ['#5B63FF', '#F26B1D', '#2BB673', '#9B7BFF', '#F2C94C', '#2EC4E6', '#FF6B9A', '#C0C6D4', '#E5484D', '#00B894'];
export const fondsFarbe = (nr: number) => FONDSFARBEN[(nr - 1) % FONDSFARBEN.length];

/**
 * Punkte mit Parzelle im Bestand tragen deren UUID; Positionen ohne
 * Bestand (ausserhalb Zürich und Thurgau) kommen als "pos:<id>" aus
 * fonds_universum und haben weder Zone noch Reserve.
 */
export const imBestand = (p: { id: string }) => !p.id.startsWith('pos:');

export const POTENZIAL: Record<PotenzialArt, { titel: string; kurz: string }> = {
  arrondierung: { titel: 'Fonds grenzen aneinander', kurz: 'Arrondierung' },
  nachbar_baut: { titel: 'Nachbar baut', kurz: 'Nachbar baut' },
  reserve: { titel: 'Ausnützungsreserve', kurz: 'Reserve' },
  offen: { titel: 'Potenzial offen', kurz: 'Offen' },
};

/**
 * Fehlende Punkte und Nachbarn beim Bund holen und ablegen. Läuft nach
 * dem Einspielen und für Liegenschaften, die noch keinen Punkt haben --
 * so steht jede Liegenschaft im Universum, ohne dass jemand einen
 * Ablauf anstossen muss.
 */
export async function verorten(punkte: { id: string; egrid: string | null }[], fortschritt?: (f: number, t: number) => void): Promise<number> {
  const offen = punkte.filter(p => p.egrid);
  let fertig = 0, gesetzt = 0;
  await parallel(offen, 4, async p => {
    try {
      const b = await bundParzelle(p.egrid!);
      if (b) {
        await db().from('parzelle_punkt').upsert({ parzelle_id: p.id, e: b.e, n: b.n, quelle: 'bund' });
        if (b.nachbarn.length) {
          // Nur Nachbarn, die im Bestand stehen -- die Tabelle verweist auf properties.
          const r = await db().from('properties').select('id').in('egrid', b.nachbarn).limit(200);
          const zeilen = ((r.data ?? []) as { id: string }[]).filter(x => x.id !== p.id)
            .flatMap(x => [{ parzelle_id: p.id, nachbar_id: x.id }, { parzelle_id: x.id, nachbar_id: p.id }]);
          if (zeilen.length) await db().from('nachbarschaft').upsert(zeilen, { onConflict: 'parzelle_id,nachbar_id', ignoreDuplicates: true });
        }
        gesetzt++;
      }
    } catch { /* ein Ausfall des Bundes soll das Einspielen nicht abbrechen */ }
    fortschritt?.(++fertig, offen.length);
  });
  return gesetzt;
}

/** Zeilen beim Bund zuordnen, vier zugleich. */
export async function zuordnenAlle(zeilen: Zeile[], fortschritt?: (f: number, t: number) => void): Promise<Ergebnis[]> {
  const aus: Ergebnis[] = new Array(zeilen.length);
  let fertig = 0;
  await parallel(zeilen.map((z, i) => ({ z, i })), 4, async ({ z, i }) => {
    aus[i] = await zuordnen(z);
    fortschritt?.(++fertig, zeilen.length);
  });
  return aus;
}

/**
 * Positionen in einen bestehenden Fonds oder einen neuen schreiben.
 *
 * Wer dieselbe Liste zweimal einspielte, hatte jede Liegenschaft doppelt
 * (Prüfung, 1. November). Was im Ziel-Fonds schon steht, wird darum
 * übersprungen und als Zahl zurückgegeben.
 */
export async function einspielen(mandant: string, fonds: string | null, neuerName: string, ergebnisse: Ergebnis[]): Promise<{ id: string; neu: number; schon: number }> {
  let id = fonds;
  let vorhanden = new Set<string>();
  if (id) {
    const r = await db().from('portfolio_position').select('parzelle_id, roh_adresse').eq('portfolio_id', id).limit(20000);
    if (r.error) throw r.error;
    vorhanden = new Set(((r.data ?? []) as { parzelle_id: string | null; roh_adresse: string | null }[])
      .map(x => x.parzelle_id ?? `roh:${(x.roh_adresse ?? '').trim().toLowerCase()}`));
  } else {
    const pf = await db().from('portfolio').insert({ mandant_id: mandant, name: neuerName.trim() }).select('id').single();
    if (pf.error) throw pf.error;
    id = pf.data.id as string;
  }
  const schluessel = (e: Ergebnis) => e.parzelleId ?? `roh:${e.roh.trim().toLowerCase()}`;
  const gesehen = new Set<string>();
  const pos = ergebnisse
    .filter(e => { const k = schluessel(e); if (vorhanden.has(k) || gesehen.has(k)) return false; gesehen.add(k); return true; })
    .map(e => ({ portfolio_id: id, parzelle_id: e.parzelleId, roh_adresse: e.roh, zuordnung: e.zuordnung,
      // Ohne Bestand trägt die Position ihre Lage selbst (20261106100000_position_lage.sql).
      egrid: e.egrid, e: e.lage?.e ?? null, n: e.lage?.n ?? null, flaeche: e.lage?.flaeche ?? null,
      gemeinde: e.lage?.gemeinde ?? null, kanton: e.lage?.kanton ?? null, nachbar_egrids: e.lage?.nachbarn ?? [] }));
  if (pos.length) {
    const r = await db().from('portfolio_position').insert(pos);
    if (r.error) throw r.error;
  }
  return { id: id!, neu: pos.length, schon: ergebnisse.length - pos.length };
}

/** Die Potenziale als CSV (Excel, Semikolon) -- für den Bericht an die Geschäftsleitung. */
export function potenzialeAlsCsv(liste: Potenzial[], punkt: Map<string, Punkt>, nr: Map<string, number>, datei: string) {
  const zelle = (v: unknown) => {
    const t = v == null ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const kopf = ['Art', 'Titel', 'Fonds', 'Adresse', 'Gemeinde', 'EGRID', 'Fläche m²', 'Reserve m²', 'Marge CHF', 'Zone'];
  const zeilen = liste.map(p => {
    const a = punkt.get(p.parzelle), b = p.parzelle2 ? punkt.get(p.parzelle2) : undefined;
    const fonds = [a, b].filter(Boolean).map(x => `Fonds ${nr.get(x!.fonds) ?? ''}`).join(' + ');
    return [POTENZIAL[p.art].kurz, p.titel, fonds, a?.adresse ?? p.wo, a?.gemeinde ?? '', a?.egrid ?? '',
      p.flaeche != null ? Math.round(p.flaeche) : '', p.reserve != null ? Math.round(p.reserve) : '',
      p.marge != null ? Math.round(p.marge) : '', a?.zone ?? ''].map(zelle).join(';');
  });
  // Mit BOM, sonst zeigt Excel die Umlaute falsch.
  const blob = new Blob(['\ufeff' + [kopf.join(';'), ...zeilen].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const l = document.createElement('a');
  l.href = url; l.download = datei; l.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

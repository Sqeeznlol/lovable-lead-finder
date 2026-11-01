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

/** Die Abfrage in der Datenbank (Migration 20261101300000_fonds.sql). */
export async function universumLaden(): Promise<Universum> {
  const r = await db().rpc('fonds_universum');
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

export const POTENZIAL: Record<PotenzialArt, { titel: string; kurz: string }> = {
  arrondierung: { titel: 'Fonds grenzen aneinander', kurz: 'Arrondierung' },
  nachbar_baut: { titel: 'Nachbar baut', kurz: 'Nachbar baut' },
  reserve: { titel: 'Ausnützungsreserve', kurz: 'Reserve' },
  offen: { titel: 'Potenzial offen', kurz: 'Zone fehlt' },
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

/** Positionen in einen bestehenden Fonds oder einen neuen schreiben. */
export async function einspielen(mandant: string, fonds: string | null, neuerName: string, ergebnisse: Ergebnis[]): Promise<string> {
  let id = fonds;
  if (!id) {
    const pf = await db().from('portfolio').insert({ mandant_id: mandant, name: neuerName.trim() }).select('id').single();
    if (pf.error) throw pf.error;
    id = pf.data.id as string;
  }
  const pos = ergebnisse.map(e => ({ portfolio_id: id, parzelle_id: e.parzelleId, roh_adresse: e.roh, zuordnung: e.zuordnung }));
  if (pos.length) {
    const r = await db().from('portfolio_position').insert(pos);
    if (r.error) throw r.error;
  }
  return id!;
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Die Portfolios der Mandanten, mit Eigner, Manager und Parzellen.
 *
 * Gelesen wird nur mit Anmeldung -- die Regeln aus
 * 20261031180000_plattform_fundament.sql geben Mandanten, Portfolios und
 * Verwaltung nur an "authenticated" heraus. Ein Kundenportfolio gehört
 * nicht ins offene Netz (docs/plattform.md, Abschnitt 6).
 *
 * "Manager" ist, wer die Liegenschaften bewirtschaftet: die Tabelle
 * verwaltung, nicht der Eigner. Bei institutionellen Portfolios sind das
 * fast immer zwei verschiedene Firmen, und wer anruft, muss wissen, mit
 * wem er spricht.
 */
export interface Position {
  id: string;
  parzelleId: string | null;
  adresse: string | null;
  egrid: string | null;
  parzelle: string | null;
  flaeche: number | null;
  zone: string | null;
  /** Bei Gelegenheiten: welche Rolle die Parzelle spielt (Auslöser, Nachbar, Im Portfolio). */
  rolle?: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  eigner: string | null;
  manager: string[];
  positionen: Position[];
}

/**
 * Nur Name und Zahl der Parzellen je Portfolio -- für Listen, die nicht
 * jede Position brauchen. Die volle Abfrage liest alle 3807 Parzellen;
 * beim ersten Aufruf dauerte das 6 Sekunden (Ablauf Tempo, 3. November),
 * und die Gelegenheiten stellten sie bei jedem Öffnen.
 */
export interface PortfolioKurz { id: string; name: string; parzellen: number }
export function usePortfolioListe(aktiv: boolean) {
  return useQuery({
    queryKey: ['portfolio-liste'],
    enabled: aktiv,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PortfolioKurz[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('portfolio')
        .select('id, name, portfolio_position(count)')
        .not('portfolio_position.parzelle_id', 'is', null)
        .order('name');
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string; portfolio_position: { count: number }[] }[])
        .map(z => ({ id: z.id, name: z.name, parzellen: z.portfolio_position?.[0]?.count ?? 0 }));
    },
  });
}

/** Die Parzellen eines einzigen Portfolios, erst wenn sie gebraucht werden. */
export async function portfolioParzellen(portfolioId: string): Promise<{ parzelleId: string; egrid: string; adresse: string | null }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('portfolio_position')
    .select('roh_adresse, parzelle:parzelle_id(id, address, egrid)')
    .eq('portfolio_id', portfolioId).not('parzelle_id', 'is', null);
  if (error) throw error;
  return ((data ?? []) as { roh_adresse: string | null; parzelle: { id: string; address: string | null; egrid: string | null } | null }[])
    .filter(z => z.parzelle?.egrid)
    .map(z => ({ parzelleId: z.parzelle!.id, egrid: z.parzelle!.egrid!, adresse: z.parzelle!.address ?? z.roh_adresse }));
}

export function usePortfolios(aktiv: boolean) {
  return useQuery({
    queryKey: ['portfolios'],
    enabled: aktiv,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Portfolio[]> => {
      // Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from('portfolio').select(
        'id, name, mandant:mandant_id(akteur:akteur_id(name)),' +
        ' portfolio_position(id, roh_adresse, parzelle:parzelle_id(id, address, egrid, plot_number, area, zone))',
      ).order('name');
      if (error) throw error;

      type Zeile = {
        id: string; name: string;
        mandant: { akteur: { name: string } | null } | null;
        portfolio_position: { id: string; roh_adresse: string | null;
          parzelle: { id: string; address: string | null; egrid: string | null;
                      plot_number: string | null; area: number | null; zone: string | null } | null }[];
      };
      const zeilen = (data ?? []) as Zeile[];

      const ids = zeilen.flatMap(z => z.portfolio_position.map(p => p.parzelle?.id).filter(Boolean)) as string[];
      const managerJe = new Map<string, Set<string>>();
      if (ids.length) {
        // In Paketen: alle 3807 Kennungen in einer Adresse wären rund
        // 140 kB lang -- weit über dem, was Server annehmen.
        const pakete: string[][] = [];
        for (let i = 0; i < ids.length; i += 150) pakete.push(ids.slice(i, i + 150));
        const antworten = await Promise.all(pakete.map(p => db.from('verwaltung')
          .select('parzelle_id, akteur:akteur_id(name)').in('parzelle_id', p)));
        // Die Verwalter sind Beiwerk: fehlt ein Paket, bleiben die Portfolios trotzdem da.
        const v = antworten.flatMap((a: { data: unknown[] | null }) => a.data ?? []);
        for (const r of v as { parzelle_id: string; akteur: { name: string } | null }[]) {
          if (!r.akteur) continue;
          if (!managerJe.has(r.parzelle_id)) managerJe.set(r.parzelle_id, new Set());
          managerJe.get(r.parzelle_id)!.add(r.akteur.name);
        }
      }

      return zeilen.map(z => {
        const positionen: Position[] = z.portfolio_position.map(p => ({
          id: p.id, parzelleId: p.parzelle?.id ?? null,
          adresse: p.parzelle?.address ?? p.roh_adresse, egrid: p.parzelle?.egrid ?? null,
          parzelle: p.parzelle?.plot_number ?? null, flaeche: p.parzelle?.area ?? null,
          zone: p.parzelle?.zone ?? null,
        }));
        const manager = new Set<string>();
        positionen.forEach(p => p.parzelleId && managerJe.get(p.parzelleId)?.forEach(m => manager.add(m)));
        return { id: z.id, name: z.name, eigner: z.mandant?.akteur?.name ?? null,
                 manager: [...manager], positionen };
      });
    },
  });
}

/**
 * Der Umriss einer Parzelle vom Bund, über ihre EGRID. Zürcher Parzellen
 * haben im Bestand keinen eigenen (gemessen am 1. November: Kloten 0 von
 * 1644). Der Bund liefert ihn -- gemessen: 1 Treffer, Polygon, in WGS84.
 */
export async function umrissVomBund(egrid: string, sr: '4326' | '2056' = '4326'): Promise<GeoJSON.Geometry | null> {
  // 4326 für die Karte, 2056 (LV95) für die Nachbarsuche beim Bund.
  const p = new URLSearchParams({
    layer: 'ch.kantone.cadastralwebmap-farbe', searchField: 'egris_egrid', searchText: egrid,
    contains: 'false', returnGeometry: 'true', geometryFormat: 'geojson', sr,
  });
  const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/find?${p}`)).json();
  return (j?.results?.[0]?.geometry as GeoJSON.Geometry) ?? null;
}

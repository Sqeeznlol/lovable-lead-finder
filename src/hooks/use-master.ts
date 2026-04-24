import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;

export interface MasterFilters {
  search?: string;
  gemeinde?: string | null;     // null = Alle
  bezirk?: string | null;
  plz?: string | null;
  zone?: string | null;
  kategorie?: string | null;
  gebStatus?: string | null;
  status?: string | null;
  preselection?: string | null;
  assigned?: string | null;
  baujahrVon?: number | null;
  baujahrBis?: number | null;
  renovationVon?: number | null;
  renovationBis?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
  gebFlaecheMin?: number | null;
  gebFlaecheMax?: number | null;
  hnfMin?: number | null;
  hnfMax?: number | null;
  withOwner?: 'all' | 'mit' | 'ohne';
  withPhone?: 'all' | 'mit' | 'ohne';
  contacted?: 'all' | 'mit' | 'ohne';
  hideExported?: boolean;
  hideOwnerFound?: boolean;
  followUpDue?: boolean;
  hasNote?: 'all' | 'mit' | 'ohne';
  listId?: string | null;
  source?: string | null;
  sortBy?: 'baujahr' | 'gebaeudeflaeche' | 'area' | 'gemeinde' | 'imported_at';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function applyFilters<T>(
  base: T,
  f: MasterFilters,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = base;
  if (f.search) {
    const s = f.search.replace(/[,]/g, '');
    q = q.or(
      `address.ilike.%${s}%,egrid.ilike.%${s}%,owner_name.ilike.%${s}%,gemeinde.ilike.%${s}%,strassenname.ilike.%${s}%,parzelle.ilike.%${s}%`,
    );
  }
  if (f.gemeinde) q = q.eq('gemeinde', f.gemeinde);
  if (f.bezirk) q = q.eq('bezirk', f.bezirk);
  if (f.plz) q = q.eq('plz', f.plz);
  if (f.zone) q = q.eq('zone', f.zone);
  if (f.kategorie) q = q.eq('kategorie', f.kategorie);
  if (f.gebStatus) q = q.eq('geb_status', f.gebStatus);
  if (f.status) q = q.eq('status', f.status);
  if (f.preselection) q = q.eq('preselection_status', f.preselection);
  if (f.assigned) q = q.eq('assigned_to', f.assigned);
  if (f.baujahrVon != null) q = q.gte('baujahr', f.baujahrVon);
  if (f.baujahrBis != null) q = q.lte('baujahr', f.baujahrBis);
  if (f.renovationVon != null) q = q.gte('renovationsjahr', f.renovationVon);
  if (f.renovationBis != null) q = q.lte('renovationsjahr', f.renovationBis);
  if (f.areaMin != null) q = q.gte('area', f.areaMin);
  if (f.areaMax != null) q = q.lte('area', f.areaMax);
  if (f.gebFlaecheMin != null) q = q.gte('gebaeudeflaeche', f.gebFlaecheMin);
  if (f.gebFlaecheMax != null) q = q.lte('gebaeudeflaeche', f.gebFlaecheMax);
  if (f.hnfMin != null) q = q.gte('hnf_schaetzung', f.hnfMin);
  if (f.hnfMax != null) q = q.lte('hnf_schaetzung', f.hnfMax);
  if (f.withOwner === 'mit') q = q.not('owner_name', 'is', null);
  if (f.withOwner === 'ohne') q = q.is('owner_name', null);
  if (f.withPhone === 'mit') q = q.not('owner_phone', 'is', null);
  if (f.withPhone === 'ohne') q = q.is('owner_phone', null);
  if (f.contacted === 'mit') q = q.gt('contact_attempts', 0);
  if (f.contacted === 'ohne') q = q.eq('contact_attempts', 0);
  if (f.hideExported) q = q.neq('status', 'Exportiert');
  if (f.hideOwnerFound) q = q.is('owner_name', null);
  if (f.followUpDue) q = q.lte('follow_up_at', new Date().toISOString());
  if (f.hasNote === 'mit') q = q.not('notes', 'is', null);
  if (f.hasNote === 'ohne') q = q.is('notes', null);
  if (f.listId) q = q.eq('list_id', f.listId);
  if (f.source) q = q.eq('source_file', f.source);
  return q as T;
}

export function useMasterProperties(filters: MasterFilters) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;
  return useQuery({
    queryKey: ['master', 'properties', filters],
    queryFn: async () => {
      const sortBy = filters.sortBy ?? 'gebaeudeflaeche';
      const sortDir = filters.sortDir ?? 'desc';
      let q = applyFilters(
        supabase
          .from('properties')
          .select('*', { count: 'exact' }),
        filters,
      );
      q = q.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });
      q = q.range(page * pageSize, (page + 1) * pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as Property[], total: count || 0 };
    },
    staleTime: 15 * 1000,
  });
}

export interface GemeindeStat {
  gemeinde: string;
  total: number;
  offen: number;     // Vorwahl "Nicht geprüft" oder Akquise "Neu"
  geprueft: number;  // alles ausser Nicht geprüft + nicht Neu
  interessant: number;
}

/**
 * Live-Zähler pro Gemeinde. Liest die nötigen Felder in Batches und gruppiert
 * client-seitig — performant genug für ZH (~50-200 Gemeinden, einige hunderttausend Zeilen).
 */
export function useGemeindeStats() {
  return useQuery({
    queryKey: ['master', 'gemeinde-stats'],
    queryFn: async () => {
      const batchSize = 1000;
      let from = 0;
      const stats: Map<string, GemeindeStat> = new Map();
      // Aggregate "global" too
      let allTotal = 0, allOffen = 0, allGeprueft = 0, allInteressant = 0;

      // Use a smaller projection to avoid huge payloads
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('gemeinde, status, preselection_status')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          const g = r.gemeinde || '— ohne Gemeinde —';
          let s = stats.get(g);
          if (!s) { s = { gemeinde: g, total: 0, offen: 0, geprueft: 0, interessant: 0 }; stats.set(g, s); }
          s.total++;
          allTotal++;
          const isOffen = (r.preselection_status === 'Nicht geprüft') || (r.status === 'Neu' || r.status === 'In Prüfung');
          if (isOffen) { s.offen++; allOffen++; } else { s.geprueft++; allGeprueft++; }
          const isInteressant =
            r.preselection_status === 'Sehr interessant' ||
            r.preselection_status === 'Potenzial vorhanden' ||
            r.status === 'Interessant' || r.status === 'Interesse vorhanden' || r.status === 'Termin vereinbart';
          if (isInteressant) { s.interessant++; allInteressant++; }
        }
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const list = Array.from(stats.values()).sort((a, b) => b.total - a.total);
      return {
        gemeinden: list,
        all: { total: allTotal, offen: allOffen, geprueft: allGeprueft, interessant: allInteressant },
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export interface MasterDashboardStats {
  total: number;
  gemeindeCount: number;
  newCount: number;
  geprueft: number;
  interessant: number;
  ausgeschlossen: number;
  withOwner: number;
  withPhone: number;
  contacted: number;
  withInterest: number;
  followUpDue: number;
  topGemeinden: { name: string; count: number }[];
}

export function useMasterDashboardStats() {
  return useQuery({
    queryKey: ['master', 'dashboard-stats'],
    queryFn: async (): Promise<MasterDashboardStats> => {
      const batchSize = 1000;
      let from = 0;
      let total = 0, newCount = 0, geprueft = 0, interessant = 0, ausgeschlossen = 0;
      let withOwner = 0, withPhone = 0, contacted = 0, withInterest = 0, followUpDue = 0;
      const gemeindeMap: Map<string, number> = new Map();
      const now = Date.now();
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('gemeinde, status, preselection_status, owner_name, owner_phone, contact_attempts, follow_up_at')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        for (const r of data) {
          total++;
          if (r.gemeinde) gemeindeMap.set(r.gemeinde, (gemeindeMap.get(r.gemeinde) || 0) + 1);
          if (r.status === 'Neu' || r.preselection_status === 'Nicht geprüft') newCount++;
          if (r.preselection_status && r.preselection_status !== 'Nicht geprüft') geprueft++;
          if (r.preselection_status === 'Sehr interessant' || r.preselection_status === 'Potenzial vorhanden' ||
              r.status === 'Interessant' || r.status === 'Interesse vorhanden') interessant++;
          if (r.preselection_status === 'Kein Potenzial' || r.preselection_status === 'Ausschliessen' ||
              r.status === 'Nicht interessant' || r.status === 'Archiviert') ausgeschlossen++;
          if (r.owner_name) withOwner++;
          if (r.owner_phone) withPhone++;
          if ((r.contact_attempts ?? 0) > 0) contacted++;
          if (r.status === 'Interesse vorhanden' || r.status === 'Termin vereinbart') withInterest++;
          if (r.follow_up_at && new Date(r.follow_up_at).getTime() <= now) followUpDue++;
        }
        if (data.length < batchSize) break;
        from += batchSize;
      }
      const topGemeinden = Array.from(gemeindeMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      return {
        total, gemeindeCount: gemeindeMap.size, newCount, geprueft, interessant, ausgeschlossen,
        withOwner, withPhone, contacted, withInterest, followUpDue, topGemeinden,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useDistinctValues(field: 'bezirk' | 'plz' | 'zone' | 'kategorie' | 'gebaeudeart' | 'source_file' | 'gemeinde') {
  return useQuery({
    queryKey: ['master', 'distinct', field],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select(field).not(field, 'is', null).limit(100000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr = (data || []).map((d: any) => d[field]).filter(Boolean) as string[];
      return Array.from(new Set(arr)).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
}
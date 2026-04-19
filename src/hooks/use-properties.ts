import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;

interface UsePropertiesOptions {
  statusFilter?: string;
  gemeindeFilter?: string;
  zoneFilter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  baujahrVon?: number;
  baujahrBis?: number;
  flaecheMin?: number;
  flaecheMax?: number;
  areaMin?: number;
  areaMax?: number;
  geschosseMin?: number;
  ownerFilter?: string;
  listId?: string | null;
}

function applyPropertyFilters(query: any, options: UsePropertiesOptions) {
  const {
    statusFilter,
    gemeindeFilter,
    zoneFilter,
    search,
    baujahrVon,
    baujahrBis,
    flaecheMin,
    flaecheMax,
    areaMin,
    areaMax,
    geschosseMin,
    ownerFilter,
    listId,
  } = options;

  let nextQuery = query.eq('geb_status', 'Bestehend');

  if (zoneFilter && zoneFilter !== 'Alle') {
    nextQuery = nextQuery.like('zone', 'W%');
  }

  if (statusFilter && statusFilter !== 'Alle') {
    nextQuery = nextQuery.eq('status', statusFilter);
  } else {
    nextQuery = nextQuery.neq('status', 'Ausgeblendet');
  }
  if (gemeindeFilter && gemeindeFilter !== 'Alle') nextQuery = nextQuery.eq('gemeinde', gemeindeFilter);
  if (zoneFilter && zoneFilter !== 'Alle') nextQuery = nextQuery.eq('zone', zoneFilter);
  if (search) nextQuery = nextQuery.or(`address.ilike.%${search}%,egrid.ilike.%${search}%,owner_name.ilike.%${search}%,gemeinde.ilike.%${search}%,strassenname.ilike.%${search}%`);
  if (baujahrVon) nextQuery = nextQuery.gte('baujahr', baujahrVon);
  if (baujahrBis) nextQuery = nextQuery.lte('baujahr', baujahrBis);
  if (flaecheMin) nextQuery = nextQuery.gte('gebaeudeflaeche', flaecheMin);
  if (flaecheMax) nextQuery = nextQuery.lte('gebaeudeflaeche', flaecheMax);
  if (areaMin) nextQuery = nextQuery.gte('area', areaMin);
  if (areaMax) nextQuery = nextQuery.lte('area', areaMax);
  if (geschosseMin) nextQuery = nextQuery.gte('geschosse', geschosseMin);
  if (ownerFilter === 'mit') nextQuery = nextQuery.not('owner_name', 'is', null);
  if (ownerFilter === 'ohne') nextQuery = nextQuery.is('owner_name', null);
  if (listId) nextQuery = nextQuery.eq('list_id', listId);

  return nextQuery;
}

export async function fetchAllProperties(options: UsePropertiesOptions = {}) {
  const batchSize = 1000;
  let from = 0;
  let rows: Property[] = [];

  while (true) {
    const query = applyPropertyFilters(
      supabase
        .from('properties')
        .select('*')
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .range(from, from + batchSize - 1),
      options,
    );

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []) as Property[];
    rows = rows.concat(batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { page = 0, pageSize = 50 } = options;
  return useQuery({
    queryKey: ['properties', options],
    queryFn: async () => {
      const query = applyPropertyFilters(
        supabase
          .from('properties')
          .select('*', { count: 'exact' })
          .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
          .order('area', { ascending: false, nullsFirst: false })
          .range(page * pageSize, (page + 1) * pageSize - 1),
        options,
      );

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Property[], count: count || 0 };
    },
  });
}

export function useGemeinden() {
  return useQuery({
    queryKey: ['gemeinden'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('gemeinde')
        .not('gemeinde', 'is', null);
      if (error) throw error;
      const unique = [...new Set(data.map(d => d.gemeinde).filter(Boolean))].sort() as string[];
      return unique;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('zone')
        .not('zone', 'is', null)
        .like('zone', 'W%');
      if (error) throw error;
      const unique = [...new Set(data.map(d => d.zone).filter(Boolean))].sort() as string[];
      return unique;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnqueriedProperties(limit: number, listId?: string | null, isPrioList?: boolean) {
  return useQuery({
    queryKey: ['properties', 'unqueried', limit, listId, isPrioList],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('is_queried', false)
        .not('status', 'in', '("Ausgeblendet","Nicht interessant","Vorausgewählt")')
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .limit(limit);
      // For PRIO lists, skip zone/baujahr/geb_status filters
      if (!isPrioList) {
        query = query.like('zone', 'W%')
          .or('baujahr.lte.1980,baujahr.is.null')
          .eq('geb_status', 'Bestehend');
      }
      if (listId) query = query.eq('list_id', listId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}

export function usePreselectedProperties(limit: number, listId?: string | null) {
  return useQuery({
    queryKey: ['properties', 'preselected', limit, listId],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('status', 'Vorausgewählt')
        .eq('is_queried', false)
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (listId) query = query.eq('list_id', listId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}




export function useInsertProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (properties: TablesInsert<'properties'>[]) => {
      for (let i = 0; i < properties.length; i += 500) {
        const batch = properties.slice(i, i + 500);
        const { error } = await supabase.from('properties').insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'properties'> & { id: string }) => {
      const { error } = await supabase.from('properties').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function usePropertyStats() {
  return useQuery({
    queryKey: ['properties', 'stats'],
    queryFn: async () => {
      let allData: { status: string; is_queried: boolean; owner_name: string | null; gemeinde: string | null }[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('status, is_queried, owner_name, gemeinde')
          .or('baujahr.lte.1980,baujahr.is.null')
          .like('zone', 'W%')
          .eq('geb_status', 'Bestehend')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        allData = allData.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      const total = allData.length;
      const queried = allData.filter(p => p.is_queried).length;
      const withOwner = allData.filter(p => p.owner_name).length;
      const statuses: Record<string, number> = {};
      const gemeinden: Record<string, number> = {};
      allData.forEach(p => {
        statuses[p.status] = (statuses[p.status] || 0) + 1;
        if (p.gemeinde) gemeinden[p.gemeinde] = (gemeinden[p.gemeinde] || 0) + 1;
      });
      return { total, queried, withOwner, pending: total - queried, statuses, gemeinden };
    },
  });
}

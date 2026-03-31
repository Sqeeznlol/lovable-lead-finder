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
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { statusFilter, gemeindeFilter, zoneFilter, search, page = 0, pageSize = 50,
    baujahrVon, baujahrBis, flaecheMin, flaecheMax, areaMin, areaMax, geschosseMin, ownerFilter } = options;
  return useQuery({
    queryKey: ['properties', statusFilter, gemeindeFilter, zoneFilter, search, page, pageSize,
      baujahrVon, baujahrBis, flaecheMin, flaecheMax, areaMin, areaMax, geschosseMin, ownerFilter],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Exclude post-1980 buildings
      query = query.or('baujahr.lte.1980,baujahr.is.null');
      // Only include Wohnzonen (zones starting with W)
      query = query.like('zone', 'W%');
      // Only include existing buildings (exclude projektiert, bewilligt, im Bau)
      query = query.eq('geb_status', 'Bestehend');

      if (statusFilter && statusFilter !== 'Alle') {
        query = query.eq('status', statusFilter);
      }
      if (gemeindeFilter && gemeindeFilter !== 'Alle') {
        query = query.eq('gemeinde', gemeindeFilter);
      }
      if (zoneFilter && zoneFilter !== 'Alle') {
        query = query.eq('zone', zoneFilter);
      }
      if (search) {
        query = query.or(`address.ilike.%${search}%,egrid.ilike.%${search}%,owner_name.ilike.%${search}%,gemeinde.ilike.%${search}%,strassenname.ilike.%${search}%`);
      }
      if (baujahrVon) query = query.gte('baujahr', baujahrVon);
      if (baujahrBis) query = query.lte('baujahr', baujahrBis);
      if (flaecheMin) query = query.gte('gebaeudeflaeche', flaecheMin);
      if (flaecheMax) query = query.lte('gebaeudeflaeche', flaecheMax);
      if (areaMin) query = query.gte('area', areaMin);
      if (areaMax) query = query.lte('area', areaMax);
      if (geschosseMin) query = query.gte('geschosse', geschosseMin);
      if (ownerFilter === 'mit') query = query.not('owner_name', 'is', null);
      if (ownerFilter === 'ohne') query = query.is('owner_name', null);

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

export function useUnqueriedProperties(limit: number) {
  return useQuery({
    queryKey: ['properties', 'unqueried', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_queried', false)
        .like('zone', 'W%')
        .or('baujahr.lte.1980,baujahr.is.null')
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .limit(limit);
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

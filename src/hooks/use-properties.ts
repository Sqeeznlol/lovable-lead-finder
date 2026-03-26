import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;

interface UsePropertiesOptions {
  statusFilter?: string;
  gemeindeFilter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { statusFilter, gemeindeFilter, search, page = 0, pageSize = 50 } = options;
  return useQuery({
    queryKey: ['properties', statusFilter, gemeindeFilter, search, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
        .order('area', { ascending: false, nullsFirst: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter && statusFilter !== 'Alle') {
        query = query.eq('status', statusFilter);
      }
      if (gemeindeFilter && gemeindeFilter !== 'Alle') {
        query = query.eq('gemeinde', gemeindeFilter);
      }
      // Exclude Industrie, Gewerbe, Landwirtschaft zones
      query = query.not('zone', 'in', '("I","G","L")');
      if (search) {
        query = query.or(`address.ilike.%${search}%,egrid.ilike.%${search}%,owner_name.ilike.%${search}%,gemeinde.ilike.%${search}%,strassenname.ilike.%${search}%`);
      }

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

export function useUnqueriedProperties(limit: number) {
  return useQuery({
    queryKey: ['properties', 'unqueried', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_queried', false)
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
      // Fetch all in pages of 1000 to bypass limit
      let allData: { status: string; is_queried: boolean; owner_name: string | null; gemeinde: string | null }[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('status, is_queried, owner_name, gemeinde')
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Property = Tables<'properties'>;

export function useProperties(statusFilter?: string) {
  return useQuery({
    queryKey: ['properties', statusFilter],
    queryFn: async () => {
      let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
      if (statusFilter && statusFilter !== 'Alle') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
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
        .order('created_at', { ascending: true })
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
      const { error } = await supabase.from('properties').insert(properties);
      if (error) throw error;
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
      const { data, error } = await supabase.from('properties').select('status, is_queried, owner_name');
      if (error) throw error;
      const total = data.length;
      const queried = data.filter(p => p.is_queried).length;
      const withOwner = data.filter(p => p.owner_name).length;
      const statuses: Record<string, number> = {};
      data.forEach(p => { statuses[p.status] = (statuses[p.status] || 0) + 1; });
      return { total, queried, withOwner, pending: total - queried, statuses };
    },
  });
}

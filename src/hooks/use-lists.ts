import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { create } from 'zustand';

export interface PropertyList {
  id: string;
  name: string;
  priority: number;
  color: string | null;
  property_count: number;
  created_at: string;
}

// Global store for selected list filter
interface ListFilterStore {
  selectedListId: string | null; // null = "Alle"
  setSelectedListId: (id: string | null) => void;
}

export const useListFilter = create<ListFilterStore>((set) => ({
  selectedListId: null,
  setSelectedListId: (id) => set({ selectedListId: id }),
}));

export function useLists() {
  return useQuery({
    queryKey: ['property_lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_lists')
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return data as PropertyList[];
    },
    staleTime: 60 * 1000,
  });
}

export function useListCounts() {
  return useQuery({
    queryKey: ['property_lists', 'counts'],
    queryFn: async () => {
      // Get actual counts per list
      const { data, error } = await supabase
        .from('properties')
        .select('list_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      let noList = 0;
      data.forEach(p => {
        if (p.list_id) {
          counts[p.list_id] = (counts[p.list_id] || 0) + 1;
        } else {
          noList++;
        }
      });
      return { counts, noList, total: data.length };
    },
    staleTime: 30 * 1000,
  });
}

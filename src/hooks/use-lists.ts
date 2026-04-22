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

export interface ListStatusBreakdown {
  total: number;
  byStatus: Record<string, number>;
  // Workflow buckets
  offen: number;          // Neu, Vorausgewählt
  inBearbeitung: number;  // Eigentümer ermittelt, Telefon gefunden, Post, Kontaktiert, Interesse, Interessant
  exportiert: number;     // Exportiert
  ausgeschlossen: number; // Nicht interessant, Ausgeblendet, Geringe Chance
}

export function useListStatusBreakdown(listId: string | null) {
  return useQuery({
    queryKey: ['property_lists', 'status-breakdown', listId],
    queryFn: async (): Promise<ListStatusBreakdown> => {
      let query = supabase.from('properties').select('status');
      if (listId) {
        query = query.eq('list_id', listId);
      } else {
        query = query.is('list_id', null);
      }
      // Pull up to 100k for accurate counts on big lists
      const { data, error } = await query.limit(100000);
      if (error) throw error;

      const byStatus: Record<string, number> = {};
      let offen = 0, inBearbeitung = 0, exportiert = 0, ausgeschlossen = 0;

      const OFFEN = new Set(['Neu', 'Vorausgewählt']);
      const PROGRESS = new Set([
        'Eigentümer ermittelt', 'Telefon gefunden', 'Post',
        'Kontaktiert', 'Interesse', 'Interessant',
      ]);
      const EXPORTED = new Set(['Exportiert']);
      const EXCLUDED = new Set(['Nicht interessant', 'Ausgeblendet', 'Geringe Chance']);

      for (const p of data || []) {
        const s = p.status || 'Neu';
        byStatus[s] = (byStatus[s] || 0) + 1;
        if (OFFEN.has(s)) offen++;
        else if (PROGRESS.has(s)) inBearbeitung++;
        else if (EXPORTED.has(s)) exportiert++;
        else if (EXCLUDED.has(s)) ausgeschlossen++;
      }

      return {
        total: (data || []).length,
        byStatus,
        offen,
        inBearbeitung,
        exportiert,
        ausgeschlossen,
      };
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

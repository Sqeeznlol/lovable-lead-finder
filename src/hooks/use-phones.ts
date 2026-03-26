import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type PhoneNumber = Tables<'phone_numbers'>;

export function usePhoneNumbers() {
  return useQuery({
    queryKey: ['phone_numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('phone_numbers').select('*').order('created_at');
      if (error) throw error;
      return data as PhoneNumber[];
    },
  });
}

export function useAddPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ number, label }: { number: string; label?: string }) => {
      const { error } = await supabase.from('phone_numbers').insert({ number, label });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phone_numbers'] }),
  });
}

export function useDeletePhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('phone_numbers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phone_numbers'] }),
  });
}

export function useResetPhoneQueries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('phone_numbers').update({
        daily_queries_used: 0,
        last_query_date: new Date().toISOString().split('T')[0],
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phone_numbers'] }),
  });
}

export function useIncrementPhoneQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: phone, error: fetchError } = await supabase
        .from('phone_numbers')
        .select('daily_queries_used')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      const { error } = await supabase.from('phone_numbers').update({
        daily_queries_used: (phone.daily_queries_used || 0) + 1,
        last_query_date: new Date().toISOString().split('T')[0],
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phone_numbers'] }),
  });
}

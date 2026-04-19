import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type PhoneNumber = Tables<'phone_numbers'>;

export function usePhoneNumbers() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['phone_numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('phone_numbers').select('*').order('created_at');
      if (error) throw error;
      const phones = (data || []) as PhoneNumber[];

      // Auto-reset: any phone whose last_query_date is before today gets its counter reset to 0.
      const today = new Date().toISOString().split('T')[0];
      const stale = phones.filter(p => p.last_query_date !== today && p.daily_queries_used > 0);
      if (stale.length > 0) {
        await Promise.all(
          stale.map(p =>
            supabase
              .from('phone_numbers')
              .update({ daily_queries_used: 0, last_query_date: today })
              .eq('id', p.id),
          ),
        );
        return phones.map(p =>
          stale.find(s => s.id === p.id)
            ? { ...p, daily_queries_used: 0, last_query_date: today }
            : p,
        );
      }
      return phones;
    },
    // Refetch when day changes (poll every 5 min so midnight rollover triggers reset)
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Schedule an automatic refetch of phone_numbers exactly at midnight (local time)
 * so the daily counters reset visibly without waiting for the polling interval.
 */
export function useMidnightReset() {
  const qc = useQueryClient();
  if (typeof window !== 'undefined') {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0); // 00:00:05 next day
    const ms = next.getTime() - now.getTime();
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['phone_numbers'] });
    }, ms);
  }
  return null;
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

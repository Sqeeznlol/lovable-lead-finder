import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAutomationSettings } from './use-app-settings';

export function useFollowUpStats() {
  const { data: settings } = useAutomationSettings();
  const stagnationDays = settings?.stagnation_days ?? 7;

  return useQuery({
    queryKey: ['follow-ups', 'stats', stagnationDays],
    queryFn: async () => {
      const now = new Date();
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
      const stagnantBefore = new Date(now); stagnantBefore.setDate(stagnantBefore.getDate() - stagnationDays);

      const [dueToday, dueWeek, stagnant] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .not('follow_up_at', 'is', null)
          .lte('follow_up_at', todayEnd.toISOString()),
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .not('follow_up_at', 'is', null)
          .lte('follow_up_at', weekEnd.toISOString()),
        (supabase as any).from('properties').select('*', { count: 'exact', head: true })
          .lte('stage_changed_at', stagnantBefore.toISOString())
          .not('status', 'in', '("Exportiert","Ausgeblendet","Nicht interessant")'),
      ]);

      return {
        dueToday: dueToday.count || 0,
        dueWeek: dueWeek.count || 0,
        stagnant: stagnant.count || 0,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useDailyDigest() {
  return useQuery({
    queryKey: ['daily-digest'],
    queryFn: async () => {
      const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0,0,0,0);
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

      const [decisionsYesterday, exportsYesterday, dueToday] = await Promise.all([
        supabase.from('property_decisions').select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayStart.toISOString())
          .lt('created_at', todayStart.toISOString()),
        supabase.from('export_logs').select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayStart.toISOString())
          .lt('created_at', todayStart.toISOString()),
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .not('follow_up_at', 'is', null)
          .lte('follow_up_at', todayEnd.toISOString()),
      ]);

      return {
        decisionsYesterday: decisionsYesterday.count || 0,
        exportsYesterday: exportsYesterday.count || 0,
        dueToday: dueToday.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
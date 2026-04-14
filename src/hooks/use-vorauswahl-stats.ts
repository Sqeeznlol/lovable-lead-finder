import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface VorauswahlStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayProcessed: number;
  progressPercent: number;
}

export function useVorauswahlStats() {
  return useQuery({
    queryKey: ['vorauswahl-stats'],
    queryFn: async (): Promise<VorauswahlStats> => {
      // Get counts by review_status for relevant properties
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Count all eligible properties (Wohnzone, Bestehend)
      const { count: total } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .like('zone', 'W%')
        .eq('geb_status', 'Bestehend');

      // Count pending (not yet decided)
      const { count: pending } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .like('zone', 'W%')
        .eq('geb_status', 'Bestehend')
        .eq('review_status', 'pending')
        .not('status', 'in', '("Ausgeblendet","Nicht interessant","Vorausgewählt")');

      // Count approved
      const { count: approved } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .like('zone', 'W%')
        .eq('geb_status', 'Bestehend')
        .eq('review_status', 'approved');

      // Count rejected
      const { count: rejected } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .like('zone', 'W%')
        .eq('geb_status', 'Bestehend')
        .eq('review_status', 'rejected');

      // Count today's decisions
      const { count: todayProcessed } = await supabase
        .from('property_decisions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      const totalNum = total || 0;
      const pendingNum = pending || 0;
      const approvedNum = approved || 0;
      const rejectedNum = rejected || 0;
      const processed = approvedNum + rejectedNum;
      const progressPercent = totalNum > 0 ? Math.round((processed / totalNum) * 100) : 0;

      return {
        total: totalNum,
        pending: pendingNum,
        approved: approvedNum,
        rejected: rejectedNum,
        todayProcessed: todayProcessed || 0,
        progressPercent,
      };
    },
    staleTime: 10 * 1000,
  });
}

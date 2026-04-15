import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useListFilter } from '@/hooks/use-lists';

interface VorauswahlStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayProcessed: number;
  progressPercent: number;
}

export function useVorauswahlStats() {
  const { selectedListId } = useListFilter();
  
  return useQuery({
    queryKey: ['vorauswahl-stats', selectedListId],
    queryFn: async (): Promise<VorauswahlStats> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const addListFilter = (q: any) => {
        if (selectedListId) return q.eq('list_id', selectedListId);
        return q;
      };

      const { count: total } = await addListFilter(
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .like('zone', 'W%').eq('geb_status', 'Bestehend')
      );

      const { count: pending } = await addListFilter(
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .like('zone', 'W%').eq('geb_status', 'Bestehend')
          .eq('review_status', 'pending')
          .not('status', 'in', '("Ausgeblendet","Nicht interessant","Vorausgewählt")')
      );

      const { count: approved } = await addListFilter(
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .like('zone', 'W%').eq('geb_status', 'Bestehend')
          .eq('review_status', 'approved')
      );

      const { count: rejected } = await addListFilter(
        supabase.from('properties').select('*', { count: 'exact', head: true })
          .like('zone', 'W%').eq('geb_status', 'Bestehend')
          .eq('review_status', 'rejected')
      );

      const { count: todayProcessed } = await supabase
        .from('property_decisions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      const totalNum = total || 0;
      const approvedNum = approved || 0;
      const rejectedNum = rejected || 0;
      const processed = approvedNum + rejectedNum;
      const progressPercent = totalNum > 0 ? Math.round((processed / totalNum) * 100) : 0;

      return {
        total: totalNum,
        pending: pending || 0,
        approved: approvedNum,
        rejected: rejectedNum,
        todayProcessed: todayProcessed || 0,
        progressPercent,
      };
    },
    staleTime: 10 * 1000,
  });
}

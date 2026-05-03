import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useListFilter, useLists } from '@/hooks/use-lists';

interface VorauswahlStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayProcessed: number;
  weekProcessed: number;
  conversionRate: number;
  progressPercent: number;
  pipedriveExported: number;
}

export function useVorauswahlStats() {
  const { selectedListId } = useListFilter();
  const { data: lists } = useLists();
  const isPrio = !!(selectedListId && lists?.find(l => l.id === selectedListId && l.priority < 0));
  
  return useQuery({
    queryKey: ['vorauswahl-stats', selectedListId, isPrio],
    queryFn: async (): Promise<VorauswahlStats> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      type PropertiesCountQuery = ReturnType<typeof supabase.from<'properties'>>['select'] extends never
        ? never
        : ReturnType<ReturnType<typeof supabase.from<'properties'>>['select']>;
      const buildQuery = (extra?: (q: PropertiesCountQuery) => PropertiesCountQuery) => {
        let q = supabase.from('properties').select('*', { count: 'exact', head: true }) as PropertiesCountQuery;
        if (!isPrio) {
          q = q.like('zone', 'W%').eq('geb_status', 'Bestehend') as PropertiesCountQuery;
        }
        if (selectedListId) q = q.eq('list_id', selectedListId) as PropertiesCountQuery;
        if (extra) q = extra(q);
        return q;
      };

      const { count: total } = await buildQuery();

      const { count: pending } = await buildQuery(q =>
        q.eq('review_status', 'pending')
          .not('status', 'in', '("Ausgeblendet","Nicht interessant","Vorausgewählt")')
      );

      const { count: approved } = await buildQuery(q =>
        q.eq('review_status', 'approved')
      );

      const { count: rejected } = await buildQuery(q =>
        q.eq('review_status', 'rejected')
      );

      const { count: todayProcessed } = await supabase
        .from('property_decisions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      const { count: weekProcessed } = await supabase
        .from('property_decisions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString());

      const { count: pipedriveExported } = await buildQuery(q =>
        q.eq('export_status', 'exported') as typeof q
      );

      const totalNum = total || 0;
      const approvedNum = approved || 0;
      const rejectedNum = rejected || 0;
      const processed = approvedNum + rejectedNum;
      const progressPercent = totalNum > 0 ? Math.round((processed / totalNum) * 100) : 0;
      const conversionRate = processed > 0 ? Math.round((approvedNum / processed) * 100) : 0;

      return {
        total: totalNum,
        pending: pending || 0,
        approved: approvedNum,
        rejected: rejectedNum,
        todayProcessed: todayProcessed || 0,
        weekProcessed: weekProcessed || 0,
        conversionRate,
        progressPercent,
        pipedriveExported: pipedriveExported || 0,
      };
    },
    staleTime: 10 * 1000,
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationSettings {
  sms_auto_confirm: boolean;
  auto_advance: boolean;
  daily_digest: boolean;
  follow_up_days: number;
  stagnation_days: number;
}

const DEFAULTS: AutomationSettings = {
  sms_auto_confirm: false,
  auto_advance: true,
  daily_digest: false,
  follow_up_days: 3,
  stagnation_days: 7,
};

export function useAutomationSettings() {
  return useQuery({
    queryKey: ['app_settings', 'automation'],
    queryFn: async (): Promise<AutomationSettings> => {
      const { data } = await (supabase as any)
        .from('app_settings')
        .select('value')
        .eq('key', 'automation')
        .maybeSingle();
      return { ...DEFAULTS, ...((data?.value as Partial<AutomationSettings>) || {}) };
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateAutomationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AutomationSettings>) => {
      const { data: existing } = await (supabase as any)
        .from('app_settings')
        .select('value')
        .eq('key', 'automation')
        .maybeSingle();
      const merged = { ...DEFAULTS, ...((existing?.value as object) || {}), ...patch };
      const { error } = await (supabase as any)
        .from('app_settings')
        .upsert({ key: 'automation', value: merged, updated_at: new Date().toISOString() });
      if (error) throw error;
      return merged;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app_settings'] }),
  });
}
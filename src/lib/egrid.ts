import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Von der EGRID zur Parzelle im Bestand (properties.id).
 *
 * Kartierung der Reiter, 15. November: Leads, Lead-Listen, Arrondierung,
 * Gebäude und die Fonds-Seite kennen eine Parzelle nur über ihre EGRID,
 * die Objektansicht öffnet sich aber über ?parzelle=<id>. Darum waren sie
 * Inseln. Dieser Auflöser ist die Brücke; ?egrid= in der Adresse nutzt ihn.
 */
export const EGRID_MUSTER = /^CH[0-9A-Z]{12}$/;

export async function parzelleZuEgrid(egrid: string | null | undefined): Promise<string | null> {
  if (!egrid || !EGRID_MUSTER.test(egrid)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (supabase as any).from('properties').select('id').eq('egrid', egrid).limit(1).maybeSingle();
  return r.error ? null : (r.data?.id ?? null);
}

/** Die Parzelle zu einer EGRID; null, wenn sie nicht im Bestand ist (Aurora führt ZH und TG). */
export function useParzelleZuEgrid(egrid: string | null | undefined) {
  return useQuery({
    queryKey: ['parzelle-zu-egrid', egrid],
    queryFn: () => parzelleZuEgrid(egrid),
    enabled: !!egrid && EGRID_MUSTER.test(egrid),
    staleTime: 60 * 60 * 1000,
  });
}

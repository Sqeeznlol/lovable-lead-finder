-- Add index to speed up gemeinde aggregation
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde_status 
ON public.properties (gemeinde, preselection_status, status);

-- Materialized view for fast gemeinde stats
DROP MATERIALIZED VIEW IF EXISTS public.gemeinde_stats_mv;
CREATE MATERIALIZED VIEW public.gemeinde_stats_mv AS
SELECT
  COALESCE(p.gemeinde, '— ohne Gemeinde —') AS gemeinde,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (
    WHERE p.preselection_status = 'Nicht geprüft'
       OR p.status IN ('Neu','In Prüfung')
  )::bigint AS offen,
  COUNT(*) FILTER (
    WHERE NOT (
      p.preselection_status = 'Nicht geprüft'
       OR p.status IN ('Neu','In Prüfung')
    )
  )::bigint AS geprueft,
  COUNT(*) FILTER (
    WHERE p.preselection_status IN ('Sehr interessant','Potenzial vorhanden')
       OR p.status IN ('Interessant','Interesse vorhanden','Termin vereinbart')
  )::bigint AS interessant
FROM public.properties p
GROUP BY COALESCE(p.gemeinde, '— ohne Gemeinde —');

CREATE UNIQUE INDEX idx_gemeinde_stats_mv_gemeinde ON public.gemeinde_stats_mv (gemeinde);

-- Replace RPC to read from materialized view (instant)
CREATE OR REPLACE FUNCTION public.gemeinde_stats()
RETURNS TABLE(gemeinde text, total bigint, offen bigint, geprueft bigint, interessant bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT gemeinde, total, offen, geprueft, interessant
  FROM public.gemeinde_stats_mv
  ORDER BY total DESC;
$function$;

-- Refresh function (callable via RPC)
CREATE OR REPLACE FUNCTION public.refresh_gemeinde_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.gemeinde_stats_mv;
$function$;

GRANT SELECT ON public.gemeinde_stats_mv TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gemeinde_stats() TO anon, authenticated;
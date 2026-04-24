
CREATE OR REPLACE FUNCTION public.gemeinde_stats()
RETURNS TABLE (
  gemeinde text,
  total bigint,
  offen bigint,
  geprueft bigint,
  interessant bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
  GROUP BY COALESCE(p.gemeinde, '— ohne Gemeinde —')
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.gemeinde_stats() TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties(gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_preselection_status ON public.properties(preselection_status);

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS eigentuemer_name text,
  ADD COLUMN IF NOT EXISTS eigentuemer_adresse text,
  ADD COLUMN IF NOT EXISTS eigentuemer_plz_ort text,
  ADD COLUMN IF NOT EXISTS eigentuemer_fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_eigentuemer_name ON public.properties(eigentuemer_name) WHERE eigentuemer_name IS NOT NULL;
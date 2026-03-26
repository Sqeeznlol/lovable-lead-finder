ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS plz TEXT,
  ADD COLUMN IF NOT EXISTS ortschaftsname TEXT,
  ADD COLUMN IF NOT EXISTS strassenname TEXT,
  ADD COLUMN IF NOT EXISTS hausnummer TEXT,
  ADD COLUMN IF NOT EXISTS gvz_nr TEXT,
  ADD COLUMN IF NOT EXISTS gwr_egid TEXT,
  ADD COLUMN IF NOT EXISTS gebaeudeart TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS gemeinde TEXT,
  ADD COLUMN IF NOT EXISTS gebaeudeflaeche NUMERIC,
  ADD COLUMN IF NOT EXISTS baujahr INTEGER,
  ADD COLUMN IF NOT EXISTS kategorie TEXT,
  ADD COLUMN IF NOT EXISTS geschosse NUMERIC,
  ADD COLUMN IF NOT EXISTS wohnungen NUMERIC,
  ADD COLUMN IF NOT EXISTS parzelle TEXT,
  ADD COLUMN IF NOT EXISTS geb_status TEXT,
  ADD COLUMN IF NOT EXISTS bezirk TEXT,
  ADD COLUMN IF NOT EXISTS plz_ort TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_egrid ON public.properties(egrid);
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties(gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties(is_queried);
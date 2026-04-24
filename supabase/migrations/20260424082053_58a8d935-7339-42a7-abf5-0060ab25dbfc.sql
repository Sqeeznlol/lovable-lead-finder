-- ===========================================
-- 1. PROPERTIES: Neue Felder für Master-Modell
-- ===========================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS hnf_schaetzung numeric,
  ADD COLUMN IF NOT EXISTS wohnflaeche numeric,
  ADD COLUMN IF NOT EXISTS nutzflaeche numeric,
  ADD COLUMN IF NOT EXISTS renovationsjahr integer,
  ADD COLUMN IF NOT EXISTS ausnuetzung numeric,
  ADD COLUMN IF NOT EXISTS preselection_status text NOT NULL DEFAULT 'Nicht geprüft',
  ADD COLUMN IF NOT EXISTS preselection_note text,
  ADD COLUMN IF NOT EXISTS preselection_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS denkmalschutz_titel text,
  ADD COLUMN IF NOT EXISTS isos_titel text,
  ADD COLUMN IF NOT EXISTS bezirksort text,
  ADD COLUMN IF NOT EXISTS objektadresse text,
  ADD COLUMN IF NOT EXISTS kanton text DEFAULT 'ZH',
  ADD COLUMN IF NOT EXISTS housing_stat_url text,
  ADD COLUMN IF NOT EXISTS gis_url text,
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

-- Add CHECK-like default for preselection_status (allow free-text but recommend set)
COMMENT ON COLUMN public.properties.preselection_status IS
  'Vorwahl/Vorselektion: Nicht geprüft | Sehr interessant | Potenzial vorhanden | Später prüfen | Kein Potenzial | Ausschliessen';

COMMENT ON COLUMN public.properties.status IS
  'Akquise-Status: Neu | In Prüfung | Interessant | Nicht interessant | Eigentümer gesucht | Eigentümer gefunden | Eigentümer ermittelt | Telefonnummer gesucht | Telefon gefunden | Kontaktiert | Kein Interesse | Interesse vorhanden | Termin vereinbart | Follow-up | Exportiert | Archiviert | Ausgeblendet | Vorausgewählt | Geringe Chance | Post';

-- ===========================================
-- 2. INDEXES für Master-Liste & Filter
-- ===========================================

-- Eindeutiger Index auf EGRID (verhindert Duplikate auf DB-Ebene)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_properties_egrid
  ON public.properties (egrid)
  WHERE egrid IS NOT NULL AND egrid <> '';

-- Filter-Indexe
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde         ON public.properties (gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_bezirk           ON public.properties (bezirk);
CREATE INDEX IF NOT EXISTS idx_properties_plz              ON public.properties (plz);
CREATE INDEX IF NOT EXISTS idx_properties_status           ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_preselection     ON public.properties (preselection_status);
CREATE INDEX IF NOT EXISTS idx_properties_kategorie        ON public.properties (kategorie);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr          ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status       ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_gebaeudeflaeche  ON public.properties (gebaeudeflaeche);
CREATE INDEX IF NOT EXISTS idx_properties_area             ON public.properties (area);
CREATE INDEX IF NOT EXISTS idx_properties_imported_at      ON public.properties (imported_at);
CREATE INDEX IF NOT EXISTS idx_properties_follow_up_at     ON public.properties (follow_up_at);

-- Composite for typical Master-Liste Query (Gemeinde + Status)
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde_status
  ON public.properties (gemeinde, status);

-- ===========================================
-- 3. IMPORT_LOGS Tabelle
-- ===========================================

CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  list_id uuid REFERENCES public.property_lists(id) ON DELETE SET NULL,
  list_name text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_duplicates integer NOT NULL DEFAULT 0,
  rows_invalid integer NOT NULL DEFAULT 0,
  new_gemeinden integer NOT NULL DEFAULT 0,
  user_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read import_logs" ON public.import_logs;
CREATE POLICY "Anyone can read import_logs"
  ON public.import_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert import_logs" ON public.import_logs;
CREATE POLICY "Anyone can insert import_logs"
  ON public.import_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON public.import_logs (created_at DESC);

-- ===========================================
-- 4. SAVED_FILTERS Tabelle
-- ===========================================

CREATE TABLE IF NOT EXISTS public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'master', -- master | akquise | vorwahl
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read saved_filters" ON public.saved_filters;
CREATE POLICY "Anyone can read saved_filters"
  ON public.saved_filters FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can manage saved_filters" ON public.saved_filters;
CREATE POLICY "Anyone can manage saved_filters"
  ON public.saved_filters FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_saved_filters_updated_at ON public.saved_filters;
CREATE TRIGGER trg_saved_filters_updated_at
  BEFORE UPDATE ON public.saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 5. EXPORT_LOGS: Filter-Snapshot ergänzen
-- ===========================================

ALTER TABLE public.export_logs
  ADD COLUMN IF NOT EXISTS export_name text,
  ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS row_count integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON public.export_logs (created_at DESC);
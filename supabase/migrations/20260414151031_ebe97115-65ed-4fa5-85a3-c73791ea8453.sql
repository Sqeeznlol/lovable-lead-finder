-- Performance indexes for properties table
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_review_status ON public.properties (review_status);
CREATE INDEX IF NOT EXISTS idx_properties_acquisition_status ON public.properties (acquisition_status);
CREATE INDEX IF NOT EXISTS idx_properties_phone_search_status ON public.properties (phone_search_status);
CREATE INDEX IF NOT EXISTS idx_properties_export_status ON public.properties (export_status);
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties (gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_bezirk ON public.properties (bezirk);
CREATE INDEX IF NOT EXISTS idx_properties_zone ON public.properties (zone);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_ai_score ON public.properties (ai_score);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties (is_queried);

-- Composite index for Vorauswahl workflow (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_properties_vorauswahl ON public.properties (is_queried, status, geb_status, zone) 
WHERE geb_status = 'Bestehend' AND zone LIKE 'W%';

-- Composite index for preselected properties
CREATE INDEX IF NOT EXISTS idx_properties_preselected ON public.properties (status, is_queried) 
WHERE status = 'Vorausgewählt' AND is_queried = false;

-- Add processing_error column
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS processing_error text;

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_table, target_id);
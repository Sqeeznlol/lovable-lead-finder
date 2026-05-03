
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_stage_changed ON public.properties;
CREATE TRIGGER trg_properties_stage_changed
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_stage_changed_at();

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can write app_settings" ON public.app_settings;
CREATE POLICY "Anyone can write app_settings" ON public.app_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('automation', '{"sms_auto_confirm":false,"auto_advance":true,"daily_digest":false,"follow_up_days":3,"stagnation_days":7}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_properties_stage_changed_at ON public.properties (stage_changed_at);

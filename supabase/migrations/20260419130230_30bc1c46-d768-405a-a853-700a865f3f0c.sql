-- 1. Neue Master-Liste anlegen
INSERT INTO public.property_lists (name, priority, color, property_count)
VALUES ('Master Liste 184k', 50, '#3b82f6', 0)
ON CONFLICT DO NOTHING;

-- 2. Alle Properties OHNE Telefon löschen (Smart Merge: Tel-Einträge bleiben)
DELETE FROM public.export_logs 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.phone_search_logs 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.property_decisions 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '';

-- 3. Unique-Index auf EGRID (falls noch nicht vorhanden)
CREATE UNIQUE INDEX IF NOT EXISTS properties_egrid_unique ON public.properties(egrid) WHERE egrid IS NOT NULL;

-- 4. Staging-Tabelle für Import
DROP TABLE IF EXISTS public.properties_staging;
CREATE TABLE public.properties_staging (
  address text,
  egrid text,
  plot_number text,
  parzelle text,
  bfs_nr text,
  gwr_egid text,
  gvz_nr text,
  gebaeudeart text,
  strassenname text,
  hausnummer text,
  plz text,
  plz_ort text,
  gemeinde text,
  ortschaftsname text,
  bezirk text,
  google_maps_url text,
  streetview_url text,
  zone text,
  area numeric,
  gebaeudeflaeche numeric,
  baujahr integer,
  kategorie text,
  geschosse numeric,
  wohnungen numeric,
  geb_status text,
  denkmalschutz text,
  isos text
);
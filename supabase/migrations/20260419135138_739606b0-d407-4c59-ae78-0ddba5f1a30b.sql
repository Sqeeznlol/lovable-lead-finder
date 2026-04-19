-- 1. Komplett-Reset: alle abhängigen Daten löschen
DELETE FROM public.export_logs;
DELETE FROM public.phone_search_logs;
DELETE FROM public.property_decisions;
DELETE FROM public.properties;
DELETE FROM public.property_lists;

-- 2. Neue Master-Liste anlegen
INSERT INTO public.property_lists (name, priority, color, property_count)
VALUES ('Lovable Master', 1, '#3b82f6', 0);

-- 3. Unique-Index auf EGRID sicherstellen
CREATE UNIQUE INDEX IF NOT EXISTS properties_egrid_unique ON public.properties(egrid) WHERE egrid IS NOT NULL;

-- 4. Staging-Tabelle für Bulk-Import
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
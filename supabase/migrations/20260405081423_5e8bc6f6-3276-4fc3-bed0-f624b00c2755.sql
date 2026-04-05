CREATE INDEX IF NOT EXISTS idx_properties_gebaeudeflaeche ON public.properties (gebaeudeflaeche DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_area ON public.properties (area DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_zone ON public.properties (zone);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties (is_queried);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_egrid ON public.properties (egrid);
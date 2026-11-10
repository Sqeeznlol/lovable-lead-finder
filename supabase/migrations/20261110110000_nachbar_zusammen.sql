-- =====================================================================
-- Mögliche Arrondierungen: beide Parzellen zusammen
-- =====================================================================
-- Julian, 10. November: "beide parzellen zusammen sieht und die daten
-- zusammenfügen kann also bsp hnf 1 und hnf 2 zusammen rechnen mit
-- potenzial". Dafür braucht jede Zeile auch die eigene Liegenschaft
-- (Gebäude, Geschossfläche aus dem GWR) und beide Umrisse (LV95, für die
-- Zeichnung ohne weitere Abfrage beim Bund).
-- =====================================================================

alter table public.nachbar_potenzial
  add column if not exists umriss          jsonb,
  add column if not exists haupt_flaeche   int,
  add column if not exists haupt_zone      text,
  add column if not exists haupt_gebaeude  int,
  add column if not exists haupt_baujahr   int,
  add column if not exists haupt_wohnungen int,
  add column if not exists haupt_gf_heute  int,
  add column if not exists haupt_umriss    jsonb;

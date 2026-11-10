-- =====================================================================
-- Mögliche Arrondierungen: jedes Gebäude einzeln, echte Werte des GWR
-- =====================================================================
-- Julian, 10. November: "es muss real aussehen damit auch dann später
-- der Architekt das rechnen kann und die echten Zahlen sieht, nicht
-- irgendeine Schätzung". Je Gebäude: EGID, Adresse, Baujahr, Status,
-- Geschosse, Grundfläche, Energiebezugsfläche, Volumen, Wohnungen und
-- die Summe der Wohnungsflächen -- so, wie das GWR sie führt.
-- haupt_flaeche ist ab jetzt die Fläche der Hauptparzelle selbst (zu
-- ihrem Umriss und ihren Gebäuden), haupt_nummer ihre Nummer.
-- =====================================================================

alter table public.nachbar_potenzial
  add column if not exists geb_liste       jsonb,
  add column if not exists haupt_geb_liste jsonb,
  add column if not exists haupt_nummer    text;

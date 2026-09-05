-- =====================================================================
-- Indizes für die Masterliste
-- =====================================================================
-- Gemessen am Bestand von 259'057 Zeilen (GitHub-Actions-Aufgabe
-- "tempo", 5. September):
--
--   ohne Sortierung, 50 Zeilen ............... 0.8 s
--   sortiert nach hnf_delta .................. Timeout
--   sortiert nach hnf_delta, nicht ausgeschl.  Timeout
--   sortiert nach marge_chf .................. Timeout
--
-- Die Masterliste sortiert standardmässig nach hnf_delta absteigend und
-- blendet ausgeschlossene Objekte aus -- also genau die Abfrage, die
-- abbricht. Ohne Index muss die Datenbank alle 259'000 Zeilen lesen und
-- sortieren, um die ersten fünfzig zu zeigen.
--
-- Die Indizes sind bewusst partiell: gesucht wird immer im kaufbaren
-- Bestand, ausgeschlossene Objekte interessieren beim Sortieren nie.
-- Das hält sie klein und schnell.
--
-- NULLS LAST entspricht der Leseweise der Liste: Objekte ohne Kennzahl
-- gehören ans Ende, nicht an den Anfang.
-- =====================================================================

-- Standardsortierung der Masterliste.
create index if not exists properties_hnf_delta_idx
  on public.properties (hnf_delta desc nulls last)
  where ausgeschlossen is not true;

-- Zweite Sortierung: Marge in Franken.
create index if not exists properties_marge_idx
  on public.properties (marge_chf desc nulls last)
  where ausgeschlossen is not true;

-- Sortierung nach Bewertungsstufe, mit der Marge als zweitem Kriterium.
create index if not exists properties_tier_idx
  on public.properties (score_tier, marge_chf desc nulls last)
  where ausgeschlossen is not true;

-- Zählungen der Übersicht liefen ebenfalls in den Timeout.
create index if not exists properties_ausgeschlossen_idx
  on public.properties (ausgeschlossen);

create index if not exists properties_scored_at_idx
  on public.properties (scored_at)
  where scored_at is null;

-- Filter nach Gemeinde in der Seitenleiste.
create index if not exists properties_gemeinde_idx
  on public.properties (gemeinde);

-- Damit der Planer die neuen Indizes auch nutzt, statt auf veralteten
-- Statistiken zu entscheiden.
analyze public.properties;

-- =====================================================================
-- Der Index, der zur wirklichen Abfrage passt
-- =====================================================================
-- Der Index von heute Mittag deckt Kanton und Flächenzuwachs ab. Die
-- Masterliste fragt aber mehr: sie blendet die ausgeschlossenen
-- Objekte aus und die von Hand archivierten dazu.
--
--   where kanton = 'TG'
--     and ausgeschlossen = false
--     and preselection_status <> 'Ausschliessen'
--   order by hnf_delta desc nulls last
--
-- Für die zwei zusätzlichen Bedingungen musste die Datenbank bisher
-- durch den halben Kanton gehen -- deshalb lud die Liste im Thurgau
-- so lange. Der Index bildet die Abfrage jetzt vollständig ab, und
-- weil ausgeschlossene Zeilen gar nicht erst hineinkommen, ist er
-- klein: von 396'271 Zeilen bleiben die, mit denen gearbeitet wird.
-- =====================================================================

create index if not exists idx_properties_arbeitsliste
  on public.properties (kanton, hnf_delta desc nulls last)
  where ausgeschlossen = false
    and preselection_status <> 'Ausschliessen';

-- Dieselbe Liste, nur nach Marge sortiert -- die zweite Voreinstellung.
create index if not exists idx_properties_arbeitsliste_marge
  on public.properties (kanton, marge_chf desc nulls last)
  where ausgeschlossen = false
    and preselection_status <> 'Ausschliessen';

analyze public.properties;

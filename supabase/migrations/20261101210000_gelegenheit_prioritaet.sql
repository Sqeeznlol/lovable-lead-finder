-- =====================================================================
-- Gelegenheit: Priorität und Nachbarn ausserhalb des Bestands
-- =====================================================================
-- Tims Arrondierungs-Ablauf, Schritt 4: "Ziele werden erzeugt und
-- priorisiert". Die Priorität wird beim Erkennen gerechnet
-- (src/lib/arrondierung.ts) und hier abgelegt, damit die Liste danach
-- sortiert werden kann, ohne für jede Zeile alle Nachbarn zu laden.
--
-- Nachbarn, die nicht im Bestand stehen, kann gelegenheit_parzelle
-- nicht aufnehmen -- die Spalte verweist auf properties. Dass es sie
-- gibt, ist aber die halbe Auskunft: ihre EGRID und Nummer stehen in
-- `fremde_nachbarn`, damit niemand meint, die Parzelle habe nur die
-- Nachbarn, die wir kennen.
-- =====================================================================

alter table public.gelegenheit
  add column if not exists prioritaet       numeric,
  add column if not exists fremde_nachbarn  jsonb;

create index if not exists idx_gelegenheit_prioritaet
  on public.gelegenheit (prioritaet desc nulls last);

-- =====================================================================
-- Mögliche Arrondierungen: Gefäss je Zeile
-- =====================================================================
-- Julian, 10. November: "ich muss zb den Fond auswählen können. und erst
-- dann sehen wer seine nachbarparzellen sind". Helvetica hat zwei Gefässe
-- (hsl: Helvetica Swiss Living Fund, hl: HL Anlagestiftung); die Kennung
-- ist die aus der Liste in 20261106110000_fondsleitung_helvetica.sql.
-- =====================================================================

alter table public.nachbar_potenzial add column if not exists gefaess text;
create index if not exists idx_nachbar_potenzial_gefaess on public.nachbar_potenzial (portfolio, gefaess);

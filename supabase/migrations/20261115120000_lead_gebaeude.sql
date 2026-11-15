-- =====================================================================
-- Lead-Listen aus dem Gebäuderegister (Deutschschweiz)
-- =====================================================================
-- Julian, 14. November: Lead-Listen aus dem Gebäuderegister weiterer
-- Kantone. Nur bestehende Wohngebäude mit Öl- oder Gasheizung, gebaut
-- bis 1980 (tools/gwr_leads.py); das ganze Register passte nicht in die
-- Datenbank (980 von 1107 MB am 15. November). Keine Eigentümer: die
-- stehen nicht im Register. Lesen nur angemeldet; Aurora zeigt die Liste
-- unter "Lead-Listen". Gefüllt vom Ablauf "Lead-Listen".
create table if not exists public.lead_gebaeude (
  egid       bigint primary key,
  egrid      text,
  kanton     text not null,
  bfs        smallint not null,
  gemeinde   text not null,
  strasse    text,
  plz        smallint,
  ort        text,
  baujahr    smallint,
  periode    smallint,
  wohnungen  smallint,
  klasse     smallint,
  heizung    smallint,   -- GENH1: 7520 Gas, 7530 Heizöl
  erzeuger   smallint,   -- GWAERZH1
  heizung_seit date,
  e          integer,
  n          integer
);
create index if not exists idx_lead_gebaeude_ort on public.lead_gebaeude (kanton, bfs);

alter table public.lead_gebaeude enable row level security;
drop policy if exists lead_gebaeude_lesen on public.lead_gebaeude;
create policy lead_gebaeude_lesen on public.lead_gebaeude for select to authenticated using (true);
revoke all on public.lead_gebaeude from anon;
grant select on public.lead_gebaeude to authenticated;

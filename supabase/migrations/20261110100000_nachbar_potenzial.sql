-- =====================================================================
-- Nachbarparzellen eines Kundenportfolios mit Potenzial
-- =====================================================================
-- Julian, 10. November: "mit dem Helvetica-Fonds eine Übersicht, welche
-- die Nachbarparzellen sind, damit wir sehen, welche Potenzial haben".
-- Je Position (Liegenschaft des Kunden) jede angrenzende Parzelle mit
-- Zone, Fläche, Gebäuden aus dem GWR und Punkten 0 bis 100 samt Gründen.
-- Gerechnet mit tools/nachbar_potenzial.py, für jeden Kanton gleich
-- (Bund: Amtliche Vermessung, Bauzonen, GWR).
--
-- Lesen nur angemeldet: Wer arrondieren will, verrät damit eine Absicht.
-- =====================================================================

create table if not exists public.nachbar_potenzial (
  id             bigserial primary key,
  portfolio      text not null,
  position       int not null,
  haupt_egrid    text not null,
  haupt_adresse  text not null,
  nachbar_egrid  text not null check (nachbar_egrid ~ '^CH[0-9A-Z]{12}$'),
  nummer         text,
  kanton         text,
  gemeinde       text,
  zone           text,
  flaeche        int,
  e              double precision,
  n              double precision,
  gebaeude       int,
  baujahr        int,
  geschosse      int,
  wohnungen      int,
  gf_heute       int,
  az_heute       numeric(6, 2),
  punkte         int not null default 0 check (punkte between 0 and 100),
  gruende        text,
  gerechnet_am   timestamptz not null default now(),
  unique (portfolio, haupt_egrid, nachbar_egrid)
);

create index if not exists idx_nachbar_potenzial_portfolio on public.nachbar_potenzial (portfolio, punkte desc);

alter table public.nachbar_potenzial enable row level security;
drop policy if exists nachbar_potenzial_lesen on public.nachbar_potenzial;
create policy nachbar_potenzial_lesen on public.nachbar_potenzial for select to authenticated using (true);
grant select on public.nachbar_potenzial to authenticated;

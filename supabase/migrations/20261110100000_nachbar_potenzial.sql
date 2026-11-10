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
-- Nur für das Bauraum-Team (Julian: "nur für uns als Manager-Ansicht"):
-- Fondsleitungs-Konten sind auch angemeldet, sehen hier aber nichts --
-- wer arrondieren will, verrät damit eine Absicht, auch gegenüber dem Kunden.
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
create policy nachbar_potenzial_lesen on public.nachbar_potenzial for select to authenticated using (not public.ist_fondsmanager());
grant select on public.nachbar_potenzial to authenticated;

-- Auswahl des Teams je Nachbarparzelle (Julian: "damit wir die selektionieren
-- können"): eigene Tabelle, damit eine neue Berechnung die Auswahl nicht löscht.
create table if not exists public.nachbar_auswahl (
  portfolio      text not null,
  nachbar_egrid  text not null check (nachbar_egrid ~ '^CH[0-9A-Z]{12}$'),
  stand          text not null default 'ausgewaehlt' check (stand in ('offen', 'ausgewaehlt', 'kontaktiert', 'kein_interesse')),
  notiz          text check (notiz is null or length(notiz) <= 2000),
  geaendert_von  uuid default auth.uid(),
  geaendert_am   timestamptz not null default now(),
  primary key (portfolio, nachbar_egrid)
);

alter table public.nachbar_auswahl enable row level security;
drop policy if exists nachbar_auswahl_team on public.nachbar_auswahl;
create policy nachbar_auswahl_team on public.nachbar_auswahl for all to authenticated
  using (not public.ist_fondsmanager()) with check (not public.ist_fondsmanager());
grant select, insert, update, delete on public.nachbar_auswahl to authenticated;

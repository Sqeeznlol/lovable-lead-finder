-- =====================================================================
-- Parzellen nach Wunsch: Favoriten
-- =====================================================================
-- Julian, 20. November: «mit den Filtern muss Button geben ... ausfindig
-- machen, dann ist es wo, wo man dann die Daten ausfüllen kann, aber weg
-- von der Filterseite». Ein Tipp auf «Ausfindig machen» legt die Parzelle
-- in die Favoriten; dort trägt man ein, wer Eigentümer ist und wie es
-- steht. In der Filterliste erscheint sie dann nicht mehr.
--
-- Die Angaben der Parzelle werden mitgeschrieben (nicht nur die EGRID):
-- ein Ordner wird mit jeder Lieferung ganz ersetzt, der Favorit bleibt.
-- Namen und Nummern von Eigentümern stehen nur hier, nie im Repository.
-- =====================================================================

create table if not exists public.wunsch_favorit (
  egrid          text primary key check (egrid ~ '^CH[0-9]{12}$'),
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  user_id        uuid default auth.uid(),
  von            text check (von is null or length(von) <= 80),
  -- Die Parzelle, wie sie im Ordner stand.
  kanton         text not null,
  gemeinde       text not null,
  nummer         text not null,
  flaeche        integer not null check (flaeche > 0),
  zone           text not null,
  e numeric not null, n numeric not null,
  lat double precision not null, lon double precision not null,
  -- Was man herausfindet.
  stand          text not null default 'suchen' check (stand in ('suchen', 'gefunden', 'kontaktiert', 'interesse', 'kein_interesse')),
  eigentuemer    text check (eigentuemer is null or length(eigentuemer) <= 300),
  adresse        text check (adresse is null or length(adresse) <= 300),
  telefon        text check (telefon is null or length(telefon) <= 60),
  email          text check (email is null or length(email) <= 200),
  notiz          text check (notiz is null or length(notiz) <= 4000)
);

comment on table public.wunsch_favorit is
  'Parzellen nach Wunsch, die jemand ausfindig machen will: mit Eigentümer, Kontakt, Stand und Notiz. Nur angemeldet, nie Fondsleitungen.';

alter table public.wunsch_favorit enable row level security;
revoke all on public.wunsch_favorit from public, anon, authenticated;
grant select, insert, update, delete on public.wunsch_favorit to authenticated;

drop policy if exists wunsch_favorit_lesen on public.wunsch_favorit;
create policy wunsch_favorit_lesen on public.wunsch_favorit for select to authenticated using (not public.ist_fondsmanager());
drop policy if exists wunsch_favorit_anlegen on public.wunsch_favorit;
create policy wunsch_favorit_anlegen on public.wunsch_favorit for insert to authenticated with check (not public.ist_fondsmanager());
drop policy if exists wunsch_favorit_aendern on public.wunsch_favorit;
create policy wunsch_favorit_aendern on public.wunsch_favorit for update to authenticated using (not public.ist_fondsmanager()) with check (not public.ist_fondsmanager());
drop policy if exists wunsch_favorit_loeschen on public.wunsch_favorit;
create policy wunsch_favorit_loeschen on public.wunsch_favorit for delete to authenticated using (not public.ist_fondsmanager());

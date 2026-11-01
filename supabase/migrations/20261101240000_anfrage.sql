-- =====================================================================
-- Anfragen von den öffentlichen Seiten
-- =====================================================================
-- Tims "Landing pages & data collection": Bewertung, Potenzialcheck,
-- Investorregistrierung. Diese Seiten stehen ohne Anmeldung offen --
-- darum darf der öffentliche Schlüssel hier nur EINFÜGEN, nie lesen.
-- Wer eine Anfrage schickt, sieht danach nichts von anderen. Gelesen
-- und bearbeitet wird nur angemeldet.
--
-- Einwilligung ist Pflicht und steht mit Zeitpunkt in der Zeile: ohne
-- sie wird nichts gespeichert (Datenschutz, Abschnitt 7 bei Tim:
-- "subject to applicable permissions and privacy requirements").
-- =====================================================================

create table if not exists public.anfrage (
  id            uuid primary key default gen_random_uuid(),
  art           text not null check (art in ('bewertung', 'potenzial', 'investor')),
  name          text not null check (length(trim(name)) between 2 and 120),
  email         text check (email is null or (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  telefon       text check (telefon is null or length(telefon) <= 40),
  adresse       text check (adresse is null or length(adresse) <= 200),
  egrid         text check (egrid is null or egrid ~ '^CH[0-9A-Z]{12}$'),
  angaben       jsonb not null default '{}'::jsonb check (pg_column_size(angaben) < 8000),
  nachricht     text check (nachricht is null or length(nachricht) <= 2000),
  einwilligung  boolean not null check (einwilligung),
  erstellt_am   timestamptz not null default now(),
  bearbeitet    boolean not null default false,
  bemerkung     text,
  -- Erreichbar muss die Person sein: Adresse oder Telefon.
  check (email is not null or telefon is not null)
);

create index if not exists idx_anfrage_offen on public.anfrage (erstellt_am desc) where not bearbeitet;

alter table public.anfrage enable row level security;

drop policy if exists anfrage_einreichen on public.anfrage;
create policy anfrage_einreichen on public.anfrage for insert to anon, authenticated
  with check (einwilligung and not bearbeitet and bemerkung is null);

drop policy if exists anfrage_lesen on public.anfrage;
create policy anfrage_lesen on public.anfrage for select to authenticated using (true);

drop policy if exists anfrage_bearbeiten on public.anfrage;
create policy anfrage_bearbeiten on public.anfrage for update to authenticated using (true) with check (true);

grant insert on public.anfrage to anon;

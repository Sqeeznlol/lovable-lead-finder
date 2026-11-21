-- =====================================================================
-- Leads löschen, nur mit Passwort
-- =====================================================================
-- Julian, 21. November: «die Option muss da sein, Leads zu löschen, aber
-- mit dem Passwort ... darf aber keiner sehen das Passwort». Darum prüft
-- die Datenbank das Passwort, nicht der Browser: im Code der Seite und in
-- diesem Repository steht es nicht, nur sein Prüfwert (bcrypt, aus dem das
-- Passwort nicht zurückgerechnet werden kann). Den Prüfwert liest keine
-- Rolle der Seite; nur die Funktion unten vergleicht.
--
-- Nach fünf falschen Versuchen in einer Stunde lehnt sie ab, auch mit dem
-- richtigen Passwort: so lässt sich nicht durchprobieren. Gelöscht wird
-- der Lead ganz; im Protokoll bleibt nur, wann, von wem und welche Art,
-- ohne Namen, Adresse oder Nummer.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.geheimnis (
  name text primary key,
  pruefwert text not null
);
alter table public.geheimnis enable row level security;
revoke all on public.geheimnis from public, anon, authenticated;
insert into public.geheimnis (name, pruefwert) values ('lead_loeschen', '$2a$10$gxJzNgrkRyo5MnjwrWJo5OVfA02IhL90DMMbKHIDKVU5/7md8S8v6')
on conflict (name) do nothing;

create table if not exists public.anfrage_geloescht (
  id          bigint generated always as identity primary key,
  anfrage_id  uuid not null,
  art         text,
  test        boolean,
  geloescht_am timestamptz not null default now(),
  user_id     uuid
);
alter table public.anfrage_geloescht enable row level security;
revoke all on public.anfrage_geloescht from public, anon, authenticated;
grant select on public.anfrage_geloescht to authenticated;
drop policy if exists anfrage_geloescht_lesen on public.anfrage_geloescht;
create policy anfrage_geloescht_lesen on public.anfrage_geloescht for select to authenticated using (not public.ist_fondsmanager());

create table if not exists public.loeschen_versuch (
  user_id uuid not null,
  am      timestamptz not null default now()
);
alter table public.loeschen_versuch enable row level security;
revoke all on public.loeschen_versuch from public, anon, authenticated;

create or replace function public.anfrage_loeschen(p_id uuid, p_passwort text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare pw text; a record; n int;
begin
  if auth.uid() is null or public.ist_fondsmanager() then raise exception 'Kein Zugriff.' using errcode = '42501'; end if;
  select count(*) into n from public.loeschen_versuch where user_id = auth.uid() and am > now() - interval '1 hour';
  if n >= 5 then raise exception 'Zu viele falsche Versuche. Bitte in einer Stunde noch einmal.'; end if;
  select pruefwert into pw from public.geheimnis where name = 'lead_loeschen';
  if pw is null or p_passwort is null or crypt(p_passwort, pw) <> pw then
    insert into public.loeschen_versuch (user_id) values (auth.uid());
    raise exception 'Falsches Passwort.';
  end if;
  select id, art, (name ~* 'test' or angaben->>'utm_source' = 'test' or angaben->>'quelle' = 'test') as test into a from public.anfrage where id = p_id;
  if a.id is null then raise exception 'Diesen Lead gibt es nicht mehr.'; end if;
  delete from public.anfrage where id = p_id;
  insert into public.anfrage_geloescht (anfrage_id, art, test, user_id) values (a.id, a.art, a.test, auth.uid());
end $$;

revoke all on function public.anfrage_loeschen(uuid, text) from public, anon;
grant execute on function public.anfrage_loeschen(uuid, text) to authenticated;

-- Der TEST-Lead vom 21. November (Ablauf «Test-Lead»): wieder weg.
delete from public.anfrage where name = 'TEST Lead GitHub' and angaben->>'utm_source' = 'test';

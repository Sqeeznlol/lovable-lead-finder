-- Attrappe von Supabase: Rollen, auth.uid(), die Tabellen, auf die sich die Migration bezieht.
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table public.properties (id uuid primary key);
create table public.anfrage (id uuid primary key);
create table public.fonds (user_id uuid primary key);
create function public.ist_fondsmanager() returns boolean language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.fonds where user_id = auth.uid()) $$;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.fonds values ('00000000-0000-0000-0000-000000000002');
-- Wie bei Supabase: neue Tabellen sind zuerst für alle Rollen offen.
alter default privileges in schema public grant all on tables to anon, authenticated;
grant usage on schema public to anon, authenticated;

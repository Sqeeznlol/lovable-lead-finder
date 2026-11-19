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
-- Rollen wie bei Supabase (Migration 20260414143822): Konto 3 ist Admin.
create type public.app_role as enum ('admin', 'office', 'mobile_swipe');
create table public.user_roles (user_id uuid, role public.app_role);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
insert into auth.users values ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004');
insert into public.user_roles values ('00000000-0000-0000-0000-000000000003', 'admin');

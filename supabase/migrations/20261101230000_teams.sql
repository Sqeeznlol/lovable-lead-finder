-- =====================================================================
-- Teams: Kundendaten nur für das zuständige Team
-- =====================================================================
-- Tims Abschnitt 7: "different companies, teams and acquisition
-- strategies, with the required data permissions". Bisher sah jeder
-- Angemeldete jeden Kunden (Regel "<tabelle>_angemeldet", 20261031180000).
--
-- Jetzt: Ein Kunde (mandant) kann einem Team gehören. Dann sehen ihn,
-- seine Portfolios und seine Gelegenheiten nur Mitglieder dieses Teams
-- und der Admin. Ein Kunde ohne Team bleibt für alle Angemeldeten
-- sichtbar -- so verschwindet mit dieser Migration nichts, was heute
-- jemand braucht. Die Grenze zieht die Datenbank, nicht der Browser.
-- =====================================================================

create table if not exists public.team (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 1 and 80),
  erstellt_am timestamptz not null default now()
);

create table if not exists public.team_mitglied (
  team_id  uuid not null references public.team(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  seit     timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.mandant add column if not exists team_id uuid references public.team(id) on delete set null;
create index if not exists idx_mandant_team on public.mandant (team_id);

-- Ob jemand zu einem Team gehört (null = kein Team = alle).
create or replace function public.darf_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and (
    p_team is null
    or public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.team_mitglied t where t.team_id = p_team and t.user_id = auth.uid())
  );
$$;

revoke all on function public.darf_team(uuid) from public, anon;
grant execute on function public.darf_team(uuid) to authenticated;

-- Wer einen Kunden sehen darf. security definer, damit die Regel die
-- Mitgliedschaft lesen kann, ohne dass team_mitglied offen liegt.
create or replace function public.darf_mandant(p_mandant uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and (
    p_mandant is null
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.mandant m
      where m.id = p_mandant
        and (m.team_id is null
             or exists (select 1 from public.team_mitglied t
                        where t.team_id = m.team_id and t.user_id = auth.uid()))
    )
  );
$$;

revoke all on function public.darf_mandant(uuid) from public, anon;
grant execute on function public.darf_mandant(uuid) to authenticated;

-- Die alten Regeln ("alle Angemeldeten") weichen den Team-Regeln.
drop policy if exists mandant_angemeldet on public.mandant;
-- Hier über die eigene Spalte, nicht über darf_mandant(id): beim
-- Anlegen gibt es die Zeile noch nicht, die Prüfung fände sie nicht --
-- und AUI könnte keinen Kunden mehr anlegen (Portfolio-Import).
create policy mandant_team on public.mandant for all to authenticated
  using (public.darf_team(team_id)) with check (public.darf_team(team_id));

drop policy if exists portfolio_angemeldet on public.portfolio;
create policy portfolio_team on public.portfolio for all to authenticated
  using (public.darf_mandant(mandant_id)) with check (public.darf_mandant(mandant_id));

drop policy if exists portfolio_position_angemeldet on public.portfolio_position;
create policy portfolio_position_team on public.portfolio_position for all to authenticated
  using (exists (select 1 from public.portfolio p where p.id = portfolio_id and public.darf_mandant(p.mandant_id)))
  with check (exists (select 1 from public.portfolio p where p.id = portfolio_id and public.darf_mandant(p.mandant_id)));

drop policy if exists gelegenheit_angemeldet on public.gelegenheit;
create policy gelegenheit_team on public.gelegenheit for all to authenticated
  using (public.darf_mandant(mandant_id)) with check (public.darf_mandant(mandant_id));

drop policy if exists gelegenheit_parzelle_angemeldet on public.gelegenheit_parzelle;
create policy gelegenheit_parzelle_team on public.gelegenheit_parzelle for all to authenticated
  using (exists (select 1 from public.gelegenheit g where g.id = gelegenheit_id and public.darf_mandant(g.mandant_id)))
  with check (exists (select 1 from public.gelegenheit g where g.id = gelegenheit_id and public.darf_mandant(g.mandant_id)));

-- Teams: die Namen sehen alle Angemeldeten (für die Anzeige beim
-- Kunden), ändern darf nur der Admin. Mitgliedschaften sieht man die
-- eigenen; der Admin alle.
alter table public.team enable row level security;
alter table public.team_mitglied enable row level security;

drop policy if exists team_lesen on public.team;
create policy team_lesen on public.team for select to authenticated using (true);
drop policy if exists team_admin on public.team;
create policy team_admin on public.team for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists team_mitglied_lesen on public.team_mitglied;
create policy team_mitglied_lesen on public.team_mitglied for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists team_mitglied_admin on public.team_mitglied;
create policy team_mitglied_admin on public.team_mitglied for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Die Konten zum Zuweisen: aus auth.users, das der Browser nicht lesen
-- kann. Nur für den Admin, nur Kennung und Adresse.
create or replace function public.konten_liste()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select u.id, u.email::text from auth.users u
  where public.has_role(auth.uid(), 'admin')
  order by u.email;
$$;

revoke all on function public.konten_liste() from public, anon;
grant execute on function public.konten_liste() to authenticated;

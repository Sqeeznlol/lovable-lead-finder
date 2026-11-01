-- =====================================================================
-- Wohntraums: die Werkzeuge von Bauraum, auf Fondsleitungen zugeschnitten
-- =====================================================================
-- Julian (1. November): "Manager sollten Kalender, Gespräche,
-- Suchprofile, Baugesuche der letzten 7 Tage, Gelegenheiten und Karten
-- auch haben, aber auf sie abgestimmt."
--
-- Abgestimmt heisst: alles bezieht sich auf die eigenen Liegenschaften
-- und die eigene Fondsleitung, und niemand sieht Eigentümer oder
-- Telefonnummern. Die Grenze zieht die Datenbank:
--   fonds_team(p)   welche Fondsleitung gilt -- ein Fondsmanager immer
--                   die eigene, unsere Konten die gewählte (Testmaske)
--   fonds_darf(t)   darf das Konto in dieser Fondsleitung arbeiten?
-- Neue Tabellen nur mit Regeln über fonds_darf; Abfragen über den Bestand
-- (Baugesuche, Suchtreffer) als security definer, die nur Objektdaten
-- liefern.
-- =====================================================================

create or replace function public.fonds_team(p_team uuid default null)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select case
    when auth.uid() is null then null
    when public.ist_fondsmanager() then
      (select tm.team_id from team_mitglied tm join team t on t.id = tm.team_id
       where tm.user_id = auth.uid() and t.art = 'fonds' order by t.name limit 1)
    else coalesce((select id from team where id = p_team and art = 'fonds'),
                  (select id from team where art = 'fonds' order by name limit 1))
  end;
$$;
revoke all on function public.fonds_team(uuid) from public, anon;
grant execute on function public.fonds_team(uuid) to authenticated;

create or replace function public.fonds_darf(p_team uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_team is not null and public.fonds_team(p_team) = p_team;
$$;
revoke all on function public.fonds_darf(uuid) from public, anon;
grant execute on function public.fonds_darf(uuid) to authenticated;

-- ------------------------------------------------------------ Gespräche
-- Mit Nachbarn, Verwaltungen, Gemeinden -- je Liegenschaft oder allgemein,
-- mit Wiedervorlage. Eigene Tabelle statt `anruf`: dort stehen die
-- Gespräche der Akquise mit Eigentümern, die eine Fondsleitung nie sieht.
create table if not exists public.fonds_notiz (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.team(id) on delete cascade,
  parzelle_id   uuid references public.properties(id) on delete set null,
  mit           text check (length(mit) <= 200),
  text          text not null check (length(trim(text)) between 1 and 5000),
  am            date not null default current_date,
  wiedervorlage date,
  erledigt      boolean not null default false,
  von           text,
  erstellt_am   timestamptz not null default now()
);
create index if not exists idx_fonds_notiz_team on public.fonds_notiz (team_id, am desc);
alter table public.fonds_notiz enable row level security;
drop policy if exists fonds_notiz_team on public.fonds_notiz;
create policy fonds_notiz_team on public.fonds_notiz for all to authenticated
  using (public.fonds_darf(team_id)) with check (public.fonds_darf(team_id));

-- ---------------------------------------------------------- Suchprofile
-- Was der Fonds kaufen will. Treffer liefert fonds_suchtreffer().
create table if not exists public.fonds_suchprofil (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.team(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 120),
  lagen         text[] not null default '{}',
  flaeche_min   numeric,
  reserve_min   numeric,
  marge_min     numeric,
  nur_wohnzone  boolean not null default false,
  aktiv         boolean not null default true,
  bemerkung     text,
  erstellt_am   timestamptz not null default now()
);
create index if not exists idx_fonds_suchprofil_team on public.fonds_suchprofil (team_id);
alter table public.fonds_suchprofil enable row level security;
drop policy if exists fonds_suchprofil_team on public.fonds_suchprofil;
create policy fonds_suchprofil_team on public.fonds_suchprofil for all to authenticated
  using (public.fonds_darf(team_id)) with check (public.fonds_darf(team_id));

-- ------------------------------------------- Stand eines Potenzials
-- "Pendent" heisst: noch nicht bearbeitet. Ohne Stand blieb jedes
-- Potenzial für immer pendent. Schlüssel = Art + Parzelle(n), so wie
-- fonds_universum sie liefert.
create table if not exists public.fonds_potenzial_stand (
  team_id      uuid not null references public.team(id) on delete cascade,
  schluessel   text not null,
  stand        text not null default 'pendent' check (stand in ('pendent', 'geprueft', 'erledigt', 'verworfen')),
  notiz        text,
  geaendert_am timestamptz not null default now(),
  primary key (team_id, schluessel)
);
alter table public.fonds_potenzial_stand enable row level security;
drop policy if exists fonds_potenzial_stand_team on public.fonds_potenzial_stand;
create policy fonds_potenzial_stand_team on public.fonds_potenzial_stand for all to authenticated
  using (public.fonds_darf(team_id)) with check (public.fonds_darf(team_id));

revoke all on public.fonds_notiz, public.fonds_suchprofil, public.fonds_potenzial_stand from anon;

-- ----------------------------------------- Baugesuche bei den Fonds
-- Auf einer eigenen Liegenschaft oder nebenan, die letzten p_tage Tage.
-- Ohne Bauherrschaft: das kann eine Privatperson sein.
create or replace function public.fonds_baugesuche(p_team uuid default null, p_tage int default 30)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with t as (select public.fonds_team(p_team) as id),
  p as (
    select distinct pr.id, pr.egrid, pr.address, pf.id as fonds
    from t join mandant m on m.team_id = t.id
    join portfolio pf on pf.mandant_id = m.id
    join portfolio_position pp on pp.portfolio_id = pf.id
    join properties pr on pr.id = pp.parzelle_id
  ),
  g as (
    select g.id, g.publiziert_am, g.gemeinde, g.adresse, g.beschreibung, g.zustand, g.kosten_chf,
           p.id as liegenschaft, p.address as liegenschaft_adresse, p.fonds,
           case when g.parzelle_id = p.id then 'auf' else 'nebenan' end as lage
    from baugesuch g join p on g.parzelle_id = p.id or (p.egrid is not null and g.nachbar_egrids @> array[p.egrid])
    where g.publiziert_am >= current_date - greatest(least(coalesce(p_tage, 30), 3650), 1)
      and g.quelle <> 'probe'
  )
  select coalesce(jsonb_agg(to_jsonb(g) order by g.publiziert_am desc, g.lage), '[]') from (select * from g limit 1000) g;
$$;
revoke all on function public.fonds_baugesuche(uuid, int) from public, anon;
grant execute on function public.fonds_baugesuche(uuid, int) to authenticated;

-- ------------------------------------------------- Suchtreffer
-- Parzellen im Bestand, die zu einem Suchprofil passen -- nur
-- Objektdaten, keine Eigentümer. Was schon in einem eigenen Fonds steht,
-- zählt nicht.
create or replace function public.fonds_suchtreffer(p_profil uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare s record;
begin
  select * into s from fonds_suchprofil where id = p_profil;
  if s is null or not public.fonds_darf(s.team_id) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x) from (
      select pr.id, pr.address as adresse, pr.gemeinde, pr.area as flaeche, pr.zone, pr.hnf_delta as reserve,
             pr.marge_chf as marge, pr.egrid, pt.e, pt.n
      from properties pr
      left join parzelle_punkt pt on pt.parzelle_id = pr.id
      where not coalesce(pr.ausgeschlossen, false)
        and (cardinality(s.lagen) = 0 or pr.gemeinde ilike any (select trim(l) from unnest(s.lagen) l))
        and (s.flaeche_min is null or pr.area >= s.flaeche_min)
        and (s.reserve_min is null or pr.hnf_delta >= s.reserve_min)
        and (s.marge_min is null or pr.marge_chf >= s.marge_min)
        and (not s.nur_wohnzone or pr.zone ~* '(wohn|^w\s?\d|kern|zentrum)')
        and not exists (select 1 from portfolio_position pp join portfolio pf on pf.id = pp.portfolio_id
                        join mandant m on m.id = pf.mandant_id
                        where pp.parzelle_id = pr.id and m.team_id = s.team_id)
      order by pr.marge_chf desc nulls last
      limit 60
    ) x), '[]'::jsonb);
end $$;
revoke all on function public.fonds_suchtreffer(uuid) from public, anon;
grant execute on function public.fonds_suchtreffer(uuid) to authenticated;

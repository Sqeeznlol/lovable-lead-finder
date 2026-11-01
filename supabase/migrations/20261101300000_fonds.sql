-- =====================================================================
-- Wohntraums: die Oberfläche für Fondsmanager
-- =====================================================================
-- Julian (1. November): Die Software ist für institutionelle
-- Immobilienbesitzer und Fondsmanager, die ihre Datensätze direkt
-- einspielen. Eine Fondsleitung hat Immofonds 1 bis 10 unter sich und
-- sieht oft nicht, dass Liegenschaften von Fonds 1 und Fonds 7
-- nebeneinander liegen. Das soll sie sehen -- als "Universum" -- und
-- ein Algorithmus soll gleich die pendenten Potenziale zeigen.
--
-- Abbildung auf das Bestehende:
--   Fondsleitung = Kunde (mandant) in einem Team der Art 'fonds'
--   Immofonds    = Portfolio dieses Kunden
--   Liegenschaft = Portfolio-Position mit Parzelle
-- Nachbarn kommen aus `nachbarschaft`, die Lage aus `parzelle_punkt`
-- (beides vom Bund, Ablauf "Fonds-Nachbarn" bzw. beim Einspielen im
-- Browser).
--
-- ACHTUNG Lesbarkeit: `properties` ist für jeden Angemeldeten und für
-- den öffentlichen Schlüssel lesbar (20260414152532). Die Trennung hier
-- gilt für die Fonds-Daten und die Abfrage; bevor ein echter
-- Fondsmanager ein Konto bekommt, müssen die Leseregeln von
-- `properties` dicht sein.
-- =====================================================================

alter table public.team add column if not exists art text not null default 'intern'
  check (art in ('intern', 'fonds'));

-- Ein Punkt je Parzelle (LV95, Mitte des Umrisses) -- für das Universum
-- reicht ein Punkt; Umrisse bräuchten Platz, den die Datenbank nicht hat.
create table if not exists public.parzelle_punkt (
  parzelle_id uuid primary key references public.properties(id) on delete cascade,
  e           numeric not null,
  n           numeric not null,
  quelle      text not null default 'bund',
  erfasst_am  timestamptz not null default now()
);
alter table public.parzelle_punkt enable row level security;
drop policy if exists parzelle_punkt_angemeldet on public.parzelle_punkt;
-- Lage ist öffentliche Information (Amtliche Vermessung); schreiben darf
-- jeder Angemeldete, weil der Browser die Punkte beim Einspielen holt.
create policy parzelle_punkt_angemeldet on public.parzelle_punkt for all to authenticated using (true) with check (true);

-- Nachbarschaften, die der Browser beim Einspielen beim Bund holt.
drop policy if exists nachbarschaft_einfuegen on public.nachbarschaft;
create policy nachbarschaft_einfuegen on public.nachbarschaft for insert to authenticated with check (true);

/** Ist das Konto ein Fondsmanager (Mitglied eines Fonds-Teams, kein Admin)? */
create or replace function public.ist_fondsmanager()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null
     and not public.has_role(auth.uid(), 'admin')
     and exists (select 1 from public.team_mitglied tm join public.team t on t.id = tm.team_id
                 where tm.user_id = auth.uid() and t.art = 'fonds');
$$;
revoke all on function public.ist_fondsmanager() from public, anon;
grant execute on function public.ist_fondsmanager() to authenticated;

-- ---------------------------------------------------------------------
-- Universum und pendente Potenziale in einer Abfrage.
--
-- Nur die Fonds-Kunden, die das Konto sehen darf (Mitglied des Teams,
-- oder Admin für die Testmaske). Keine Eigentümernamen: die sind hier
-- nachrangig (Julian) und gehören nicht in eine Fondsansicht.
--
-- Potenziale ("pendent" = noch nicht erledigt):
--   reserve      Ausnützungsreserve, gerechnet vom Auslöser trg_properties_potenzial
--   arrondierung Liegenschaften verschiedener Fonds grenzen aneinander
--   nachbar_baut Baugesuch auf einer Nachbarparzelle (Bauvorhaben)
--   offen        Zone fehlt -- Potenzial nicht berechenbar, ehrlich ausgewiesen
-- ---------------------------------------------------------------------
create or replace function public.fonds_universum()
returns jsonb language sql stable security definer set search_path to 'public' as $$
with m as (
  select m.id, a.name
  from mandant m join akteur a on a.id = m.akteur_id join team t on t.id = m.team_id
  where t.art = 'fonds'
    -- Ein Fondsmanager sieht nur die eigene Gesellschaft; interne Konten
    -- (aui, Admin) alle -- so dient sie uns als Testmaske.
    and (not public.ist_fondsmanager()
         or exists (select 1 from team_mitglied tm where tm.team_id = t.id and tm.user_id = auth.uid()))
), f as (
  select pf.id, pf.name, m.name as gesellschaft,
         row_number() over (order by pf.name) as nr
  from portfolio pf join m on m.id = pf.mandant_id
), pos as (
  select distinct on (pp.parzelle_id) pp.parzelle_id, pp.portfolio_id
  from portfolio_position pp join f on f.id = pp.portfolio_id
  where pp.parzelle_id is not null
  order by pp.parzelle_id, pp.portfolio_id
), p as (
  select pos.portfolio_id as fonds, pr.id, pr.address, pr.gemeinde, pr.area, pr.zone, pr.kategorie, pr.baujahr,
         pr.hnf_delta, pr.marge_chf, pr.egrid, pt.e, pt.n
  from pos join properties pr on pr.id = pos.parzelle_id
  left join parzelle_punkt pt on pt.parzelle_id = pr.id
), k as (
  -- Jede Nachbarschaft einmal (a < b), mit beiden Fonds.
  select distinct least(a.id::text, b.id::text) as a, greatest(a.id::text, b.id::text) as b
  from nachbarschaft nb join p a on a.id = nb.parzelle_id join p b on b.id = nb.nachbar_id
), kk as (
  select k.a, k.b, pa.fonds as fa, pb.fonds as fb,
         coalesce(pa.area, 0) + coalesce(pb.area, 0) as flaeche,
         greatest(coalesce(pa.hnf_delta, 0), 0) + greatest(coalesce(pb.hnf_delta, 0), 0) as reserve,
         greatest(coalesce(pa.marge_chf, 0), 0) + greatest(coalesce(pb.marge_chf, 0), 0) as marge,
         pa.address as adr_a, pb.address as adr_b, pa.gemeinde
  from k join p pa on pa.id::text = k.a join p pb on pb.id::text = k.b
), bau as (
  -- Bauvorhaben auf einer Nachbarparzelle, letzte 365 Tage.
  select p.id, count(*) as gesuche, max(g.publiziert_am) as zuletzt,
         (array_agg(g.beschreibung order by g.publiziert_am desc))[1] as was
  from p join baugesuch g on p.egrid = any (g.nachbar_egrids)
  where g.publiziert_am > current_date - 365
    and g.beschreibung ~* '(neubau|abbruch|rückbau|aufstock|anbau|ersatzbau|überbauung|mehrfamilienhaus)'
  group by p.id
)
select jsonb_build_object(
  'gesellschaft', (select string_agg(distinct name, ', ') from m),
  'mandant', (select min(id::text) from m),
  'fonds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'nr', f.nr,
      'liegenschaften', (select count(*) from p where p.fonds = f.id),
      'flaeche', (select coalesce(sum(area), 0) from p where p.fonds = f.id),
      'reserve', (select coalesce(sum(hnf_delta) filter (where hnf_delta > 0), 0) from p where p.fonds = f.id),
      'marge', (select coalesce(sum(marge_chf) filter (where marge_chf > 0), 0) from p where p.fonds = f.id)
    ) order by f.nr) from f), '[]'),
  'punkte', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'fonds', p.fonds, 'e', p.e, 'n', p.n, 'adresse', p.address, 'gemeinde', p.gemeinde,
      'flaeche', p.area, 'zone', p.zone, 'reserve', p.hnf_delta, 'marge', p.marge_chf, 'egrid', p.egrid)) from p), '[]'),
  'kanten', coalesce((select jsonb_agg(jsonb_build_object('a', a, 'b', b, 'fremd', fa <> fb)) from kk), '[]'),
  'potenziale', coalesce((select jsonb_agg(x order by x.rang desc) from (
      select 'arrondierung' as art, kk.marge + 1e9 as rang,
             'Fonds ' || least((select nr from f where id = kk.fa), (select nr from f where id = kk.fb))
               || ' und ' || greatest((select nr from f where id = kk.fa), (select nr from f where id = kk.fb))
               || ' grenzen aneinander' as titel,
             kk.adr_a || ' + ' || kk.adr_b || coalesce(', ' || kk.gemeinde, '') as wo,
             kk.flaeche, kk.reserve, kk.marge, kk.a as parzelle, kk.b as parzelle2
      from kk where kk.fa <> kk.fb
      union all
      select 'nachbar_baut', coalesce(p.marge_chf, 0) + 5e8,
             'Nachbar baut' || case when b.gesuche > 1 then ' (' || b.gesuche || ' Gesuche)' else '' end,
             p.address || coalesce(', ' || p.gemeinde, '') || ' -- ' || left(coalesce(b.was, ''), 80),
             p.area, greatest(coalesce(p.hnf_delta, 0), 0), greatest(coalesce(p.marge_chf, 0), 0), p.id::text, null
      from bau b join p on p.id = b.id
      union all
      select 'reserve', p.marge_chf,
             'Ausnützungsreserve ' || round(p.hnf_delta) || ' m²',
             p.address || coalesce(', ' || p.gemeinde, ''),
             p.area, p.hnf_delta, p.marge_chf, p.id::text, null
      from p where p.hnf_delta > 0
      union all
      select 'offen', 0, 'Potenzial offen: Zone fehlt',
             p.address || coalesce(', ' || p.gemeinde, ''),
             p.area, null, null, p.id::text, null
      from p where nullif(trim(p.zone), '') is null
    ) x), '[]')
);
$$;
revoke all on function public.fonds_universum() from public, anon;
grant execute on function public.fonds_universum() to authenticated;

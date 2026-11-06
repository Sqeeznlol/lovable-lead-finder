-- =====================================================================
-- Wohntraums: Lage je Position -- Liegenschaften schweizweit im Universum
-- =====================================================================
-- Der Bestand (properties) deckt Zürich und Thurgau. Die erste echte
-- Fondsleitung (Helvetica, 6. November) hält 50 Liegenschaften in zwölf
-- Kantonen; 41 davon lägen ohne diese Änderung unsichtbar in der Liste
-- "nicht gefunden". Darum trägt eine Position ihre Lage selbst: Punkt,
-- EGRID, Nachbarparzellen, Gemeinde, Kanton und Fläche vom Bund, wie sie
-- das Einspielen im Browser (portfolio-import.ts) und die Migration
-- 20261106110000_fondsleitung_helvetica.sql liefern.
--
-- fonds_universum zeigt solche Positionen als Punkte ohne Zone, Reserve
-- und Marge, zählt sie bei Liegenschaften und Fläche mit, findet
-- Nachbarschaften über die EGRID der Nachbarparzellen und führt sie als
-- "Potenzial offen: ausserhalb Zürich und Thurgau" -- bis der Bestand
-- den Kanton kennt.
-- =====================================================================

alter table public.portfolio_position
  add column if not exists e              numeric,
  add column if not exists n              numeric,
  add column if not exists egrid          text,
  add column if not exists nachbar_egrids text[] not null default '{}',
  add column if not exists gemeinde       text,
  add column if not exists kanton         text,
  add column if not exists flaeche        numeric;

comment on column public.portfolio_position.e is
  'Lage vom Bund (LV95). Zählt im Universum nur, wenn parzelle_id fehlt -- sonst gilt parzelle_punkt.';
comment on column public.portfolio_position.nachbar_egrids is
  'EGRID der angrenzenden Parzellen laut Amtlicher Vermessung (Bund), für Nachbarschaften ohne Bestand.';

create index if not exists idx_portfolio_position_egrid on public.portfolio_position (egrid);
create index if not exists idx_portfolio_position_nachbarn on public.portfolio_position using gin (nachbar_egrids);

-- Ein Gespräch zu einer Liegenschaft ohne Bestand hängt an der Position,
-- nicht an einer Parzelle des Bestands.
alter table public.fonds_notiz
  add column if not exists position_id uuid references public.portfolio_position(id) on delete set null;

create or replace function public.fonds_universum(p_team uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
with m as (
  select m.id, a.name
  from mandant m join akteur a on a.id = m.akteur_id join team t on t.id = m.team_id
  where t.art = 'fonds'
    -- Ein Fondsmanager sieht nur die eigene Gesellschaft, was immer er
    -- als p_team schickt; unsere Konten wählen eine (Testmaske).
    and (case when public.ist_fondsmanager()
              then exists (select 1 from team_mitglied tm where tm.team_id = t.id and tm.user_id = auth.uid())
              else auth.uid() is not null and (p_team is null or t.id = p_team) end)
), f as (
  select pf.id, pf.name, m.name as gesellschaft,
         -- "Immofonds 10" nach "Immofonds 9", nicht nach "Immofonds 1".
         row_number() over (order by coalesce(substring(pf.name from '(?i)fonds\s*(\d+)')::int, 2147483647), pf.name) as nr
  from portfolio pf join m on m.id = pf.mandant_id
), pos as (
  select distinct on (pp.parzelle_id) pp.parzelle_id, pp.portfolio_id
  from portfolio_position pp join f on f.id = pp.portfolio_id
  where pp.parzelle_id is not null
  -- Steht eine Liegenschaft in zwei Fonds, gilt die jüngste Zuordnung
  -- (vorher entschied die kleinste UUID, also der Zufall).
  order by pp.parzelle_id, pp.erstellt_am desc
), p as (
  select pos.portfolio_id as fonds, pr.id, pr.address, pr.gemeinde, pr.area, pr.zone, pr.kategorie, pr.baujahr,
         pr.hnf_delta, pr.marge_chf, pr.egrid, pt.e, pt.n,
         coalesce(pr.ausgeschlossen, false) as ausgeschlossen,
         case when jsonb_typeof(pr.score_killers) = 'array' then jsonb_array_length(pr.score_killers) else 0 end as killer
  from pos join properties pr on pr.id = pos.parzelle_id
  left join parzelle_punkt pt on pt.parzelle_id = pr.id
), roh as (
  -- Positionen ohne Parzelle im Bestand, aber mit Lage vom Bund: der
  -- Bestand deckt Zürich und Thurgau, die Fonds halten schweizweit.
  select 'pos:' || pp.id as id, pp.portfolio_id as fonds, pp.e, pp.n,
         -- "Neubrückstrasse 18-24, 2555 Brügg" -> "Neubrückstrasse 18-24", die
         -- Gemeinde steht daneben; ohne Gemeinde bleibt der ganze Rohtext.
         coalesce(nullif(trim(case when pp.gemeinde is not null
                                   then regexp_replace(pp.roh_adresse, ',\s*\d{4}\s+[^,]*$', '')
                                   else pp.roh_adresse end), ''), pp.egrid, 'Liegenschaft') as address,
         pp.gemeinde, pp.kanton, pp.flaeche as area, pp.egrid, pp.nachbar_egrids
  from portfolio_position pp join f on f.id = pp.portfolio_id
  where pp.parzelle_id is null and pp.e is not null and pp.n is not null
), k as (
  select distinct least(a.id::text, b.id::text) as a, greatest(a.id::text, b.id::text) as b
  from nachbarschaft nb join p a on a.id = nb.parzelle_id join p b on b.id = nb.nachbar_id
), kk as (
  select k.a, k.b, pa.fonds as fa, pb.fonds as fb,
         coalesce(pa.area, 0) + coalesce(pb.area, 0) as flaeche,
         greatest(coalesce(pa.hnf_delta, 0), 0) + greatest(coalesce(pb.hnf_delta, 0), 0) as reserve,
         greatest(coalesce(pa.marge_chf, 0), 0) + greatest(coalesce(pb.marge_chf, 0), 0) as marge,
         pa.address as adr_a, pb.address as adr_b, pa.gemeinde
  from k join p pa on pa.id::text = k.a join p pb on pb.id::text = k.b
), kr as (
  -- Nachbarschaft über die EGRID der Nachbarparzellen, die der Bund beim
  -- Einspielen liefert: zwischen zwei Positionen ohne Bestand, oder
  -- zwischen einer solchen und einer Liegenschaft des Bestands.
  select a.id as a, b.id as b, a.fonds as fa, b.fonds as fb,
         coalesce(a.area, 0) + coalesce(b.area, 0) as flaeche,
         a.address as adr_a, b.address as adr_b, coalesce(a.gemeinde, b.gemeinde) as gemeinde
  from roh a join roh b on a.id < b.id
    and ((b.egrid is not null and a.nachbar_egrids @> array[b.egrid])
      or (a.egrid is not null and b.nachbar_egrids @> array[a.egrid]))
  union all
  select r.id, p.id::text, r.fonds, p.fonds, coalesce(r.area, 0) + coalesce(p.area, 0), r.address, p.address, coalesce(p.gemeinde, r.gemeinde)
  from roh r join p on p.egrid is not null and r.nachbar_egrids @> array[p.egrid]
), bau as (
  select p.id, count(*) as gesuche, max(g.publiziert_am) as zuletzt,
         (array_agg(g.beschreibung order by g.publiziert_am desc))[1] as was
  from p join baugesuch g on g.nachbar_egrids @> array[p.egrid]
  where g.publiziert_am > current_date - 365
    and g.beschreibung ~* '(neubau|abbruch|rückbau|aufstock|anbau|ersatzbau|überbauung|mehrfamilienhaus)'
    -- Baut die eigene Gesellschaft, ist das kein "Nachbar baut"; und
    -- abgelehnte oder zurückgezogene Gesuche bauen nichts.
    and not exists (select 1 from p p2 where p2.id = g.parzelle_id)
    and g.zustand in ('eingereicht', 'bewilligt')
  group by p.id
)
select jsonb_build_object(
  'gesellschaft', (select string_agg(distinct name, ', ') from m),
  'mandant', (select min(id::text) from m),
  'fonds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'nr', f.nr,
      'liegenschaften', (select count(*) from p where p.fonds = f.id) + (select count(*) from roh where roh.fonds = f.id),
      'flaeche', (select coalesce(sum(area), 0) from p where p.fonds = f.id) + (select coalesce(sum(area), 0) from roh where roh.fonds = f.id),
      'reserve', (select coalesce(sum(hnf_delta) filter (where hnf_delta > 0), 0) from p where p.fonds = f.id),
      'marge', (select coalesce(sum(marge_chf) filter (where marge_chf > 0), 0) from p where p.fonds = f.id)
    ) order by f.nr) from f), '[]'),
  'punkte', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'fonds', p.fonds, 'e', p.e, 'n', p.n, 'adresse', p.address, 'gemeinde', p.gemeinde,
      'flaeche', p.area, 'zone', p.zone, 'reserve', p.hnf_delta, 'marge', p.marge_chf, 'egrid', p.egrid)) from p), '[]')
    || coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'fonds', r.fonds, 'e', r.e, 'n', r.n, 'adresse', r.address, 'gemeinde', r.gemeinde,
      'flaeche', r.area, 'zone', null::text, 'reserve', null::numeric, 'marge', null::numeric, 'egrid', r.egrid)) from roh r), '[]'),
  'kanten', coalesce((select jsonb_agg(jsonb_build_object('a', x.a, 'b', x.b, 'fremd', x.fa <> x.fb))
      from (select a, b, fa, fb from kk union all select a, b, fa, fb from kr) x), '[]'),
  'potenziale', coalesce((select jsonb_agg(x order by x.rang desc) from (
      select 'arrondierung' as art, kk.marge + 1e9 as rang,
             'Fonds ' || least((select nr from f where id = kk.fa), (select nr from f where id = kk.fb))
               || ' und ' || greatest((select nr from f where id = kk.fa), (select nr from f where id = kk.fb))
               || ' grenzen aneinander' as titel,
             kk.adr_a || ' + ' || kk.adr_b || coalesce(', ' || kk.gemeinde, '') as wo,
             kk.flaeche, kk.reserve, kk.marge, kk.a as parzelle, kk.b as parzelle2
      from kk where kk.fa <> kk.fb
      union all
      -- Ohne Bestand ist die Marge unbekannt: hinter den gerechneten
      -- Arrondierungen, vor allem Übrigen.
      select 'arrondierung', 1e9,
             'Fonds ' || least((select nr from f where id = kr.fa), (select nr from f where id = kr.fb))
               || ' und ' || greatest((select nr from f where id = kr.fa), (select nr from f where id = kr.fb))
               || ' grenzen aneinander',
             kr.adr_a || ' + ' || kr.adr_b || coalesce(', ' || kr.gemeinde, ''),
             kr.flaeche, null::numeric, null::numeric, kr.a, kr.b
      from kr where kr.fa <> kr.fb
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
      -- Nicht bei Ausschluss oder Ausschlussgrund (Denkmal, ISOS, keine
      -- Bauzone): dort ist die Reserve nicht nutzbar.
      from p where p.hnf_delta > 0 and not p.ausgeschlossen and p.killer = 0
      union all
      -- Auch ohne Bestandsangabe ist die Reserve nicht rechenbar; diese
      -- Liegenschaften fielen bisher durch alle Arten.
      select 'offen', 0,
             case when nullif(trim(p.zone), '') is null then 'Potenzial offen: Zone fehlt'
                  else 'Potenzial offen: Bestand fehlt' end,
             p.address || coalesce(', ' || p.gemeinde, ''),
             p.area, null, null, p.id::text, null
      from p where nullif(trim(p.zone), '') is null or p.hnf_delta is null
      union all
      -- Ausserhalb des Bestands fehlen Zone und Ausnützung ganz; die
      -- Liegenschaft steht trotzdem im Universum und in dieser Liste.
      select 'offen', 0,
             case when r.kanton in ('ZH', 'TG') then 'Potenzial offen: Parzelle nicht im Bestand'
                  else 'Potenzial offen: ausserhalb Zürich und Thurgau' end,
             r.address || coalesce(', ' || r.gemeinde, ''),
             r.area, null, null, r.id, null
      from roh r
    ) x), '[]')
);
$$;
revoke all on function public.fonds_universum(uuid) from public, anon;
grant execute on function public.fonds_universum(uuid) to authenticated;

-- =====================================================================
-- Wohntraums: Fondsleitungen als Konten im Kontomenü
-- =====================================================================
-- Julian (1. November): oben rechts, wo Konto und Mail stehen, sollen
-- die Fondsleitungen mit ihren Adressen stehen -- ein Klick, und man
-- sieht genau das, was diese Fondsleitung sieht: nur Wohntraums, ohne
-- Pipedrive, Verwaltung und den Rest von Bauraum.
--
-- Dafür:
--   fonds_gesellschaften()      die Fondsleitungen mit ihren Konten
--   fonds_universum(p_team)     das Universum einer einzelnen Leitung
-- und zwei weitere erfundene Leitungen, damit die Testmaske mehr als
-- eine Gesellschaft zeigt.
-- =====================================================================

-- Die Liste ist nur für unsere Konten: ein Fondsmanager soll nicht
-- erfahren, welche anderen Gesellschaften es gibt.
create or replace function public.fonds_gesellschaften()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by x->>'name'), '[]')
  from (
    select jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'gesellschaft', (select string_agg(a.name, ', ' order by a.name) from mandant m join akteur a on a.id = m.akteur_id where m.team_id = t.id),
      'fonds', (select count(*) from portfolio pf join mandant m on m.id = pf.mandant_id where m.team_id = t.id),
      'konten', coalesce((select jsonb_agg(u.email order by u.email) from team_mitglied tm join auth.users u on u.id = tm.user_id
                          where tm.team_id = t.id), '[]')
    ) as x
    from team t
    where t.art = 'fonds'
  ) s
  where auth.uid() is not null and not public.ist_fondsmanager();
$$;
revoke all on function public.fonds_gesellschaften() from public, anon;
grant execute on function public.fonds_gesellschaften() to authenticated;

-- Neue Unterschrift: eine Leitung wählen. Die alte ohne Argument muss
-- weg, sonst wäre der Aufruf ohne Argument mehrdeutig.
drop function if exists public.fonds_universum();

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
revoke all on function public.fonds_universum(uuid) from public, anon;
grant execute on function public.fonds_universum(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Zwei weitere erfundene Fondsleitungen (Testmaske). Gleiches Vorgehen
-- wie 20261101310000_fonds_demo.sql: Baugrundstück in einen Fonds, zwei
-- Nachbarn in andere. Keine Parzelle doppelt über alle Leitungen.
-- Wegräumen wie dort, mit bemerkung 'TESTDATEN -- Fonds-Demo 2'.
-- ---------------------------------------------------------------------
do $$
declare
  leitungen text[][] := array[
    array['Seeufer Anlagestiftung', 'Seeufer Anlagestiftung (Demo)', '5', '45'],
    array['Alpenblick Immobilien', 'Alpenblick Immobilienfonds (Demo)', '4', '35']];
  namen text[] := array['Wohnen Seeufer', 'Wohnen Agglomeration', 'Gemischt', 'Entwicklung', 'Core'];
  j int; tid uuid; aid uuid; mid uuid; fonds uuid[]; anz int; i int; k int; r record; n record; pid uuid;
begin
  for j in 1 .. array_length(leitungen, 1) loop
    if exists (select 1 from public.akteur where name = leitungen[j][2] and bemerkung = 'TESTDATEN -- Fonds-Demo 2') then
      continue;
    end if;
    select id into tid from public.team where name = leitungen[j][1];
    if tid is null then
      insert into public.team (name, art) values (leitungen[j][1], 'fonds') returning id into tid;
    end if;
    insert into public.akteur (art, name, ort, bemerkung)
    values ('institution', leitungen[j][2], 'Zürich', 'TESTDATEN -- Fonds-Demo 2') returning id into aid;
    insert into public.mandant (akteur_id, produkt, bemerkung, team_id)
    values (aid, 'intelligence', 'TESTDATEN', tid) returning id into mid;

    anz := leitungen[j][3]::int;
    fonds := '{}';
    for i in 1 .. anz loop
      insert into public.portfolio (mandant_id, name) values (mid, 'Immofonds ' || i || ' · ' || namen[i]) returning id into pid;
      fonds := fonds || pid;
    end loop;

    i := 0;
    for r in
      select g.id, g.parzelle_id, g.nachbar_egrids
      from public.baugesuch g join public.properties p on p.id = g.parzelle_id
      where p.kanton = 'ZH' and coalesce(array_length(g.nachbar_egrids, 1), 0) >= 2
        and nullif(trim(p.zone), '') is not null and p.zone <> 'zarchivat'
        and not exists (select 1 from public.portfolio_position x join public.portfolio pf on pf.id = x.portfolio_id
                        join public.mandant mm on mm.id = pf.mandant_id join public.team tt on tt.id = mm.team_id
                        where x.parzelle_id = g.parzelle_id and tt.art = 'fonds')
      order by (coalesce(p.hnf_delta, 0) > 0) desc, md5(g.id::text || leitungen[j][1])
      limit leitungen[j][4]::int
    loop
      if exists (select 1 from public.portfolio_position x join public.portfolio pf on pf.id = x.portfolio_id
                 join public.mandant mm on mm.id = pf.mandant_id join public.team tt on tt.id = mm.team_id
                 where x.parzelle_id = r.parzelle_id and tt.art = 'fonds') then
        continue;
      end if;
      insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
      select fonds[(i % anz) + 1], p.id, p.address, 'zugeordnet' from public.properties p where p.id = r.parzelle_id;
      k := 0;
      for n in
        select p.id, p.address from public.properties p
        where p.egrid = any (r.nachbar_egrids) and p.id <> r.parzelle_id
          and not exists (select 1 from public.portfolio_position x join public.portfolio pf on pf.id = x.portfolio_id
                          join public.mandant mm on mm.id = pf.mandant_id join public.team tt on tt.id = mm.team_id
                          where x.parzelle_id = p.id and tt.art = 'fonds')
        order by (coalesce(p.hnf_delta, 0) > 0) desc, p.area desc nulls last
        limit 2
      loop
        k := k + 1;
        insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
        values (fonds[((i + k) % anz) + 1], n.id, n.address, 'zugeordnet');
        insert into public.nachbarschaft (parzelle_id, nachbar_id) values (r.parzelle_id, n.id), (n.id, r.parzelle_id)
        on conflict do nothing;
      end loop;
      i := i + 1;
    end loop;
    raise notice '%: % Baugrundstücke, % Liegenschaften', leitungen[j][1], i,
      (select count(*) from public.portfolio_position where portfolio_id = any (fonds));
  end loop;
end $$;

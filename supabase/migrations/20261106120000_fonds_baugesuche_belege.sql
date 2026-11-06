-- =====================================================================
-- Wohntraums: Baugesuche aufklappen, mit dem Beleg im Amtsblatt
-- =====================================================================
-- Julian, 6. November, am Gesuch "Neubau eines Mehrfamilienhauses,
-- Bodenacherstrasse 79a, Fällanden" bei Helvetica: "muss man aufmachen
-- können, sieht dann direkt das Baugesuch, und auf den Link klicken auf
-- den originalen Beitrag". Die Liste kannte nur Beschreibung, Adresse
-- und Kosten. Jetzt liefert die Abfrage dazu, was Bauraum schon zeigt
-- (baugesuch-belege.ts): Publikationsnummer und -kennung im Amtsblatt,
-- Einsprachefrist, Ende der Publikation, Parzelle und Quelle. Die
-- Bauherrschaft bleibt weg -- das kann eine Privatperson sein.
--
-- Dazu zählen Positionen ohne Parzelle im Bestand mit (Lage vom Bund,
-- 20261106100000_position_lage.sql): Gesuch auf derselben EGRID heisst
-- "auf", Gesuch mit ihr unter den Nachbarn "nebenan".
-- =====================================================================

create or replace function public.fonds_baugesuche(p_team uuid default null, p_tage int default 30)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with t as (select public.fonds_team(p_team) as id),
  p as (
    select distinct pr.id::text as id, pr.id as parzelle, pr.egrid, pr.address, pf.id as fonds
    from t join mandant m on m.team_id = t.id
    join portfolio pf on pf.mandant_id = m.id
    join portfolio_position pp on pp.portfolio_id = pf.id
    join properties pr on pr.id = pp.parzelle_id
    union
    select 'pos:' || pp.id, null::uuid, pp.egrid, pp.roh_adresse, pf.id
    from t join mandant m on m.team_id = t.id
    join portfolio pf on pf.mandant_id = m.id
    join portfolio_position pp on pp.portfolio_id = pf.id
    where pp.parzelle_id is null and pp.egrid is not null
  ),
  g as (
    select g.id, g.publiziert_am, g.gemeinde, g.adresse, g.beschreibung, g.zustand, g.kosten_chf,
           g.parzelle_nr, g.egrid, g.quelle, g.publikation_nr, g.publikation_id, g.einsprache_bis,
           g.publiziert_bis, g.quelle_url,
           p.id as liegenschaft, p.address as liegenschaft_adresse, p.fonds,
           case when (p.parzelle is not null and g.parzelle_id = p.parzelle)
                  or (p.parzelle is null and g.egrid = p.egrid) then 'auf' else 'nebenan' end as lage
    from baugesuch g join p
      on (p.parzelle is not null and g.parzelle_id = p.parzelle)
      or (p.parzelle is null and g.egrid = p.egrid)
      or (p.egrid is not null and g.nachbar_egrids @> array[p.egrid])
    where g.publiziert_am >= current_date - greatest(least(coalesce(p_tage, 30), 3650), 1)
      and g.quelle <> 'probe'
  )
  select coalesce(jsonb_agg(to_jsonb(g) order by g.publiziert_am desc, g.lage), '[]') from (select * from g limit 1000) g;
$$;
revoke all on function public.fonds_baugesuche(uuid, int) from public, anon;
grant execute on function public.fonds_baugesuche(uuid, int) to authenticated;

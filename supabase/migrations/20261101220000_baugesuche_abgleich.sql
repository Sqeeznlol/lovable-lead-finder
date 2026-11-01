-- =====================================================================
-- Baugesuche: Zuordnung und Gelegenheiten
-- =====================================================================
-- Quelle, nachgesehen am 1. November ("Auswerten -> baugesuche"): der
-- Datensatz "Baugesuche im Kanton Zürich" des Statistischen Amts,
-- täglich, als CSV. Er führt Adresse, BFS-Nummer und Parzellennummer
-- (districtCadastre_relation_cadastre, z.B. "AA1158"), aber keine
-- EGRID und keinen Entscheid -- es sind Publikationen, also
-- eingereichte Gesuche. "bewilligt" und "abgelehnt" kommen aus dieser
-- Quelle nicht.
--
-- Die EGRID und die Nachbarn holt der Ablauf "Baugesuche" beim Bund
-- (tools/baugesuche_laden.ts) und legt sie hier ab. Diese Funktion
-- ordnet dann zu und erzeugt die Gelegenheiten -- Tims Ablauf aus
-- Step 2, Abschnitt 4: Gesuch publiziert, Parzelle gefunden, Nachbarn
-- bestimmt, Kundenportfolio erkannt, Gelegenheit angelegt.
-- =====================================================================

alter table public.baugesuch
  add column if not exists nachbar_egrids text[];

create or replace function public.baugesuche_abgleichen(p_tage int default 30)
returns table (per_egrid int, per_nummer int, gelegenheiten int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a int := 0; b int := 0; c int := 0;
  r record;
  gid uuid;
begin
  -- 1. Über die EGRID: eindeutig (uniq_properties_egrid).
  update baugesuch g set parzelle_id = p.id, zuordnung_art = 'egrid', zuordnung_sicher = true
  from properties p
  where g.parzelle_id is null and g.egrid is not null and p.egrid = g.egrid;
  get diagnostics a = row_count;

  -- 2. Ohne EGRID über Gemeinde und Parzellennummer -- nur, wenn genau
  -- eine Parzelle passt. Zwei Treffer heisst: nicht zuordnen.
  update baugesuch g set parzelle_id = t.pid, zuordnung_art = 'parzellennummer', zuordnung_sicher = true
  from (
    select g2.id, min(p.id::text)::uuid as pid
    from baugesuch g2
    join properties p on p.bfs_nr = g2.bfs_nr
                     and (p.parzelle = g2.parzelle_nr or p.plot_number = g2.parzelle_nr)
    where g2.parzelle_id is null and g2.parzelle_nr is not null
      and g2.publiziert_am > current_date - p_tage
    group by g2.id having count(*) = 1
  ) t
  where g.id = t.id;
  get diagnostics b = row_count;

  -- 3. Gelegenheiten: das Gesuch betrifft eine Parzelle eines
  -- Kundenportfolios oder deren Nachbarn. Je Gesuch und Kunde eine.
  for r in
    select distinct on (g.id, m.id)
           g.id as baugesuch_id, m.id as mandant_id, g.parzelle_id, g.adresse, g.gemeinde,
           g.beschreibung, pp.id as portfolio_parzelle, pp.address as portfolio_adresse,
           (pp.egrid = g.egrid) as im_portfolio
    from baugesuch g
    join properties pp on pp.egrid is not null
                      and (pp.egrid = g.egrid or pp.egrid = any (coalesce(g.nachbar_egrids, '{}')))
    join portfolio_position pos on pos.parzelle_id = pp.id
    join portfolio pf on pf.id = pos.portfolio_id
    join mandant m on m.id = pf.mandant_id
    where g.publiziert_am > current_date - p_tage
      and not exists (select 1 from gelegenheit x where x.baugesuch_id = g.id and x.mandant_id = m.id)
    order by g.id, m.id, (pp.egrid = g.egrid) desc
  loop
    insert into gelegenheit (anlass, baugesuch_id, mandant_id, zustand, titel, begruendung, prioritaet)
    values ('baugesuch', r.baugesuch_id, r.mandant_id, 'erkannt',
            case when r.im_portfolio then 'Baugesuch im Portfolio: ' else 'Baugesuch beim Nachbarn: ' end
              || coalesce(r.adresse, '') || coalesce(', ' || r.gemeinde, ''),
            left(coalesce(r.beschreibung, ''), 400)
              || case when r.im_portfolio then '' else ' -- Nachbar von ' || coalesce(r.portfolio_adresse, 'einer Portfolio-Parzelle') end,
            case when r.im_portfolio then 5 else 10 end)
    returning id into gid;
    insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle)
    values (gid, r.portfolio_parzelle, 'im portfolio')
    on conflict do nothing;
    if r.parzelle_id is not null and r.parzelle_id <> r.portfolio_parzelle then
      insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle)
      values (gid, r.parzelle_id, 'ausloeser') on conflict do nothing;
    end if;
    c := c + 1;
  end loop;

  return query select a, b, c;
end;
$$;

revoke all on function public.baugesuche_abgleichen(int) from public, anon, authenticated;

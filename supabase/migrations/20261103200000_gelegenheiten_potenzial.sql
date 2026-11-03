-- =====================================================================
-- Entwicklungspotenzial als Gelegenheit -- das System findet selbst
-- =====================================================================
-- Tims Brief, Abschnitt 11B und 13: "Automatically identify
-- underutilized land, possible extensions, replacement buildings" und
-- "Each event becomes a case, not a notification". Den Anlass
-- 'ausnuetzungsreserve' gab es seit dem 31. Oktober in der Tabelle --
-- angelegt hat ihn nie etwas. Diese Funktion tut es, für die Parzellen
-- der Kundenportfolios (Portfolio Intelligence).
--
-- Die Regeln stehen in docs/potenzial-regeln.md, zum Prüfen durch
-- Julian und Tim. Kurz:
--   R1 Reserve        hnf_delta >= p_min_reserve (m² Hauptnutzfläche)
--   R2 Ersatzneubau   R1, und das Hauptgebäude (Register, sonst Bestand)
--                     ist 50 Jahre oder älter, und der Bestand nutzt
--                     weniger als 60 % der Zone (reserve_quote >= 0.4)
--   R3 Gemeinsam      ein Nachbar im Bestand hat selbst >= p_min_reserve
--                     Reserve (mindestens das Doppelte, wenn die eigene
--                     Parzelle R1 nicht erfüllt)
-- Je Kunde und Parzelle höchstens eine Gelegenheit dieser Art; der
-- Ablauf darf täglich laufen. Priorität, erklärbar: Marge in Mio
-- + 3 für Ersatzneubau + 2 für Öl/Gas (die Sanierung steht an, ein
-- guter Moment für das Gespräch) + 1 je Nachbar mit Reserve (bis 3).
--
-- Gerechnet wird mit dem, was da ist: die Reserve aus der
-- Potenzialrechnung (trg_properties_potenzial), Baujahr, Geschosse und
-- Heizung aus dem Gebäuderegister (parzelle_gebaeude). Was nicht
-- gerechnet ist (confidence 'keine' oder leer), wird nicht erfunden.
--
-- p_schreiben = false zählt nur -- so lässt sich die Schwelle wählen,
-- bevor etwas entsteht (Ablauf "Auswerten", potenzial-gelegenheiten).
-- =====================================================================

create or replace function public.gelegenheiten_potenzial(
  p_min_reserve numeric default 200, p_schreiben boolean default false, p_mandant uuid default null)
returns table (kandidaten int, reserve int, ersatzneubau int, gemeinsam int, angelegt int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_k int; n_r int; n_e int; n_g int; n_neu int := 0;
  k record; r_nb record; gid uuid; grund text; titel text; prio numeric; anz_nb int;
  jahr int := extract(year from current_date)::int;
begin
  create temp table if not exists _pot (
    parzelle_id uuid, mandant_id uuid, adresse text, gemeinde text, zone text,
    hnf_delta numeric, reserve_quote numeric, gf_zulaessig numeric, gf_bestand numeric, az_quelle text,
    marge_chf numeric, confidence text,
    baujahr int, geschosse int, fossil boolean, heizung text, gebaeude int,
    r1 boolean, r2 boolean, nachbarn int, nachbar_reserve numeric
  ) on commit drop;
  truncate _pot;

  insert into _pot
  select distinct on (p.id, m.id)
         p.id, m.id, p.address, p.gemeinde, p.zone,
         p.hnf_delta, p.reserve_quote, p.gf_zulaessig, p.gf_bestand, p.az_quelle, p.marge_chf, p.confidence,
         coalesce(pg.haupt_baujahr, p.baujahr::int), pg.geschosse_max, coalesce(pg.fossil, false), kd.text, pg.gebaeude,
         false, false, 0, 0
  from portfolio_position pos
  join portfolio pf on pf.id = pos.portfolio_id
  join mandant m on m.id = pf.mandant_id
  join properties p on p.id = pos.parzelle_id
  left join parzelle_gebaeude pg on pg.egrid = p.egrid
  left join gwr_kode kd on kd.merkmal = 'GENH' and kd.code = pg.haupt_heizung_energie
  where (p_mandant is null or m.id = p_mandant)
    and coalesce(p.ausgeschlossen, false) = false
    and coalesce(p.preselection_status, '') <> 'Ausschliessen'
    and coalesce(p.confidence, 'keine') <> 'keine'
  order by p.id, m.id;

  -- R1 und R2 je Parzelle.
  update _pot set r1 = (hnf_delta >= p_min_reserve);
  update _pot set r2 = r1 and baujahr is not null and baujahr <= jahr - 50 and coalesce(reserve_quote, 0) >= 0.4;

  -- R3: Nachbarn im Bestand mit eigener Reserve, die nicht demselben
  -- Kunden gehören -- sonst wäre es keine gemeinsame Entwicklung,
  -- sondern das eigene Portfolio.
  update _pot t set nachbarn = s.n, nachbar_reserve = s.r
  from (
    select t2.parzelle_id, t2.mandant_id, count(*)::int as n, max(np.hnf_delta) as r
    from _pot t2
    join nachbarschaft nb on nb.parzelle_id = t2.parzelle_id
    join properties np on np.id = nb.nachbar_id
    where np.hnf_delta >= p_min_reserve
      and coalesce(np.ausgeschlossen, false) = false
      and coalesce(np.preselection_status, '') <> 'Ausschliessen'
      and not exists (select 1 from portfolio_position x join portfolio xf on xf.id = x.portfolio_id
                      where x.parzelle_id = np.id and xf.mandant_id = t2.mandant_id)
    group by 1, 2
  ) s where s.parzelle_id = t.parzelle_id and s.mandant_id = t.mandant_id;

  select count(*), count(*) filter (where r1), count(*) filter (where r2),
         count(*) filter (where nachbarn > 0 and (r1 or nachbar_reserve >= 2 * p_min_reserve))
    into n_k, n_r, n_e, n_g from _pot;

  if p_schreiben then
    for k in
      select * from _pot t
      where (t.r1 or (t.nachbarn > 0 and t.nachbar_reserve >= 2 * p_min_reserve))
        and not exists (
          select 1 from gelegenheit x join gelegenheit_parzelle xp on xp.gelegenheit_id = x.id
          where x.anlass = 'ausnuetzungsreserve' and x.mandant_id = t.mandant_id
            and xp.parzelle_id = t.parzelle_id and xp.rolle = 'im portfolio')
      order by t.marge_chf desc nulls last
    loop
      titel := case when k.r2 then 'Ersatzneubau prüfen: '
                    when k.r1 then 'Ausnützungsreserve im Portfolio: '
                    else 'Gemeinsame Entwicklung mit Nachbar: ' end
               || coalesce(k.adresse, '') || coalesce(', ' || k.gemeinde, '');
      grund := 'Reserve ' || replace(to_char(round(coalesce(k.hnf_delta, 0)), 'FM999G999G999'), ',', '''') || ' m² HNF'
               || case when k.gf_zulaessig is not null and k.gf_bestand is not null
                       then ': Bestand ' || replace(to_char(round(k.gf_bestand), 'FM999G999G999'), ',', '''')
                            || ' von ' || replace(to_char(round(k.gf_zulaessig), 'FM999G999G999'), ',', '''') || ' m² aGF'
                       else '' end
               || coalesce(' (Zone ' || nullif(trim(k.zone), '')
                           || case k.az_quelle when 'objekt' then ', Ausnützung aus dem Objekt' when 'zone' then ', Ausnützung aus der Zone'
                                              when 'geschosse' then ', Ausnützung geschätzt' else '' end || ')', '')
               || '. '
               || case when k.baujahr is not null then 'Hauptgebäude ' || k.baujahr else 'Baujahr unbekannt' end
               || coalesce(', ' || k.geschosse || ' Geschosse', '')
               || case when k.fossil then ', heizt mit ' || coalesce(k.heizung, 'Öl oder Gas') else coalesce(', ' || k.heizung, '') end
               || '.'
               || case when k.r2 then ' Mit 50 Jahren oder mehr und weniger als 60 % Ausnützung eher Ersatz als Aufstockung.' else '' end
               || case when k.confidence = 'tief' then ' Rechnung mit tiefer Sicherheit.' else '' end;
      prio := round(coalesce(k.marge_chf, 0) / 1e6, 1)
              + case when k.r2 then 3 else 0 end
              + case when k.fossil then 2 else 0 end
              + least(k.nachbarn, 3);

      insert into gelegenheit (anlass, mandant_id, zustand, titel, begruendung, prioritaet)
      values ('ausnuetzungsreserve', k.mandant_id, 'erkannt', titel, grund, prio)
      returning id into gid;
      insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, k.parzelle_id, 'im portfolio');

      -- Die Nachbarn mit Reserve, die grössten fünf, als Nachbarn der Gelegenheit.
      anz_nb := 0;
      for r_nb in
        select np.id, np.address, np.hnf_delta
        from nachbarschaft n join properties np on np.id = n.nachbar_id
        where n.parzelle_id = k.parzelle_id and np.hnf_delta >= p_min_reserve
          and coalesce(np.ausgeschlossen, false) = false
          and not exists (select 1 from portfolio_position x join portfolio xf on xf.id = x.portfolio_id
                          where x.parzelle_id = np.id and xf.mandant_id = k.mandant_id)
        order by np.hnf_delta desc limit 5
      loop
        insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, r_nb.id, 'nachbar') on conflict do nothing;
        anz_nb := anz_nb + 1;
        if anz_nb = 1 then
          update gelegenheit set begruendung = begruendung || ' Nachbar ' || coalesce(r_nb.address, '') || ' mit '
            || replace(to_char(round(r_nb.hnf_delta), 'FM999G999G999'), ',', '''') || ' m² Reserve'
            || case when k.nachbarn > 1 then ' (' || k.nachbarn || ' Nachbarn mit Reserve)' else '' end || '.'
          where id = gid;
        end if;
      end loop;
      n_neu := n_neu + 1;
    end loop;
  end if;

  return query select n_k, n_r, n_e, n_g, n_neu;
end;
$$;

revoke all on function public.gelegenheiten_potenzial(numeric, boolean, uuid) from public, anon, authenticated;

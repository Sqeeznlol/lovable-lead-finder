-- =====================================================================
-- Gelegenheiten ohne Kunden: "Nachbar baut"
-- =====================================================================
-- Bisher entstand eine Gelegenheit aus einem Baugesuch nur, wenn es die
-- Parzelle eines Kundenportfolios oder deren Nachbarn traf. Echte
-- Portfolios gibt es noch kaum -- am 1. November waren es 3
-- Gelegenheiten aus 7'020 Gesuchen. Julian: "bau die Gelegenheiten ohne
-- Kunden auch."
--
-- Die Regel: Baut der Nachbar (Neubau, Abbruch, Aufstockung, Anbau),
-- ist der Eigentümer einer Parzelle mit grosser Reserve ein Kandidat
-- -- nebenan wird verdichtet, er kann verkaufen oder mitentwickeln.
-- Gemessen sind 17'713 Parzellen mit einem Gesuch nebenan; ohne
-- strenge Auswahl wäre das Rauschen. Darum:
--   * nur Gesuche, deren Beschreibung ein Bauvorhaben nennt,
--   * nur Parzellen mit mindestens p_min_reserve m² Reserve (HNF),
--   * nicht ausgeschlossen, nicht in einem Kundenportfolio (dort
--     greift schon die Kundenregel), nicht das Baugrundstück selbst,
--   * je Parzelle eine Gelegenheit, auch bei mehreren Gesuchen nebenan.
-- Priorität: gerechnete Marge in Mio, plus 5 für ein Gesuch der letzten
-- 30 Tage -- frisch ist, worüber nebenan gerade gesprochen wird.
--
-- p_schreiben = false zählt nur (für die Wahl der Schwelle).
-- =====================================================================

create or replace function public.gelegenheiten_nachbar_baut(
  p_tage int default 30, p_min_reserve numeric default 500,
  p_nur_bauvorhaben boolean default true, p_schreiben boolean default false)
returns table (gesuche int, parzellen int, angelegt int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_g int; n_p int; n_neu int := 0; k record; gid uuid;
begin
  create temp table if not exists _kandidat (parzelle_id uuid, baugesuch_id uuid, ausloeser uuid,
    adresse text, gemeinde text, beschreibung text, publiziert_am date, marge_chf numeric, hnf_delta numeric, gesuche int)
    on commit drop;
  truncate _kandidat;

  insert into _kandidat
  select distinct on (p.id)
         p.id, g.id, g.parzelle_id, p.address, p.gemeinde, g.beschreibung, g.publiziert_am,
         p.marge_chf, p.hnf_delta,
         count(*) over (partition by p.id)::int
  from baugesuch g
  join properties p on p.egrid = any (g.nachbar_egrids)
  where g.publiziert_am > current_date - p_tage
    and g.nachbar_egrids is not null
    and (not p_nur_bauvorhaben
         or g.beschreibung ~* '(neubau|abbruch|rückbau|aufstock|anbau|ersatzbau|überbauung|mehrfamilienhaus|wohnüberbauung)')
    and p.hnf_delta >= p_min_reserve
    and coalesce(p.ausgeschlossen, false) = false
    and coalesce(p.preselection_status, '') <> 'Ausschliessen'
    and p.id is distinct from g.parzelle_id
    and not exists (select 1 from portfolio_position pp where pp.parzelle_id = p.id)
  order by p.id, g.publiziert_am desc;

  select count(distinct baugesuch_id), count(*) into n_g, n_p from _kandidat;

  if p_schreiben then
    -- Parzelle für Parzelle: so hängt jede Gelegenheit sicher an ihrer
    -- Parzelle, auch wenn zwei Parzellen dieselbe Adresse tragen.
    for k in select * from _kandidat c
             where not exists (
               -- Je Parzelle nur eine Gelegenheit dieser Art.
               select 1 from gelegenheit x join gelegenheit_parzelle xp on xp.gelegenheit_id = x.id
               where x.anlass = 'baugesuch' and x.mandant_id is null
                 and xp.parzelle_id = c.parzelle_id and xp.rolle = 'nachbar')
    loop
      insert into gelegenheit (anlass, baugesuch_id, mandant_id, zustand, titel, begruendung, prioritaet)
      values ('baugesuch', k.baugesuch_id, null, 'erkannt',
              'Nachbar baut: ' || coalesce(k.adresse, '') || coalesce(', ' || k.gemeinde, ''),
              left(coalesce(k.beschreibung, ''), 300)
                || ' -- nebenan, publiziert ' || to_char(k.publiziert_am, 'DD.MM.YYYY')
                || case when k.gesuche > 1 then ' (' || k.gesuche || ' Gesuche nebenan)' else '' end
                || '. Reserve ' || round(k.hnf_delta) || ' m² HNF.',
              round(coalesce(k.marge_chf, 0) / 1e6, 1) + case when k.publiziert_am > current_date - 30 then 5 else 0 end)
      returning id into gid;
      insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, k.parzelle_id, 'nachbar');
      if k.ausloeser is not null then
        insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, k.ausloeser, 'ausloeser')
        on conflict do nothing;
      end if;
      n_neu := n_neu + 1;
    end loop;
  end if;

  return query select n_g, n_p, n_neu;
end;
$$;

revoke all on function public.gelegenheiten_nachbar_baut(int, numeric, boolean, boolean) from public, anon, authenticated;

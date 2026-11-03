-- Die Gebäudesuche findet beide Schreibweisen einer Gemeinde.
--
-- Im Bestand steht dieselbe Gemeinde teils als "Küsnacht (ZH)" (2'447
-- Parzellen) und als "Küsnacht ZH" (611), bei 20 Gemeinden so (Ablauf
-- Tempo, 3. November). Die Auswahl zeigt jede Gemeinde einmal
-- (src/lib/gemeinden.ts); bisher fand die Suche dann nur die eine
-- Schreibweise und liess z.B. in Küsnacht ein Fünftel weg.
--
-- Weiterhin genaue Namen über den Index (idx_properties_gemeinde), nur
-- mehr davon: "X", "X (ZH)", "X ZH". "(TG)" bleibt aussen vor --
-- Rickenbach (TG) ist eine andere Gemeinde als Rickenbach (ZH).

create or replace function public.gebaeude_suchen(
  p_gemeinde text default null,
  p_baujahr_von int default null,
  p_baujahr_bis int default null,
  p_zimmer_min int default null,
  p_zimmer_max int default null,
  p_wohnflaeche_min int default null,
  p_klasse int default null,
  p_grenze int default 200
)
returns table (
  parzelle_id uuid, adresse text, gemeinde text, egrid text, egid bigint, klasse smallint,
  baujahr smallint, zimmer smallint, wohnflaeche integer, wohnungen smallint, geschosse smallint,
  heizung_energie smallint
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with name as (
    select regexp_replace(p_gemeinde, '\s+(\(ZH\)|ZH)$', '') as grund
  ),
  gem as materialized (
    select p.egrid from public.properties p, name n
    where p_gemeinde is not null and p.egrid is not null
      and p.gemeinde = any (array[p_gemeinde, n.grund, n.grund || ' (ZH)', n.grund || ' ZH'])
  ),
  kand as materialized (
    select g.* from public.gebaeude g
    where (p_gemeinde is null or g.egrid in (select egrid from gem))
      and (p_baujahr_von is null or g.baujahr >= p_baujahr_von)
      and (p_baujahr_bis is null or g.baujahr <= p_baujahr_bis)
      and (p_zimmer_min is null or g.zimmer >= p_zimmer_min)
      and (p_zimmer_max is null or g.zimmer <= p_zimmer_max)
      and (p_wohnflaeche_min is null or g.wohnflaeche >= p_wohnflaeche_min)
      and (p_klasse is null or g.klasse = p_klasse)
    order by g.wohnflaeche desc nulls last, g.egid
    limit least(greatest(coalesce(p_grenze, 200), 1), 1000)
  )
  select p.id, p.address, p.gemeinde, k.egrid, k.egid, k.klasse,
         k.baujahr, k.zimmer, k.wohnflaeche, k.wohnungen, k.geschosse, k.heizung_energie
  from kand k
  join public.properties p on p.egrid = k.egrid
  order by k.wohnflaeche desc nulls last, k.egid;
$$;

revoke all on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) from public, anon;
grant execute on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) to authenticated;

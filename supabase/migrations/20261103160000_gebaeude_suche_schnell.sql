-- Die Gebäudesuche lief auf dem Server in die Zeitgrenze: dreimal 500
-- nach 8,8 s (Ablauf Tempo, 3. November, Küsnacht 1940-1960). Grund war
-- "gemeinde ilike ...%" auf properties: das liest die ganze Tabelle
-- (454 MB) von der Platte, bevor die Gebäude verbunden werden.
--
-- Jetzt in drei Schritten, jeder über einen Index:
--   1. Parzellen der Gemeinde, genauer Name (idx_properties_gemeinde).
--      Die Seite bietet die Namen aus gemeinde_stats zur Auswahl an.
--   2. Deren Gebäude mit den Filtern (idx_gebaeude_egrid), nach Fläche
--      sortiert, begrenzt -- ohne Gemeinde: alle Gebäude (31 MB).
--   3. Erst diese wenigen mit Adresse und Gemeinde verbinden.

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
  with gem as materialized (
    select p.egrid from public.properties p
    -- Genau, oder mit Kanton dahinter ("Wetzikon (ZH)" steht so im Bestand).
    where p_gemeinde is not null and p.egrid is not null
      and p.gemeinde = any (array[p_gemeinde, p_gemeinde || ' (ZH)', p_gemeinde || ' (TG)'])
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

-- Suche im eigenen Bestand nach Baujahr, Zimmern und Wohnfläche (Julian,
-- 3. November: "eine Suchfunktion, Baujahr, Zimmer und mindestens
-- Wohnfläche").
--
-- Zimmer und Wohnfläche stehen im Register je Wohnung; der Ablauf
-- "Gebäude" summiert die bestehenden Wohnungen je Gebäude
-- (tools/gwr_gebaeude.py). Bei einem Mehrfamilienhaus ist das die Summe
-- aller Wohnungen -- die Suche nennt darum auch die Zahl der Wohnungen,
-- und nach Gebäudeart lässt sich eingrenzen (GKLAS, Texte in gwr_kode).

alter table public.gebaeude
  add column if not exists zimmer smallint,
  add column if not exists wohnflaeche integer;

-- Die Ansicht je Parzelle bekommt die beiden Summen dazu (am Ende
-- angehängt, wie es "create or replace view" verlangt).
create or replace view public.parzelle_gebaeude
with (security_invoker = true) as
select
  g.egrid,
  count(*)::int                                                        as gebaeude,
  sum(g.wohnungen)::int                                                as wohnungen,
  max(g.geschosse)::int                                                as geschosse_max,
  min(g.baujahr)::int                                                  as baujahr_aeltestes,
  max(g.baujahr)::int                                                  as baujahr_juengstes,
  sum(g.energieflaeche)::int                                           as energieflaeche,
  (array_agg(g.baujahr order by g.grundflaeche desc nulls last))[1]    as haupt_baujahr,
  (array_agg(g.heizung order by g.grundflaeche desc nulls last))[1]    as haupt_heizung,
  (array_agg(g.heizung_energie order by g.grundflaeche desc nulls last))[1] as haupt_heizung_energie,
  (array_agg(g.heizung_seit order by g.grundflaeche desc nulls last))[1]    as haupt_heizung_seit,
  coalesce(bool_or(g.heizung_energie in (7520, 7530)), false)          as fossil,
  sum(g.zimmer)::int                                                   as zimmer,
  sum(g.wohnflaeche)::int                                              as wohnflaeche
from public.gebaeude g
where g.egrid is not null
group by g.egrid;

-- Die Suche liest gebaeude ganz (370'000 Zeilen, 31 MB) und verbindet mit
-- properties über egrid (Index) -- gemessen wird nach dem Einspielen.
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
  select p.id, p.address, p.gemeinde, g.egrid, g.egid, g.klasse,
         g.baujahr, g.zimmer, g.wohnflaeche, g.wohnungen, g.geschosse, g.heizung_energie
  from public.gebaeude g
  join public.properties p on p.egrid = g.egrid
  where (p_gemeinde is null or p.gemeinde ilike p_gemeinde || '%')
    and (p_baujahr_von is null or g.baujahr >= p_baujahr_von)
    and (p_baujahr_bis is null or g.baujahr <= p_baujahr_bis)
    and (p_zimmer_min is null or g.zimmer >= p_zimmer_min)
    and (p_zimmer_max is null or g.zimmer <= p_zimmer_max)
    and (p_wohnflaeche_min is null or g.wohnflaeche >= p_wohnflaeche_min)
    and (p_klasse is null or g.klasse = p_klasse)
  order by g.wohnflaeche desc nulls last, g.egid
  limit least(greatest(coalesce(p_grenze, 200), 1), 1000);
$$;

revoke all on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) from public, anon;
grant execute on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) to authenticated;

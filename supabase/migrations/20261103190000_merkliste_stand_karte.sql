-- Merkliste wie ein kleines CRM, und die Treffer auf der Karte
-- (Julian, 3. November: "mach 1, 2 und Karte").
--
-- 1. Stand und Notiz je Gebäude auf der Liste. Bewusst hier und nicht
--    in properties.status: jener Status steuert den Akquise-Modus und
--    den Pipedrive-Export ("Kontaktiert" schöbe die Parzelle in den
--    Export). Der Stand gehört zur Liste -- dasselbe Haus kann auf einer
--    Liste "Brief geschickt" und auf einer anderen "offen" sein.
--
-- 2. Lage: gebaeude_suchen und merkliste_gebaeude geben einen Punkt in
--    der Parzelle (WGS84) mit, für die Karte. ST_PointOnSurface statt
--    Schwerpunkt: der liegt bei einer L-förmigen Parzelle daneben.
--    Berechnet nur für die zurückgegebenen Zeilen (höchstens 1000).
--
-- Die Rückgabe beider Funktionen ändert sich; "create or replace" geht
-- dann nicht, darum erst löschen.

alter table public.merkliste_eintrag
  add column if not exists stand text not null default 'offen'
    check (stand in ('offen', 'brief', 'angerufen', 'interesse', 'termin', 'kein_interesse')),
  add column if not exists notiz text check (length(notiz) <= 2000),
  add column if not exists stand_am timestamptz;

drop function if exists public.merkliste_gebaeude(uuid);
create function public.merkliste_gebaeude(p_liste uuid)
returns table (
  parzelle_id uuid, adresse text, gemeinde text, egrid text, egid bigint, klasse smallint,
  baujahr smallint, zimmer smallint, wohnflaeche integer, wohnungen smallint, geschosse smallint,
  heizung_energie smallint, eigentuemer text,
  stand text, notiz text, stand_am timestamptz, telefon_bekannt boolean, parzelle_status text,
  lat double precision, lon double precision
)
language sql
stable
security invoker
set search_path to 'public', 'extensions'
as $$
  select coalesce(e.parzelle_id, p.id), p.address, p.gemeinde, g.egrid, e.egid, g.klasse,
         g.baujahr, g.zimmer, g.wohnflaeche, g.wohnungen, g.geschosse, g.heizung_energie, p.owner_name,
         e.stand, e.notiz, e.stand_am,
         -- Nur ob, nicht welche: die Nummer selbst braucht die Liste nicht.
         coalesce(nullif(trim(p.owner_phone), ''), null) is not null, p.status,
         ST_Y(pt.punkt), ST_X(pt.punkt)
  from public.merkliste_eintrag e
  left join public.gebaeude g on g.egid = e.egid
  left join public.properties p on p.id = e.parzelle_id
  left join lateral (select ST_Transform(ST_PointOnSurface(p.geometrie), 4326) as punkt) pt on p.geometrie is not null
  where e.liste_id = p_liste
  order by p.gemeinde nulls last, p.address nulls last, e.egid;
$$;
revoke all on function public.merkliste_gebaeude(uuid) from public, anon;
grant execute on function public.merkliste_gebaeude(uuid) to authenticated;

drop function if exists public.gebaeude_suchen(text, int, int, int, int, int, int, int);
create function public.gebaeude_suchen(
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
  heizung_energie smallint, lat double precision, lon double precision
)
language sql
stable
security invoker
set search_path to 'public', 'extensions'
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
         k.baujahr, k.zimmer, k.wohnflaeche, k.wohnungen, k.geschosse, k.heizung_energie,
         ST_Y(pt.punkt), ST_X(pt.punkt)
  from kand k
  join public.properties p on p.egrid = k.egrid
  left join lateral (select ST_Transform(ST_PointOnSurface(p.geometrie), 4326) as punkt) pt on p.geometrie is not null
  order by k.wohnflaeche desc nulls last, k.egid;
$$;
revoke all on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) from public, anon;
grant execute on function public.gebaeude_suchen(text, int, int, int, int, int, int, int) to authenticated;

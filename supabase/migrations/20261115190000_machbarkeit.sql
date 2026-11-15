-- =====================================================================
-- Machbarkeit: was der Umriss einer Parzelle hergibt
-- =====================================================================
-- Julian, 15. November: eine Machbarkeitsstudie mit Aurora, "aber
-- richtig gute, die realistisch sind". Realistisch heisst: nicht nur
-- Fläche mal Ausnützung, sondern auch, ob das Volumen auf dem
-- Grundstück Platz hat. Dafür braucht es den Umriss -- und der liegt in
-- der Datenbank, wo PostGIS damit rechnen kann.
--
-- Die Funktion liefert zu einer Parzelle
--   * Fläche und Umfang des Umrisses (Amtliche Vermessung),
--   * die bebaubare Grundfläche: der Umriss, rundum um den
--     Grenzabstand nach innen versetzt,
--   * beide Flächen als GeoJSON, damit die Seite sie zeichnen kann,
--   * einen Punkt sicher innerhalb der Parzelle (für die Zonenabfrage),
--   * die Gebäude der Parzelle aus dem Register (Grundfläche, Geschosse).
--
-- Der Grenzabstand ist eine Eingabe, kein Wissen: er steht in keiner
-- offenen Quelle, nur in der Bauordnung jeder Gemeinde. Die Seite zeigt
-- ihn darum als Annahme und lässt ihn ändern.
--
-- Mit den Rechten des Aufrufers: wer die Parzelle nicht lesen darf,
-- bekommt nichts.
-- =====================================================================

create or replace function public.machbarkeit_grundlage(p_parzelle uuid, p_abstand numeric default 5)
returns jsonb
language sql
stable
security invoker
set search_path to 'public', 'extensions'
as $$
  with p as (
    select id, egrid, area, kanton, geometrie,
           greatest(0, least(coalesce(p_abstand, 5), 30)) as abstand
      from public.properties
     where id = p_parzelle
  ), h as (
    select p.*,
           case when geometrie is not null and abstand > 0 then ST_Buffer(geometrie, -abstand)
                else geometrie end as innen
      from p
  )
  select jsonb_build_object(
    'umriss_da',      geometrie is not null,
    'abstand',        abstand,
    'flaeche_umriss', round(ST_Area(geometrie)::numeric),
    'umfang',         round(ST_Perimeter(geometrie)::numeric),
    'bebaubar_m2',    case when geometrie is null then null
                           when innen is null or ST_IsEmpty(innen) then 0
                           else round(ST_Area(innen)::numeric) end,
    'punkt',          case when geometrie is not null then jsonb_build_array(
                        round(ST_X(ST_PointOnSurface(geometrie))::numeric, 1),
                        round(ST_Y(ST_PointOnSurface(geometrie))::numeric, 1)) end,
    'rahmen',         case when geometrie is not null then jsonb_build_array(
                        round(ST_XMin(geometrie)::numeric, 1), round(ST_YMin(geometrie)::numeric, 1),
                        round(ST_XMax(geometrie)::numeric, 1), round(ST_YMax(geometrie)::numeric, 1)) end,
    'umriss',         case when geometrie is not null then ST_AsGeoJSON(geometrie, 2)::jsonb end,
    'innen',          case when innen is not null and not ST_IsEmpty(innen) then ST_AsGeoJSON(innen, 2)::jsonb end,
    'nachbarn',       (select count(*) from public.nachbarschaft n where n.parzelle_id = h.id),
    'gebaeude',       (select coalesce(jsonb_agg(jsonb_build_object(
                          'egid', g.egid, 'grundflaeche', g.grundflaeche, 'geschosse', g.geschosse,
                          'baujahr', g.baujahr, 'wohnungen', g.wohnungen, 'klasse', g.klasse, 'volumen', g.volumen)
                          order by g.grundflaeche desc nulls last), '[]'::jsonb)
                         from public.gebaeude g where g.egrid = h.egrid)
  )
  from h;
$$;

revoke all on function public.machbarkeit_grundlage(uuid, numeric) from public, anon;
grant execute on function public.machbarkeit_grundlage(uuid, numeric) to authenticated;

comment on function public.machbarkeit_grundlage(uuid, numeric) is
  'Umriss, bebaubare Grundfläche nach Grenzabstand und Gebäude einer Parzelle -- Grundlage der Machbarkeitsstudie.';

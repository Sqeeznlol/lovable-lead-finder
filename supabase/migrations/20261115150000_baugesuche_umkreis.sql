-- =====================================================================
-- Baugesuche im Umkreis einer Adresse, für den Check (nur Zählungen)
-- =====================================================================
-- Julian, 15. November: «mach» zu «Baugesuche in der Nachbarschaft im
-- Check». Öffentlich ist nur diese eine Frage: wie viele Gesuche in den
-- letzten 12 Monaten im Umkreis, nach Art. Keine Adresse, keine
-- Bauherrschaft, keine Beschreibung verlässt die Datenbank.
--
-- Standort: Amtsblatt-Gesuche tragen einen Punkt (gemessen 15.11.: in 11
-- Kantonen die meisten). Die Zürcher Gesuche haben keinen (7'300 ohne),
-- aber 7'212 hängen an einer Parzelle; dort zählt der Umriss der Parzelle.
-- Der Radius ist auf 1 km begrenzt, damit niemand die Tabelle abgrast.
create or replace function public.baugesuche_umkreis(p_e double precision, p_n double precision, p_meter integer default 300)
returns json
language sql stable security definer set search_path = public, extensions as $$
  with punkt as (
    select st_setsrid(st_makepoint(p_e, p_n), 2056) as g, least(greatest(coalesce(p_meter, 300), 50), 1000) as r
     where p_e between 2480000 and 2840000 and p_n between 1070000 and 1300000
  ),
  treffer as (
    select b.id, b.publiziert_am, b.beschreibung
      from public.baugesuch b, punkt
     where b.geometrie is not null and st_dwithin(b.geometrie, punkt.g, punkt.r)
       and b.publiziert_am > current_date - 365 and b.quelle <> 'probe'
    union
    select b.id, b.publiziert_am, b.beschreibung
      from public.properties p
      join public.baugesuch b on b.parzelle_id = p.id, punkt
     where b.geometrie is null and st_dwithin(p.geometrie, punkt.g, punkt.r)
       and b.publiziert_am > current_date - 365 and b.quelle <> 'probe'
  )
  select json_build_object(
    'meter', (select r from punkt),
    'n365', count(*),
    'n90', count(*) filter (where publiziert_am > current_date - 90),
    'neubau', count(*) filter (where beschreibung ~* 'neubau'),
    'umbau', count(*) filter (where beschreibung ~* 'umbau|anbau|aufstock|sanierung|erweiterung'),
    'aufstockung', count(*) filter (where beschreibung ~* 'aufstock'),
    'waermepumpe', count(*) filter (where beschreibung ~* 'w(ä|ae)rmepumpe'),
    'solar', count(*) filter (where beschreibung ~* 'photovoltaik|pv-anlage|solaranlage|solarpanel'),
    'abbruch', count(*) filter (where beschreibung ~* 'abbruch'),
    'seit', (select min(publiziert_am) from public.baugesuch where quelle <> 'probe' and publiziert_am > current_date - 365))
  from treffer
  where exists (select 1 from punkt);
$$;
revoke all on function public.baugesuche_umkreis(double precision, double precision, integer) from public;
grant execute on function public.baugesuche_umkreis(double precision, double precision, integer) to anon, authenticated;

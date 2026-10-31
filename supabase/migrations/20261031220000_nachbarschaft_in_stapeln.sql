-- =====================================================================
-- Nachbarschaft in Stapeln, nicht am Stück
-- =====================================================================
-- Am 31. Oktober gemessen: der Versuch, 137'269 Umrisse in einer
-- Anweisung einzutragen, hat die Datenbank zum Absturz gebracht.
--
--   WARNING: terminating connection because of crash of another
--            server process
--   DETAIL:  ... another server process exited abnormally and
--            possibly corrupted shared memory
--
-- Das ist kein Zeitlimit, sondern der Arbeitsspeicher: jedes Polygon
-- wird beim Eintragen zerlegt, dazu kommt die Pflege des
-- GIST-Index -- alles in einer Transaktion, die bis zum Schluss
-- nichts freigeben kann.
--
-- Also in Stapeln. Jeder Stapel ist eine eigene Transaktion und gibt
-- seinen Speicher danach frei. Dafür braucht es einen Merker, sonst
-- nimmt der nächste Stapel dieselben Parzellen wieder -- und eine
-- Parzelle ohne Nachbarn liesse sich sonst nie von einer noch nicht
-- gerechneten unterscheiden.
-- =====================================================================

set search_path to public, extensions;

alter table public.properties
  add column if not exists nachbarn_stand timestamptz;

comment on column public.properties.nachbarn_stand is
  'Wann die Nachbarschaft dieser Parzelle zuletzt gerechnet wurde. '
  'Leer heisst: noch nicht -- nicht etwa "hat keine Nachbarn".';

-- Genau die Abfrage, die der Stapellauf stellt.
create index if not exists idx_properties_nachbarn_offen
  on public.properties (kanton)
  where geometrie is not null and nachbarn_stand is null;

-- Die alte Fassung rechnete alles auf einmal und hat damit die
-- Datenbank umgebracht.
drop function if exists public.nachbarschaft_rechnen(text);

/**
 * Rechnet die Nachbarschaft für höchstens `p_menge` noch offene
 * Parzellen. Gibt zurück, wie viele bearbeitet wurden -- 0 heisst:
 * fertig. Der Aufrufer ruft in einer Schleife, bis 0 kommt.
 */
create or replace function public.nachbarschaft_rechnen(
  p_kanton text default null,
  p_menge  int  default 2000
)
returns table(bearbeitet int, paare int)
language sql
set search_path to 'public', 'extensions'
as $$
  -- Eine einzige Anweisung, ohne temporaere Tabelle. Der erste
  -- Entwurf benutzte eine mit "on commit drop" -- das bricht, sobald
  -- die Funktion zweimal in derselben Transaktion gerufen wird, und
  -- genau das tut der Test. Als gemeinsamer Ausdruck wird der Stapel
  -- einmal berechnet und von beiden Zweigen benutzt.
  with stapel as (
    select id, geometrie
      from public.properties
     where geometrie is not null
       and nachbarn_stand is null
       and (p_kanton is null or kanton = p_kanton)
     limit p_menge
  ),
  -- Beide Richtungen werden eingetragen. Das verdoppelt die Zeilen,
  -- erspart aber jeder Abfrage ein ODER ueber zwei Spalten.
  --
  -- Das `&&` ist nicht ueberfluessig: ST_Touches allein benutzt den
  -- Index nicht, der Umgebungsvergleich davor schon.
  eingefuegt as (
    insert into public.nachbarschaft (parzelle_id, nachbar_id, grenzlaenge_m, distanz_m)
    select a.id, b.id,
           round(ST_Length(ST_Intersection(a.geometrie, b.geometrie))::numeric, 2),
           0
      from stapel a
      join public.properties b
        on b.id <> a.id
       and b.geometrie is not null
       and a.geometrie && b.geometrie
       and ST_Touches(a.geometrie, b.geometrie)
    on conflict (parzelle_id, nachbar_id) do nothing
    returning 1
  ),
  markiert as (
    update public.properties p
       set nachbarn_stand = now()
      from stapel s
     where s.id = p.id
    returning 1
  )
  select (select count(*) from markiert)::int,
         (select count(*) from eingefuegt)::int;
$$;

comment on function public.nachbarschaft_rechnen(text, int) is
  'Ein Stapel. Der Aufrufer wiederholt, bis 0 zurueckkommt -- alles '
  'auf einmal hat die Datenbank am 31. Oktober zum Absturz gebracht.';

/** Noch einmal von vorn, etwa nach neuen Umrissen. */
create or replace function public.nachbarschaft_zuruecksetzen(p_kanton text default null)
returns int
language plpgsql
set search_path to 'public'
as $$
declare v int;
begin
  delete from public.nachbarschaft n
   using public.properties p
   where p.id = n.parzelle_id
     and (p_kanton is null or p.kanton = p_kanton);

  update public.properties
     set nachbarn_stand = null
   where (p_kanton is null or kanton = p_kanton);
  get diagnostics v = row_count;
  return v;
end;
$$;

-- =====================================================================
-- Dieselbe Falle bei der Uebernahme
-- =====================================================================
-- `eigentuemer_uebernehmen` legt ihre Arbeitstabelle mit
-- "create temporary table if not exists" an. Wird die Funktion
-- zweimal in derselben Transaktion gerufen, bleiben beim zweiten Mal
-- die Zeilen des ersten stehen -- sie arbeitet dann auf altem Stand.
--
-- Aufgefallen ist es hier, weil `nachbarschaft_rechnen` an derselben
-- Stelle hart gescheitert ist ("relation _stapel already exists").
-- Dort war es ein Fehler, hier ist es schlimmer: es faellt nicht auf.
--
-- Die Migration von 19:00 Uhr ist bereits eingespielt und wird
-- deshalb nicht nachtraeglich geaendert -- sonst laufen Datei und
-- Datenbank auseinander. Die Funktion wird hier neu geschrieben.
-- =====================================================================
create or replace function public.eigentuemer_uebernehmen()
returns table(akteure_neu int, eigentum_neu int, quellzeilen int)
language plpgsql
set search_path to 'public'
as $$
declare
  v_akteure   int := 0;
  v_eigentum  int := 0;
  v_zeilen    int := 0;
begin
  -- Erst weg, dann neu: siehe oben.
  drop table if exists _nennung;
  create temporary table _nennung on commit drop as
  with aus_json as (
    select p.id as parzelle_id,
           nullif(btrim(o.wert ->> 'name'), '')    as name,
           nullif(btrim(o.wert ->> 'address'), '') as adresse,
           nullif(btrim(o.wert ->> 'plz'), '')     as plz,
           nullif(btrim(o.wert ->> 'ort'), '')     as ort,
           nullif(btrim(o.wert ->> 'ownershipType'), '') as art_eigentum,
           'owners_json'::text                     as quelle,
           p.eigentuemer_fetched_at                as stand
    from public.properties p
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p.owners_json::jsonb) = 'array'
           then p.owners_json::jsonb else '[]'::jsonb end) as o(wert)
  ),
  aus_text as (
    select p.id,
           nullif(btrim(n.name), '') as name,
           nullif(btrim(p.eigentuemer_adresse), '') as adresse,
           split_part(coalesce(p.eigentuemer_plz_ort, ''), ' ', 1) as plz,
           btrim(substr(coalesce(p.eigentuemer_plz_ort, ''),
                        length(split_part(coalesce(p.eigentuemer_plz_ort,''),' ',1)) + 1)) as ort,
           null::text as art_eigentum,
           'owner_name'::text as quelle,
           p.eigentuemer_fetched_at as stand
    from public.properties p
    cross join lateral (values (p.owner_name), (p.owner_name_2)) as n(name)
    where not exists (select 1 from aus_json j where j.parzelle_id = p.id)
  )
  select * from aus_json where name is not null
  union all
  select * from aus_text where name is not null;

  select count(*) into v_zeilen from _nennung;

  with eingestuft as (
    select distinct on (schluessel)
           schluessel, name, art, adresse, plz, ort
    from (
      select n.name,
             public.akteur_art(n.name) as art,
             n.adresse, n.plz, n.ort,
             case when public.akteur_art(n.name) in ('firma', 'institution')
                  then public.akteur_art(n.name) || '|' || public.akteur_norm(n.name)
                  else public.akteur_art(n.name) || '|' || public.akteur_norm(n.name)
                       || '|' || coalesce(n.plz, '')
             end as schluessel
      from _nennung n
    ) x
    order by schluessel, length(coalesce(adresse, '')) desc
  ),
  eingefuegt as (
    insert into public.akteur (art, name, adresse, plz, ort, herkunft,
                               art_sicher, name_umgedreht)
    select e.art, e.name, e.adresse, e.plz, e.ort,
           'uebernahme properties',
           e.name ~ '\s',
           public.akteur_name_umgedreht(e.name)
    from eingestuft e
    where not exists (
      select 1 from public.akteur a
      where a.name_norm = public.akteur_norm(e.name)
        and (a.art in ('firma', 'institution')
             or coalesce(a.plz, '') = coalesce(e.plz, ''))
    )
    returning 1
  )
  select count(*) into v_akteure from eingefuegt;

  with zuordnung as (
    select distinct n.parzelle_id, a.id as akteur_id,
           n.art_eigentum, n.quelle, n.stand
    from _nennung n
    join public.akteur a
      on a.name_norm = public.akteur_norm(n.name)
     and (a.art in ('firma', 'institution')
          or coalesce(a.plz, '') = coalesce(n.plz, ''))
  ),
  eingefuegt as (
    insert into public.eigentum (parzelle_id, akteur_id, art, quelle, stand, geprueft)
    select z.parzelle_id, z.akteur_id, z.art_eigentum,
           'uebernahme ' || z.quelle,
           coalesce(z.stand, now()),
           false
    from zuordnung z
    on conflict (parzelle_id, akteur_id) do nothing
    returning 1
  )
  select count(*) into v_eigentum from eingefuegt;

  return query select v_akteure, v_eigentum, v_zeilen;
end;
$$;

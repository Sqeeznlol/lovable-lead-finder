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
language plpgsql
set search_path to 'public', 'extensions'
as $$
declare
  v_bearbeitet int := 0;
  v_paare      int := 0;
begin
  create temporary table _stapel on commit drop as
  select id, geometrie
    from public.properties
   where geometrie is not null
     and nachbarn_stand is null
     and (p_kanton is null or kanton = p_kanton)
   limit p_menge;

  select count(*) into v_bearbeitet from _stapel;
  if v_bearbeitet = 0 then
    return query select 0, 0;
    return;
  end if;

  -- Beide Richtungen werden eingetragen. Das verdoppelt die Zeilen,
  -- erspart aber jeder Abfrage ein ODER über zwei Spalten.
  --
  -- Das `&&` ist nicht überflüssig: ST_Touches allein benutzt den
  -- Index nicht, der Umgebungsvergleich davor schon.
  insert into public.nachbarschaft (parzelle_id, nachbar_id, grenzlaenge_m, distanz_m)
  select a.id, b.id,
         round(ST_Length(ST_Intersection(a.geometrie, b.geometrie))::numeric, 2),
         0
  from _stapel a
  join public.properties b
    on b.id <> a.id
   and b.geometrie is not null
   and a.geometrie && b.geometrie
   and ST_Touches(a.geometrie, b.geometrie)
  on conflict (parzelle_id, nachbar_id) do nothing;

  get diagnostics v_paare = row_count;

  update public.properties p
     set nachbarn_stand = now()
    from _stapel s
   where s.id = p.id;

  return query select v_bearbeitet, v_paare;
end;
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

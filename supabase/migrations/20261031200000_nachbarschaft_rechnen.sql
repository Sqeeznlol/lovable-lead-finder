-- =====================================================================
-- Nachbarschaft ausrechnen
-- =====================================================================
-- Die Frage, an der alles hängt: welche Parzellen grenzen an diese?
-- Arrondierung, die Zuordnung von Baugesuchen und die
-- Nachbarschaftsanalyse brauchen sie alle, und ohne sie ist keiner
-- der drei Dienste baubar.
--
-- Vorberechnet, nicht bei jeder Anfrage gerechnet: ST_Touches über
-- 396'271 Polygone ist nichts für den Klick eines Benutzers. Bei
-- 400'000 Parzellen entstehen rund zwei bis drei Millionen Paare --
-- einmal gerechnet, danach ein Indexzugriff.
--
-- Je Kanton, nicht alles auf einmal: dieses Projekt ist bei genau
-- dieser Tabelle schon dreimal in die Zeitgrenze gelaufen.
-- =====================================================================

set search_path to public, extensions;

create or replace function public.nachbarschaft_rechnen(p_kanton text default null)
returns table(parzellen int, paare int)
language plpgsql
set search_path to 'public', 'extensions'
as $$
declare
  v_parzellen int;
  v_paare     int;
begin
  -- Was neu gerechnet wird, muss vorher weg -- sonst bleiben Paare
  -- stehen, deren Parzelle inzwischen eine andere Grenze hat.
  delete from public.nachbarschaft n
  using public.properties p
  where p.id = n.parzelle_id
    and (p_kanton is null or p.kanton = p_kanton);

  select count(*) into v_parzellen
  from public.properties
  where geometrie is not null
    and (p_kanton is null or kanton = p_kanton);

  -- Beide Richtungen werden eingetragen. Das verdoppelt die Zeilen,
  -- erspart aber jeder Abfrage ein OR über zwei Spalten -- und genau
  -- solche Abfragen sind hier vorher zusammengebrochen.
  --
  -- Das `&&` ist nicht überflüssig: ST_Touches allein benutzt den
  -- Index nicht, der Umgebungsvergleich davor schon.
  insert into public.nachbarschaft (parzelle_id, nachbar_id, grenzlaenge_m, distanz_m)
  select a.id, b.id,
         round(ST_Length(ST_Intersection(a.geometrie, b.geometrie))::numeric, 2),
         0
  from public.properties a
  join public.properties b
    on a.id <> b.id
   and a.geometrie && b.geometrie
   and ST_Touches(a.geometrie, b.geometrie)
  where a.geometrie is not null
    and b.geometrie is not null
    and (p_kanton is null or a.kanton = p_kanton)
  on conflict (parzelle_id, nachbar_id) do nothing;

  get diagnostics v_paare = row_count;
  return query select v_parzellen, v_paare;
end;
$$;

comment on function public.nachbarschaft_rechnen(text) is
  'Rechnet die Nachbarschaft eines Kantons neu. Ohne Argument alle -- '
  'das ist bei 396 000 Parzellen eine Sache von Minuten, nicht von '
  'Sekunden, und gehoert in einen Ablauf, nicht in einen Klick.';

-- ---------------------------------------------------- Zum Nachsehen
-- Die Nachbarn einer Parzelle, mit allem, was fuer einen Anruf oder
-- eine Arrondierung zaehlt.
create or replace view public.nachbarn as
select n.parzelle_id,
       p.egrid           as nachbar_egrid,
       p.address         as nachbar_adresse,
       p.parzelle        as nachbar_parzelle,
       p.gemeinde        as nachbar_gemeinde,
       p.kanton          as nachbar_kanton,
       p.area            as nachbar_flaeche,
       p.zone            as nachbar_zone,
       n.grenzlaenge_m,
       p.id              as nachbar_id
from public.nachbarschaft n
join public.properties p on p.id = n.nachbar_id;

comment on view public.nachbarn is
  'Nachbarn je Parzelle, fertig fuer die Oberflaeche. Eigentuemer '
  'stehen bewusst nicht drin -- die haengen an akteur/eigentum und '
  'unterliegen eigenen Zugriffsregeln.';

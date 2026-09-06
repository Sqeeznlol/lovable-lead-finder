-- =====================================================================
-- Die Gemeindeliste kennt jetzt den Kanton
-- =====================================================================
-- Seit dem Thurgau stehen 137'214 Thurgauer Objekte neben den
-- Zürcher. Die Objektliste filtert danach, die Gemeindeauswahl daneben
-- nicht: sie zeigte Andelfingen und Amriswil untereinander, und wer im
-- Thurgau auf eine Zürcher Gemeinde klickte, bekam eine leere Liste.
--
-- Die Ansicht gruppierte nur nach Gemeindenamen. Sie gruppiert jetzt
-- nach Kanton und Gemeinde -- damit lässt sich filtern, und
-- gleichnamige Gemeinden zweier Kantone fallen nicht mehr zusammen.

drop materialized view if exists public.gemeinde_stats_mv;

create materialized view public.gemeinde_stats_mv as
select
  coalesce(p.kanton, 'ZH') as kanton,
  coalesce(p.gemeinde, '— ohne Gemeinde —') as gemeinde,
  count(*)::bigint as total,
  count(*) filter (
    where p.preselection_status = 'Nicht geprüft'
       or p.status in ('Neu','In Prüfung')
  )::bigint as offen,
  count(*) filter (
    where not (
      p.preselection_status = 'Nicht geprüft'
       or p.status in ('Neu','In Prüfung')
    )
  )::bigint as geprueft,
  count(*) filter (
    where p.preselection_status in ('Sehr interessant','Potenzial vorhanden')
       or p.status in ('Interessant','Interesse vorhanden','Termin vereinbart')
  )::bigint as interessant
from public.properties p
group by 1, 2;

-- Eindeutig muss der Index sein, sonst verweigert Postgres das
-- Auffrischen im laufenden Betrieb (refresh ... concurrently).
create unique index idx_gemeinde_stats_mv on public.gemeinde_stats_mv (kanton, gemeinde);

-- Ohne Kanton wie bisher alles -- damit bleiben ältere Aufrufe heil.
create or replace function public.gemeinde_stats(p_kanton text default null)
returns table(kanton text, gemeinde text, total bigint, offen bigint,
              geprueft bigint, interessant bigint)
language sql
stable
set search_path to 'public'
as $function$
  select kanton, gemeinde, total, offen, geprueft, interessant
  from public.gemeinde_stats_mv
  where p_kanton is null or kanton = p_kanton
  order by total desc;
$function$;

-- Die alte Fassung ohne Kanton in der Ausgabe würde sonst weiter
-- gefunden: gleicher Name, andere Signatur.
drop function if exists public.gemeinde_stats();

grant execute on function public.gemeinde_stats(text) to anon, authenticated;
grant select on public.gemeinde_stats_mv to anon, authenticated;

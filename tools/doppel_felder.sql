-- Welche Werte stehen sich in den Doppeln gegenüber? Nur Felder ohne
-- Personendaten (Zone, Ausschluss, Vorauswahl). Gemessen am 1. November:
-- Zone widerspricht in 69'945 Paaren, 65'744 Doppel sind ausgeschlossen,
-- ihre Zeile mit EGRID nicht -- das muss man sehen, bevor man entscheidet,
-- welcher Wert gilt. Nach tools/doppel_vorbereiten.sql (braucht paar).
\echo '### Zone: die häufigsten Paare (K mit EGRID | Doppel)'
select left(coalesce(k.zone, '(leer)'), 45) as zone_k, left(coalesce(d.zone, '(leer)'), 45) as zone_doppel, count(*)
from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid
group by 1, 2 order by 3 desc limit 25;

\echo '### Ausschluss: Grund beim Doppel, Zustand bei K'
select d.ausgeschlossen as doppel_aus, k.ausgeschlossen as k_aus, left(coalesce(d.ausschluss_grund, '(leer)'), 60) as grund_doppel,
       left(coalesce(k.ausschluss_grund, '(leer)'), 40) as grund_k, count(*)
from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid
group by 1, 2, 3, 4 order by 5 desc limit 20;

\echo '### Vorauswahl'
select d.preselection_status as doppel, k.preselection_status as k, count(*)
from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid
group by 1, 2 order by 3 desc limit 12;

\echo '### Woher K stammt'
select coalesce(k.source_file, '(leer)') as quelle_k, count(*)
from paar p join public.properties k on k.id = p.kid group by 1 order by 2 desc limit 8;

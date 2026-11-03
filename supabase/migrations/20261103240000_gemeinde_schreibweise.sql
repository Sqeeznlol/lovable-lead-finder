-- =====================================================================
-- Gemeindenamen: eine Schreibweise je Gemeinde
-- =====================================================================
-- Gemessen am 3. November (Ablauf Tempo): 179 Zürcher Parzellen tragen
-- die Gemeinde als "Küsnacht ZH", "Wetzikon ZH" ..., die übrigen
-- derselben Gemeinde "Küsnacht (ZH)" bzw. "Pfäffikon". In der Auswahl
-- stand dieselbe Gemeinde darum zweimal, und die Suche fand nur die
-- eine Hälfte (bis zur Migration 20261103180000).
--
-- Regel wie in src/lib/gemeinden.ts: "X ZH" wird zu "X (ZH)", wenn es
-- das im Bestand gibt, sonst zu "X". Nur diese 179 Zeilen werden
-- geschrieben -- properties ist 454 MB gross, und jede Änderung läuft
-- durch den Potenzial-Auslöser. "(TG)" bleibt: Rickenbach (TG) ist eine
-- andere Gemeinde als Rickenbach (ZH).
--
-- Danach die Gemeindeliste (gemeinde_stats_mv) neu rechnen -- sie
-- stand noch auf dem Stand vor dem 3. November (Aadorf mit 12 Zürcher
-- Parzellen, die es im Bestand nicht mehr gibt). Nicht "concurrently":
-- die Migration läuft in einer Transaktion.
-- =====================================================================

with namen as (
  select distinct gemeinde from public.properties where gemeinde is not null
),
abbildung as (
  select n.gemeinde as alt,
         case when exists (select 1 from namen x where x.gemeinde = regexp_replace(n.gemeinde, '\s+ZH$', '') || ' (ZH)')
              then regexp_replace(n.gemeinde, '\s+ZH$', '') || ' (ZH)'
              else regexp_replace(n.gemeinde, '\s+ZH$', '') end as neu
  from namen n where n.gemeinde ~ '\s+ZH$'
)
update public.properties p set gemeinde = a.neu
from abbildung a where p.gemeinde = a.alt;

refresh materialized view public.gemeinde_stats_mv;

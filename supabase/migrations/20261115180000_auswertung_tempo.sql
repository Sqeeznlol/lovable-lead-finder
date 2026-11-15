-- =====================================================================
-- Auswertung: zwei Abfragen liefen in die Frist
-- =====================================================================
-- Gemessen am 15. November mit dem Ablauf «Reiter prüfen» (echte Seite,
-- echtes Konto): der Reiter «Auswertung» braucht 9.6 Sekunden, und die
-- Datenbank lehnt zwei Abfragen mit 500 ab -- die Zählung der Parzellen
-- mit Eigentümer bzw. Telefon und die Funktion daten_stand.
--
-- Ursache: "wie viele Parzellen haben einen Eigentümer?" liest ohne
-- passenden Index die ganze Tabelle (720 MB), und zwar zweimal zugleich
-- (Eigentümer, Telefon). Das dauert länger als die acht Sekunden, die
-- ein angemeldetes Konto hat, und verdrängt nebenbei den Speicher für
-- daten_stand, das seinerseits vier Tabellen je zweimal ganz las.
--
-- 1. Zwei Teilindizes: sie enthalten nur die Parzellen MIT Eigentümer
--    bzw. Telefon -- wenige tausend Zeilen --, und die Zählung liest
--    nur noch sie.
-- 2. Je ein Index auf die Zeitspalte der drei grossen Tabellen. Damit
--    findet max() den neusten Eintrag, ohne die Tabelle zu lesen, und
--    count(*) zählt über den Index statt über die Tabelle (dafür räumt
--    der Ablauf «Umrisse laden» am Schluss mit VACUUM auf). Die Indizes
--    bleiben klein: beim Laden bekommen Tausende Zeilen denselben
--    Zeitstempel, und gleiche Werte legt Postgres zusammen.
-- 3. daten_stand liest jede Tabelle nur noch einmal.
--
-- Nötig wird das erst recht mit den Zürcher Umrissen: die
-- Nachbarschaft wächst damit von 400'000 auf rund 1.5 Millionen Paare.
-- =====================================================================

create index if not exists idx_properties_mit_eigentuemer
  on public.properties (id) where owner_name is not null;
create index if not exists idx_properties_mit_telefon
  on public.properties (id) where owner_phone is not null;

create index if not exists idx_nachbarschaft_berechnet on public.nachbarschaft (berechnet_am);
create index if not exists idx_gebaeude_geladen        on public.gebaeude (geladen_am);
create index if not exists idx_parzelle_punkt_erfasst  on public.parzelle_punkt (erfasst_am);

create or replace function public.daten_stand()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'gebaeude',        (select max(geladen_am) from gebaeude),
    'gebaeude_n',      (select count(*) from gebaeude),
    'baugesuch',       b.stand,
    'baugesuch_n',     b.n,
    'nachbarschaft',   (select max(berechnet_am) from nachbarschaft),
    'nachbarschaft_n', (select count(*) from nachbarschaft),
    'punkte',          (select max(erfasst_am) from parzelle_punkt),
    'punkte_n',        (select count(*) from parzelle_punkt),
    'potenzial_annahmen', (select max(updated_at) from potenzial_config)
  )
  from (select max(publiziert_am) as stand, count(*) as n from baugesuch) b;
$$;

revoke all on function public.daten_stand() from public, anon;
grant execute on function public.daten_stand() to authenticated;

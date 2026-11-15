-- =====================================================================
-- daten_stand zählt auch die Parzellen mit Gebäude
-- =====================================================================
-- «Reiter prüfen» am 15. November, zweiter Lauf (unter Last, während
-- die Zürcher Umrisse geschrieben wurden): der Reiter «Auswertung»
-- bekommt die Zählung der Sicht parzelle_gebaeude mit 500 abgelehnt.
-- Die Sicht gruppiert bei jedem Aufruf 370'000 Gebäude nach Parzelle
-- und sortiert sie dabei viermal -- nur um ihre Zeilen zu zählen.
--
-- Dieselbe Zahl ist "wie viele verschiedene EGRID stehen in gebaeude",
-- und das liest die Datenbank aus dem Index auf egrid. daten_stand
-- liefert sie darum mit; die Seite fragt die Sicht nicht mehr.
-- =====================================================================

create or replace function public.daten_stand()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'gebaeude',           (select max(geladen_am) from gebaeude),
    'gebaeude_n',         (select count(*) from gebaeude),
    'gebaeude_parzellen', (select count(distinct egrid) from gebaeude where egrid is not null),
    'baugesuch',          b.stand,
    'baugesuch_n',        b.n,
    'nachbarschaft',      (select max(berechnet_am) from nachbarschaft),
    'nachbarschaft_n',    (select count(*) from nachbarschaft),
    'punkte',             (select max(erfasst_am) from parzelle_punkt),
    'punkte_n',           (select count(*) from parzelle_punkt),
    'potenzial_annahmen', (select max(updated_at) from potenzial_config)
  )
  from (select max(publiziert_am) as stand, count(*) as n from baugesuch) b;
$$;

revoke all on function public.daten_stand() from public, anon;
grant execute on function public.daten_stand() to authenticated;

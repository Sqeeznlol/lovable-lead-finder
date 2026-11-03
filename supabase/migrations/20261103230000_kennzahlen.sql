-- =====================================================================
-- Kennzahlen nach Tims Abschnitt 8 -- Ausgangswert, heute, Ziel
-- =====================================================================
-- "Baselines and target values are defined before implementation
-- starts, so that every development stage can be judged on numbers
-- rather than impressions." Die Tabelle in Tims Brief hat acht Zeilen,
-- alle "to define". Hier bekommt jede Kennzahl einen Platz für den
-- Ausgangswert (einmal festgehalten, mit Datum) und das Ziel (von
-- Julian und Tim zu setzen); den heutigen Wert misst die Seite.
--
-- Dazu der Stand der Daten je Quelle (Punkt 21): wann das Register,
-- die Baugesuche, die Nachbarschaften und die Lage zuletzt kamen.
-- Als Funktion, weil max() über properties ohne Index die ganze
-- Tabelle läse -- hier nur die kleinen Tabellen.
-- =====================================================================

create table if not exists public.kennzahl_ziel (
  kennzahl      text primary key,
  ausgangswert  numeric,
  ausgangs_am   date,
  ziel          numeric,
  ziel_bis      date,
  bemerkung     text,
  geaendert_am  timestamptz not null default now()
);

alter table public.kennzahl_ziel enable row level security;
revoke all on public.kennzahl_ziel from anon;
drop policy if exists kennzahl_ziel_angemeldet on public.kennzahl_ziel;
create policy kennzahl_ziel_angemeldet on public.kennzahl_ziel for all to authenticated using (true) with check (true);
grant select, insert, update on public.kennzahl_ziel to authenticated;

create or replace function public.daten_stand()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'gebaeude',      (select max(geladen_am) from gebaeude),
    'gebaeude_n',    (select count(*) from gebaeude),
    'baugesuch',     (select max(publiziert_am) from baugesuch),
    'baugesuch_n',   (select count(*) from baugesuch),
    'nachbarschaft', (select max(berechnet_am) from nachbarschaft),
    'nachbarschaft_n', (select count(*) from nachbarschaft),
    'punkte',        (select max(erfasst_am) from parzelle_punkt),
    'punkte_n',      (select count(*) from parzelle_punkt),
    'potenzial_annahmen', (select max(updated_at) from potenzial_config)
  );
$$;

revoke all on function public.daten_stand() from public, anon;
grant execute on function public.daten_stand() to authenticated;

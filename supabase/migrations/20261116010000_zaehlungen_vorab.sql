-- =====================================================================
-- Die grossen Zählungen einmal vorab, nicht bei jedem Öffnen
-- =====================================================================
-- «Reiter prüfen» vom 16. November, 01:13 UTC, auf der ruhigen
-- Datenbank: bis zum Reiter «Baugesuche» lädt jede Ansicht in zwei
-- Sekunden. «Lead-Listen» braucht 8, «Auswertung» läuft in die 15
-- Sekunden des Tests, und danach steht die Datenbank: die nächsten
-- Reiter bleiben leer, die Anmeldung am zweiten Gerät scheitert, und
-- die Schnittstelle antwortet fünf Minuten lang träge.
--
-- Der Grund liegt in dem, was diese beiden Reiter fragen:
--
--   * «Auswertung» zählt bei jedem Öffnen die Parzellen mit Eigentümer
--     und mit Telefon (zweimal, aus zwei Abschnitten), dazu über
--     daten_stand alle Gebäude, die verschiedenen EGRID der Gebäude,
--     1.2 Millionen Nachbarschaftspaare und eine halbe Million Punkte.
--   * «Lead-Listen» gruppiert bei jedem Öffnen alle Gebäude der Liste
--     nach Gemeinde, nur um die Auswahl zu füllen.
--
-- Diese Zahlen ändern sich nur, wenn Daten geladen werden. Sie werden
-- darum einmal gezählt und abgelegt; die Seite liest die abgelegte
-- Zahl samt dem Zeitpunkt der Zählung. Gezählt wird vom Ablauf
-- «Zählen» (jede Nacht) und am Schluss der Abläufe, die laden.
-- =====================================================================

set local statement_timeout = '10min';

create table if not exists public.daten_zaehlung (
  schluessel  text primary key,
  zahl        bigint,
  stand       timestamptz,
  gezaehlt_am timestamptz not null default now()
);

comment on table public.daten_zaehlung is
  'Zählungen der grossen Tabellen, vorab gerechnet (daten_zaehlen). '
  'Gelesen wird über daten_stand, nicht direkt.';
comment on column public.daten_zaehlung.stand is
  'Jüngstes Datum der Quelle, wo sie eines führt (z.B. wann die Gebäude geladen wurden).';

-- Kein direkter Zugriff: die Seite liest über daten_stand.
alter table public.daten_zaehlung enable row level security;
revoke all on public.daten_zaehlung from public, anon, authenticated;

/**
 * Zählt die grossen Tabellen und legt die Zahlen ab. Die Parzellen in
 * einem Durchgang statt in fünf. Gibt zurück, wie viele Zahlen abgelegt
 * wurden. Rufen dürfen es nur die Abläufe, nicht die Seite.
 */
create or replace function public.daten_zaehlen()
returns int
language sql
security definer
set search_path to 'public'
as $$
  with p as (
    select count(*)                                              as alle,
           count(owner_name)                                     as mit_eigentuemer,
           count(owner_phone)                                    as mit_telefon,
           count(*) filter (where geometrie is not null)         as mit_umriss,
           count(*) filter (where geometrie is not null
                              and nachbarn_stand is not null)    as nachbarn_gerechnet
      from properties
  ), neu (schluessel, zahl, stand) as (
              select 'parzellen',          alle,               null::timestamptz from p
    union all select 'mit_eigentuemer',    mit_eigentuemer,    null from p
    union all select 'mit_telefon',        mit_telefon,        null from p
    union all select 'mit_umriss',         mit_umriss,         null from p
    union all select 'nachbarn_gerechnet', nachbarn_gerechnet, null from p
    union all select 'gebaeude',           count(*),           max(geladen_am)  from gebaeude
    union all select 'gebaeude_parzellen', count(distinct egrid), null          from gebaeude where egrid is not null
    union all select 'nachbarschaft',      count(*),           max(berechnet_am) from nachbarschaft
    union all select 'punkte',             count(*),           max(erfasst_am)   from parzelle_punkt
  ), geschrieben as (
    insert into daten_zaehlung (schluessel, zahl, stand, gezaehlt_am)
    select schluessel, zahl, stand, now() from neu
    on conflict (schluessel) do update
       set zahl = excluded.zahl, stand = excluded.stand, gezaehlt_am = excluded.gezaehlt_am
    returning 1
  )
  select count(*)::int from geschrieben;
$$;

revoke all on function public.daten_zaehlen() from public, anon, authenticated;

/**
 * Was die Seite über den Stand der Daten wissen will. Die grossen
 * Zahlen kommen aus daten_zaehlung; frisch gezählt wird nur, was klein
 * ist (Baugesuche, Annahmen).
 */
create or replace function public.daten_stand()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with z as (select schluessel, zahl, stand, gezaehlt_am from daten_zaehlung)
  select jsonb_build_object(
    'gezaehlt_am',        (select min(gezaehlt_am) from z),
    'parzellen',          (select zahl  from z where schluessel = 'parzellen'),
    'mit_eigentuemer',    (select zahl  from z where schluessel = 'mit_eigentuemer'),
    'mit_telefon',        (select zahl  from z where schluessel = 'mit_telefon'),
    'mit_umriss',         (select zahl  from z where schluessel = 'mit_umriss'),
    'nachbarn_gerechnet', (select zahl  from z where schluessel = 'nachbarn_gerechnet'),
    'gebaeude',           (select stand from z where schluessel = 'gebaeude'),
    'gebaeude_n',         (select zahl  from z where schluessel = 'gebaeude'),
    'gebaeude_parzellen', (select zahl  from z where schluessel = 'gebaeude_parzellen'),
    'baugesuch',          b.stand,
    'baugesuch_n',        b.n,
    'nachbarschaft',      (select stand from z where schluessel = 'nachbarschaft'),
    'nachbarschaft_n',    (select zahl  from z where schluessel = 'nachbarschaft'),
    'punkte',             (select stand from z where schluessel = 'punkte'),
    'punkte_n',           (select zahl  from z where schluessel = 'punkte'),
    'potenzial_annahmen', (select max(updated_at) from potenzial_config)
  )
  from (select max(publiziert_am) as stand, count(*) as n from baugesuch) b;
$$;

revoke all on function public.daten_stand() from public, anon;
grant execute on function public.daten_stand() to authenticated;

-- ---------------------------------------------------------------------
-- Lead-Listen: die Gemeinden mit Anzahl als abgelegte Sicht
-- ---------------------------------------------------------------------
-- lead_gebaeude wird nur vom Ablauf «Lead-Listen» geschrieben, in einem
-- Zug. Danach frischt er diese Sicht auf. Zugriffsregeln kennt eine
-- abgelegte Sicht nicht; lesen darf sie darum nur, wer angemeldet ist
-- -- dasselbe, was die Regel der Tabelle sagt.
do $$ begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'lead_gebaeude_gemeinden') then
    drop view public.lead_gebaeude_gemeinden;
  end if;
end $$;
create materialized view if not exists public.lead_gebaeude_gemeinden as
  select kanton, bfs, gemeinde, count(*)::int as gebaeude
    from public.lead_gebaeude group by 1, 2, 3;
create unique index if not exists idx_lead_gebaeude_gemeinden
  on public.lead_gebaeude_gemeinden (kanton, bfs, gemeinde);
revoke all on public.lead_gebaeude_gemeinden from public, anon;
grant select on public.lead_gebaeude_gemeinden to authenticated;

-- Die Liste selbst: die 200 ältesten eines Kantons und ihre Anzahl.
-- Mit diesem Index liest die Datenbank beides aus dem Index, in der
-- Reihenfolge der Anzeige, statt alle Gebäude des Kantons zu holen und
-- zu sortieren.
create index if not exists idx_lead_gebaeude_liste
  on public.lead_gebaeude (kanton, baujahr nulls first)
  include (bfs, heizung, wohnungen, periode);

-- Einmal zählen, damit die Seite sofort Zahlen hat.
select public.daten_zaehlen();

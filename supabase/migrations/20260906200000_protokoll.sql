-- =====================================================================
-- Wer war da, wann, und was hat er getan
-- =====================================================================
-- Zwei Leute telefonieren, und niemand sieht, wie viel wo getan wurde:
-- wie viele Objekte durchgesehen, wie viele Abfragen gemacht, wie
-- lange gearbeitet. Nicht um jemanden zu überwachen, sondern um zu
-- wissen, woran der Tag verging.
--
-- Festgehalten wird, was die Anwendung ohnehin tut -- Anmeldung,
-- Abfrage, Eigentümer gespeichert, archiviert --, nicht jede
-- Mausbewegung. Aus dem ersten und dem letzten Eintrag eines Tages
-- ergibt sich die Dauer; das genügt und verlangt keine Uhr, die
-- mitläuft.
--
-- Hinweis fürs Geschäft: wer Mitarbeitende erfasst, muss sie darüber
-- informieren. Eine Überwachung des Verhaltens ist in der Schweiz
-- nicht zulässig, eine Auswertung der Arbeit im nötigen Rahmen schon.
-- =====================================================================

create table if not exists public.aktivitaet (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  aktion      text not null,
  gegenstand  text,
  kanton      text,
  zeit        timestamptz not null default now()
);

create index if not exists idx_aktivitaet_zeit on public.aktivitaet (zeit desc);
create index if not exists idx_aktivitaet_user on public.aktivitaet (user_id, zeit desc);

alter table public.aktivitaet enable row level security;

-- Jeder Angemeldete schreibt seine eigenen Einträge; fremde Namen
-- lassen sich nicht eintragen.
drop policy if exists aktivitaet_schreiben on public.aktivitaet;
create policy aktivitaet_schreiben on public.aktivitaet
  for insert to authenticated
  with check (user_id = auth.uid());

-- Gelesen wird von allen Angemeldeten: es sind zwei Leute im selben
-- Betrieb, und der Admin-Bereich ist ohnehin nur einer von ihnen.
drop policy if exists aktivitaet_lesen on public.aktivitaet;
create policy aktivitaet_lesen on public.aktivitaet
  for select to authenticated using (true);

-- Geändert und gelöscht wird nichts: ein Protokoll, das sich ändern
-- lässt, ist keines.

/**
 * Ein Arbeitstag je Person: erster und letzter Eintrag, Dauer, Anzahl.
 */
create or replace function public.arbeitstage(p_tage int default 30)
returns table(
  tag date, email text, user_id uuid,
  von timestamptz, bis timestamptz,
  minuten int, eintraege bigint, abfragen bigint
)
language sql
stable
set search_path to 'public'
as $function$
  select date_trunc('day', zeit)::date              as tag,
         coalesce(email, '(unbekannt)')             as email,
         user_id,
         min(zeit)                                  as von,
         max(zeit)                                  as bis,
         (extract(epoch from max(zeit) - min(zeit)) / 60)::int as minuten,
         count(*)                                   as eintraege,
         count(*) filter (where aktion = 'abfrage')  as abfragen
  from public.aktivitaet
  where zeit > now() - make_interval(days => p_tage)
  group by 1, 2, 3
  order by 1 desc, 4 desc;
$function$;

grant execute on function public.arbeitstage(int) to authenticated;

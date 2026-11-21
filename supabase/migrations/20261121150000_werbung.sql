-- =====================================================================
-- Google Ads: Zahlen je Kampagne und Tag
-- =====================================================================
-- Julian, 21. November: «mache noch einen Tracker dafür, der permanent
-- analysiert, jeden Tag». Die Anzeigen hängen utm_source=google und
-- utm_campaign=<kampagne> an den Link (google-ads-import.csv). Damit zählt
-- check_ereignis die Besuche je Kampagne, und anfrage trägt dieselben
-- Angaben im Lead. Die Kosten kennt nur Google: sie kommen in
-- werbung_kosten, eingetragen von Hand oder später aus dem Konto.
--
-- Gezählt wird nach Schweizer Datum, nicht nach UTC: ein Klick um 00:30
-- gehört zum Tag, an dem ihn der Eigentümer gemacht hat.
-- =====================================================================

create table if not exists public.werbung_kosten (
  tag          date not null,
  kampagne     text not null check (kampagne in ('zone', 'ausnuetzung', 'erbe', 'parzelle', 'bauen', 'ausbau', 'steuer')),
  kosten_chf   numeric not null check (kosten_chf >= 0 and kosten_chf < 10000),
  klicks       integer check (klicks is null or klicks >= 0),
  eingetragen_am timestamptz not null default now(),
  primary key (tag, kampagne)
);
alter table public.werbung_kosten enable row level security;
revoke all on public.werbung_kosten from public, anon, authenticated;
grant select, insert, update, delete on public.werbung_kosten to authenticated;
drop policy if exists werbung_kosten_alle on public.werbung_kosten;
create policy werbung_kosten_alle on public.werbung_kosten for all to authenticated
  using (not public.ist_fondsmanager()) with check (not public.ist_fondsmanager());

create or replace function public.werbung_tage(von date default (now() at time zone 'Europe/Zurich')::date - 30)
returns table (tag date, kampagne text, besuche bigint, ergebnisse bigint, kontakte bigint, leads bigint, kosten_chf numeric, klicks integer)
language sql stable security invoker set search_path = public as $$
  with e as (
    select (zeit at time zone 'Europe/Zurich')::date as tag, lower(kampagne) as kampagne, ereignis, sitzung
    from public.check_ereignis
    where zeit >= (von::timestamp at time zone 'Europe/Zurich') and quelle = 'google' and kampagne is not null
  ), b as (
    select tag, kampagne, count(distinct sitzung) as besuche,
           count(distinct sitzung) filter (where ereignis = 'ergebnis') as ergebnisse,
           count(distinct sitzung) filter (where ereignis = 'kontakt') as kontakte
    from e group by 1, 2
  ), l as (
    -- Testdaten zählen nie (CLAUDE.md).
    select (erstellt_am at time zone 'Europe/Zurich')::date as tag, lower(angaben->>'utm_campaign') as kampagne, count(*) as leads
    from public.anfrage
    where erstellt_am >= (von::timestamp at time zone 'Europe/Zurich') and angaben->>'utm_source' = 'google'
      and angaben->>'utm_campaign' is not null and name !~* 'test'
    group by 1, 2
  ), k as (
    select tag, kampagne, kosten_chf, klicks from public.werbung_kosten where tag >= von
  )
  select coalesce(b.tag, l.tag, k.tag), coalesce(b.kampagne, l.kampagne, k.kampagne),
         coalesce(b.besuche, 0), coalesce(b.ergebnisse, 0), coalesce(b.kontakte, 0), coalesce(l.leads, 0), k.kosten_chf, k.klicks
  from b
  full join l on l.tag = b.tag and l.kampagne = b.kampagne
  full join k on k.tag = coalesce(b.tag, l.tag) and k.kampagne = coalesce(b.kampagne, l.kampagne)
  order by 1, 2;
$$;
revoke all on function public.werbung_tage(date) from public, anon;
grant execute on function public.werbung_tage(date) to authenticated;

-- =====================================================================
-- Google Ads: gute Leads und Suchbegriffe
-- =====================================================================
-- Der Werbeplan entscheidet nach «Kosten pro guten Lead» (unter CHF 150
-- verdoppeln, über 400 stoppen). Gezählt wurden bisher alle Leads; ein
-- Mieter oder ein Makler, der nur nachsieht, hätte die Kampagne billig
-- aussehen lassen. Wer den Lead anruft, markiert ihn darum: «gut» oder
-- «kein guter Lead». Unbeurteilte zählen als gut, bis jemand urteilt,
-- damit eine neue Kampagne nicht schlechter dasteht, nur weil noch
-- niemand angerufen hat.
--
-- Die Anzeigen hängen utm_term={keyword} an (google-ads-import.csv), der
-- Lead trägt ihn in angaben. Daraus zählt werbung_begriffe, welche
-- Suchbegriffe Leads bringen: die Grundlage für «Text oder Suchbegriffe
-- verbessern» am Montag.
-- =====================================================================

alter table public.anfrage add column if not exists guete text
  check (guete is null or guete in ('gut', 'schlecht'));

-- Das Urteil setzt nur, wer angemeldet ist; ein Formular darf es nicht
-- mitschicken.
drop policy if exists anfrage_einreichen on public.anfrage;
create policy anfrage_einreichen on public.anfrage for insert to anon, authenticated
  with check (einwilligung and not bearbeitet and bemerkung is null and guete is null);

-- Neue Spalte im Ergebnis: Postgres ändert den Rückgabetyp nur mit drop.
drop function if exists public.werbung_tage(date);
create function public.werbung_tage(von date default (now() at time zone 'Europe/Zurich')::date - 30)
returns table (tag date, kampagne text, besuche bigint, ergebnisse bigint, kontakte bigint, leads bigint, schlechte bigint, kosten_chf numeric, klicks integer)
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
    select (erstellt_am at time zone 'Europe/Zurich')::date as tag, lower(angaben->>'utm_campaign') as kampagne, count(*) as leads,
           count(*) filter (where guete = 'schlecht') as schlechte
    from public.anfrage
    where erstellt_am >= (von::timestamp at time zone 'Europe/Zurich') and angaben->>'utm_source' = 'google'
      and angaben->>'utm_campaign' is not null and name !~* 'test'
    group by 1, 2
  ), k as (
    select tag, kampagne, kosten_chf, klicks from public.werbung_kosten where tag >= von
  )
  select coalesce(b.tag, l.tag, k.tag), coalesce(b.kampagne, l.kampagne, k.kampagne),
         coalesce(b.besuche, 0), coalesce(b.ergebnisse, 0), coalesce(b.kontakte, 0), coalesce(l.leads, 0), coalesce(l.schlechte, 0), k.kosten_chf, k.klicks
  from b
  full join l on l.tag = b.tag and l.kampagne = b.kampagne
  full join k on k.tag = coalesce(b.tag, l.tag) and k.kampagne = coalesce(b.kampagne, l.kampagne)
  order by 1, 2;
$$;
revoke all on function public.werbung_tage(date) from public, anon;
grant execute on function public.werbung_tage(date) to authenticated;

create or replace function public.werbung_begriffe(von date default (now() at time zone 'Europe/Zurich')::date - 30)
returns table (kampagne text, begriff text, leads bigint, schlechte bigint)
language sql stable security invoker set search_path = public as $$
  select lower(angaben->>'utm_campaign'), lower(trim(angaben->>'utm_term')), count(*), count(*) filter (where guete = 'schlecht')
  from public.anfrage
  where erstellt_am >= (von::timestamp at time zone 'Europe/Zurich') and angaben->>'utm_source' = 'google'
    and angaben->>'utm_campaign' is not null and nullif(trim(angaben->>'utm_term'), '') is not null and name !~* 'test'
  group by 1, 2
  order by 3 desc, 2;
$$;
revoke all on function public.werbung_begriffe(date) from public, anon;
grant execute on function public.werbung_begriffe(date) to authenticated;

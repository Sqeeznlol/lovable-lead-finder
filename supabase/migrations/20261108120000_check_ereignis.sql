-- =====================================================================
-- Klicks auf den Check-Seiten (20 Marken, akquise)
-- =====================================================================
-- Julian, 8. November: "eine Analyse mit den ganzen Stats, wie viel die
-- klicken". Jede Marke schreibt die Schritte ihrer Besucher hierher:
-- Seite geöffnet, Adresse gesucht, Ergebnis gesehen, Rechner geöffnet,
-- Fragen beantwortet, Lead gesendet. So zeigt die Akquise je Marke und
-- Domain, wo Besucher aussteigen.
--
-- Bewusst ohne Personendaten: keine IP, kein Name, keine Adresse. Die
-- Sitzung ist eine Zufallszahl pro Browser-Tab, die nichts mit der
-- Person verbindet. Darum braucht es kein Cookie-Banner.
--
-- Wie bei anfrage darf der öffentliche Schlüssel nur EINFÜGEN, nie
-- lesen. Gelesen wird angemeldet über check_trichter().
-- =====================================================================

create table if not exists public.check_ereignis (
  id        bigserial primary key,
  zeit      timestamptz not null default now(),
  marke     text not null check (marke ~ '^[a-z0-9]{2,40}$'),
  domain    text not null check (length(domain) <= 100),
  ereignis  text not null check (ereignis in (
              'aufruf', 'suche', 'ergebnis', 'rechner', 'kontakt', 'lead',
              'ratgeber', 'ratgeber_klick')),
  sitzung   text not null check (sitzung ~ '^[a-z0-9]{8,40}$'),
  quelle    text check (quelle is null or length(quelle) <= 60),
  kampagne  text check (kampagne is null or length(kampagne) <= 100),
  geraet    text check (geraet is null or geraet in ('handy', 'computer'))
);

create index if not exists idx_check_ereignis_zeit on public.check_ereignis (zeit desc, marke);

alter table public.check_ereignis enable row level security;

drop policy if exists check_ereignis_schreiben on public.check_ereignis;
create policy check_ereignis_schreiben on public.check_ereignis for insert to anon, authenticated
  with check (zeit > now() - interval '1 minute' and zeit < now() + interval '1 minute');

drop policy if exists check_ereignis_lesen on public.check_ereignis;
create policy check_ereignis_lesen on public.check_ereignis for select to authenticated using (true);

grant insert on public.check_ereignis to anon, authenticated;
grant usage on sequence public.check_ereignis_id_seq to anon, authenticated;
grant select on public.check_ereignis to authenticated;

-- Trichter je Marke: wie viele Sitzungen jeden Schritt erreicht haben.
-- Gezählt werden Sitzungen, nicht Klicks: wer zweimal sucht, zählt einmal.
create or replace function public.check_trichter(von timestamptz default now() - interval '30 days')
returns table (marke text, domain text, ereignis text, sitzungen bigint, quelle text)
language sql stable security invoker set search_path = public as $$
  select marke, domain, ereignis, count(distinct sitzung) as sitzungen, coalesce(quelle, 'direkt') as quelle
  from public.check_ereignis
  where zeit >= von
  group by marke, domain, ereignis, coalesce(quelle, 'direkt');
$$;

revoke all on function public.check_trichter(timestamptz) from public, anon;
grant execute on function public.check_trichter(timestamptz) to authenticated;

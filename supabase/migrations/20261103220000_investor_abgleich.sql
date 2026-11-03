-- =====================================================================
-- Off-Market-Mandat aus dem Investorprofil
-- =====================================================================
-- Tims Brief, Abschnitt 11C: "The investor gives us acquisition
-- criteria; Maradona finds candidate properties, enriches them and
-- generates targeted call center campaigns." Und Abschnitt 6: "match
-- relevant properties against investor demand".
--
-- Bisher rechnete der Browser den Abgleich bei jedem Öffnen neu
-- (src/lib/investor.ts) und vergass ihn wieder. Jetzt:
--   1. investor_treffer merkt sich je Profil, welche Parzelle wann
--      gefunden wurde -- "neu seit dem letzten Mal" wird damit messbar.
--   2. investor_abgleich läuft täglich mit den Baugesuchen und auf
--      Knopfdruck, gleicht Lage (Gemeinde, beide Schreibweisen) und
--      Objektart (kategorie) ab. Einen Preis führt der Bestand nicht,
--      das Budget bleibt darum unberücksichtigt -- die Seite sagt das.
--   3. investor_mandat_anlegen macht aus einem Profil ein Mandat: der
--      Investor wird Kunde (produkt 'acquisition'), jeder Kandidat eine
--      Gelegenheit 'investorentreffer' mit der Parzelle als 'kandidat'.
--      Damit läuft die Akquise wie jede andere: Zustand, Zuständigkeit,
--      Ergebnis, Bericht.
-- =====================================================================

create table if not exists public.investor_treffer (
  profil_id    uuid not null references public.investorprofil(id) on delete cascade,
  parzelle_id  uuid not null references public.properties(id) on delete cascade,
  gefunden_am  timestamptz not null default now(),
  gesehen_am   timestamptz,
  primary key (profil_id, parzelle_id)
);
create index if not exists idx_investor_treffer_parzelle on public.investor_treffer (parzelle_id);

alter table public.investor_treffer enable row level security;
revoke all on public.investor_treffer from anon;
drop policy if exists investor_treffer_angemeldet on public.investor_treffer;
create policy investor_treffer_angemeldet on public.investor_treffer for all to authenticated using (true) with check (true);
grant select, update on public.investor_treffer to authenticated;

-- Freitext aus dem Gespräch ("MFH, Bauland") in Werte von kategorie --
-- dieselben Muster wie typenZuKategorien in src/lib/investor.ts.
create or replace function public.investor_kategorien(p_typen text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct v.k), '{}'::text[])
  from unnest(coalesce(p_typen, '{}'::text[])) t
  cross join lateral (values
    (t ~* 'mfh|mehrfam|renditeliegenschaft|wohnhaus mit', 'Mehrfamilienhaus'),
    (t ~* 'efh|einfam', 'Einfamilienhaus'),
    (t ~* 'gewerbe|b(ü|ue)ro|industrie|lager', 'Gebäude ohne Wohnnutzung'),
    (t ~* 'gemischt|wohn.*gesch(ä|ae)ft|teilweise', 'Gebäude mit teilweiser Wohnnutzung'),
    (t ~* 'nebennutzung', 'Wohngebäude mit Nebennutzung')
  ) v(trifft, k)
  where v.trifft;
$$;

-- "zürich", " Kloten " -> wie die Gemeinde im Bestand steht, in beiden
-- Schreibweisen ("Küsnacht (ZH)", "Küsnacht ZH").
create or replace function public.investor_lagen(p_lagen text[])
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(x), '{}'::text[])
  from (
    select distinct unnest(array[n, n || ' (ZH)', n || ' ZH', n || ' (TG)']) as x
    from (select upper(left(trim(l), 1)) || substr(trim(l), 2) as n
          from unnest(coalesce(p_lagen, '{}'::text[])) l where trim(l) <> '') s
  ) u;
$$;

create or replace function public.investor_abgleich(p_schreiben boolean default false, p_profil uuid default null)
returns table (profile int, treffer int, neu int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pr record; n_p int := 0; n_t int := 0; n_neu int := 0; k int;
  lagen text[]; kat text[];
begin
  for pr in select i.id, i.lagen, i.objekttypen from investorprofil i
            where i.aktiv and (p_profil is null or i.id = p_profil)
  loop
    lagen := public.investor_lagen(pr.lagen);
    kat := public.investor_kategorien(pr.objekttypen);
    -- Weder Lage noch Objektart: nichts abgleichbar, nichts erfinden.
    if cardinality(lagen) = 0 and cardinality(kat) = 0 then continue; end if;
    n_p := n_p + 1;
    create temp table if not exists _kand (parzelle_id uuid) on commit drop;
    truncate _kand;
    insert into _kand
    select p.id from properties p
    where coalesce(p.ausgeschlossen, false) = false
      and (cardinality(lagen) = 0 or p.gemeinde = any (lagen))
      and (cardinality(kat) = 0 or p.kategorie = any (kat))
    order by p.marge_chf desc nulls last, p.area desc nulls last
    limit 100;
    select count(*) into k from _kand;
    n_t := n_t + k;
    if p_schreiben then
      insert into investor_treffer (profil_id, parzelle_id)
      select pr.id, parzelle_id from _kand
      on conflict do nothing;
      get diagnostics k = row_count;
      n_neu := n_neu + k;
    end if;
  end loop;
  return query select n_p, n_t, n_neu;
end;
$$;

-- Auf Knopfdruck für ein Profil (die Seite), täglich für alle (Ablauf).
revoke all on function public.investor_abgleich(boolean, uuid) from public, anon;
grant execute on function public.investor_abgleich(boolean, uuid) to authenticated;

create or replace function public.investor_mandat_anlegen(p_profil uuid, p_max int default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pr record; m_id uuid; k record; gid uuid; n_neu int := 0; n_schon int := 0; grund text;
begin
  select i.id, i.akteur_id, a.name, i.lagen, i.objekttypen into pr
  from investorprofil i join akteur a on a.id = i.akteur_id where i.id = p_profil;
  if pr.id is null then raise exception 'Profil nicht gefunden'; end if;

  -- Der Investor als Kunde des Produkts Acquisition -- einmal je Akteur.
  select m.id into m_id from mandant m where m.akteur_id = pr.akteur_id and m.produkt = 'acquisition' order by m.seit limit 1;
  if m_id is null then
    insert into mandant (akteur_id, produkt, bemerkung) values (pr.akteur_id, 'acquisition', 'Off-Market-Mandat aus dem Suchprofil')
    returning id into m_id;
  end if;

  for k in
    select t.parzelle_id, p.address, p.gemeinde, p.kategorie, p.area, p.hnf_delta, p.marge_chf, p.baujahr
    from investor_treffer t join properties p on p.id = t.parzelle_id
    where t.profil_id = p_profil
    order by p.marge_chf desc nulls last, t.gefunden_am desc
    limit greatest(p_max, 1)
  loop
    if exists (select 1 from gelegenheit g join gelegenheit_parzelle gp on gp.gelegenheit_id = g.id
               where g.anlass = 'investorentreffer' and g.mandant_id = m_id and gp.parzelle_id = k.parzelle_id) then
      n_schon := n_schon + 1; continue;
    end if;
    grund := 'Passt zum Suchprofil'
             || coalesce(' (' || nullif(array_to_string(pr.lagen, ', '), '') || coalesce('; ' || nullif(array_to_string(pr.objekttypen, ', '), ''), '') || ')', '')
             || ': ' || coalesce(k.kategorie, 'Objektart unbekannt')
             || coalesce(', ' || replace(to_char(round(k.area), 'FM999G999G999'), ',', '''') || ' m²', '')
             || case when k.hnf_delta >= 200 then ', Reserve ' || replace(to_char(round(k.hnf_delta), 'FM999G999G999'), ',', '''') || ' m² HNF' else '' end
             || coalesce(', Baujahr ' || k.baujahr, '')
             || '. Budget nicht abgeglichen: der Bestand führt keinen Preis.';
    insert into gelegenheit (anlass, mandant_id, zustand, titel, begruendung, prioritaet)
    values ('investorentreffer', m_id, 'erkannt',
            'Kandidat für ' || pr.name || ': ' || coalesce(k.address, '') || coalesce(', ' || k.gemeinde, ''),
            grund, round(coalesce(k.marge_chf, 0) / 1e6, 1))
    returning id into gid;
    insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, k.parzelle_id, 'kandidat');
    n_neu := n_neu + 1;
  end loop;

  return jsonb_build_object('mandant', m_id, 'neu', n_neu, 'schon', n_schon);
end;
$$;

revoke all on function public.investor_mandat_anlegen(uuid, int) from public, anon;
grant execute on function public.investor_mandat_anlegen(uuid, int) to authenticated;

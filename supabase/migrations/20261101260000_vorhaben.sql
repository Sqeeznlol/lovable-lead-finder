-- =====================================================================
-- Vorhaben: die zentrale Anlaufstelle für Kundenprojekte
-- =====================================================================
-- Ein Kunde (Mandant) meldet ein Vorhaben: "1000 Adressen, wir wollen
-- in den nächsten sechs Monaten entwickeln" -- oder kaufen, oder
-- verkaufen. Wir machen daraus Research, eine fertige
-- Potenzialanalyse mit den umliegenden Parzellen und, wenn der Kunde
-- es erlaubt, die Akquise in seinem Namen. Alles off-market.
--
-- Bisher lag das verteilt: Portfolio auf der Karte, Arrondierung
-- unter Gelegenheiten, Investoren in der Auswertung. Das Vorhaben
-- hält zusammen, was zu einem Kundenauftrag gehört, und hat einen
-- Zustand, an dem man sieht, wo er steht.
-- =====================================================================

create table if not exists public.vorhaben (
  id            uuid primary key default gen_random_uuid(),
  mandant_id    uuid not null references public.mandant(id) on delete cascade,
  art           text not null check (art in ('entwickeln', 'kaufen', 'verkaufen')),
  titel         text not null,
  beschreibung  text,
  -- "In den nächsten sechs Monaten": bis wann der Kunde starten will.
  zeitraum_bis  date,
  portfolio_id  uuid references public.portfolio(id) on delete set null,
  zustand       text not null default 'eingegangen'
                check (zustand in ('eingegangen', 'research', 'analyse', 'freigabe',
                                   'akquise', 'abgeschlossen', 'pausiert')),
  -- Darf in seinem Namen angefragt werden? Ohne das keine Akquise:
  -- wer Eigentümer im Namen eines Kunden anspricht, braucht dessen Ja.
  vollmacht_am  date,
  vollmacht_von text,
  -- Für "kaufen": wonach der Kunde sucht -- dieselben Felder wie im
  -- Investorprofil, damit derselbe Abgleich greift.
  lagen         text[],
  objekttypen   text[],
  zustaendig    text,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now()
);

create index if not exists idx_vorhaben_mandant on public.vorhaben (mandant_id);
create index if not exists idx_vorhaben_zustand on public.vorhaben (zustand);

-- Was geschah: jeder Schritt und jede Notiz, mit Zeit und Person.
-- Eine zentrale Anlaufstelle ist nur so gut wie ihr Verlauf.
create table if not exists public.vorhaben_eintrag (
  id           uuid primary key default gen_random_uuid(),
  vorhaben_id  uuid not null references public.vorhaben(id) on delete cascade,
  am           timestamptz not null default now(),
  von          text,
  art          text not null default 'notiz' check (art in ('notiz', 'schritt')),
  text         text not null
);

create index if not exists idx_vorhaben_eintrag on public.vorhaben_eintrag (vorhaben_id, am desc);

-- Gelegenheiten für die Arrondierung werden je Ausloeser-Parzelle
-- gesucht; ohne Index liest die Analyse dafür die ganze Tabelle.
create index if not exists idx_gelegenheit_parzelle_parzelle
  on public.gelegenheit_parzelle (parzelle_id, rolle);
create index if not exists idx_eigentum_parzelle on public.eigentum (parzelle_id);

alter table public.vorhaben         enable row level security;
alter table public.vorhaben_eintrag enable row level security;

-- Dieselbe Regel wie für Portfolio und Gelegenheit: sehen darf, wer
-- den Kunden sehen darf (Team).
drop policy if exists vorhaben_team on public.vorhaben;
create policy vorhaben_team on public.vorhaben for all to authenticated
  using (public.darf_mandant(mandant_id)) with check (public.darf_mandant(mandant_id));

drop policy if exists vorhaben_eintrag_team on public.vorhaben_eintrag;
create policy vorhaben_eintrag_team on public.vorhaben_eintrag for all to authenticated
  using (exists (select 1 from public.vorhaben v where v.id = vorhaben_id and public.darf_mandant(v.mandant_id)))
  with check (exists (select 1 from public.vorhaben v where v.id = vorhaben_id and public.darf_mandant(v.mandant_id)));

-- ---------------------------------------------------------------------
-- Die Potenzialanalyse eines Vorhabens in einer Abfrage.
--
-- Bei 1000 Adressen wären das im Browser Tausende Zeilen und Dutzende
-- Anfragen; hier ist es eine. security invoker: es gelten die Regeln
-- des Aufrufers, die Analyse sieht nichts, was er nicht sehen darf.
--
-- "Netzwerk" heisst: der Eigentümer eines Nachbarn ist uns schon
-- bekannt -- als Kontakt mit Ansprechperson, als Investor, als Kunde
-- oder aus einem Gespräch. Dann kann man sagen: "Der Nachbar ist bei
-- uns im Netzwerk."
-- ---------------------------------------------------------------------
create or replace function public.vorhaben_analyse(p_vorhaben uuid)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
with v as (
  select * from public.vorhaben where id = p_vorhaben
),
pos as (
  select pp.id, pp.zuordnung, pp.roh_adresse, p.id as parzelle_id, p.address, p.gemeinde, p.zone,
         p.kategorie, p.area, p.hnf_delta, p.marge_chf, p.owner_name, p.egrid, p.baujahr
  from v
  join public.portfolio_position pp on pp.portfolio_id = v.portfolio_id
  left join public.properties p on p.id = pp.parzelle_id
),
gel as (
  select distinct g.id, g.fremde_nachbarn, g.zustand, gp.parzelle_id as ausloeser
  from v
  join public.gelegenheit g on g.mandant_id = v.mandant_id and g.anlass = 'arrondierung'
  join public.gelegenheit_parzelle gp on gp.gelegenheit_id = g.id and gp.rolle = 'ausloeser'
  where gp.parzelle_id in (select parzelle_id from pos where parzelle_id is not null)
),
nb as (
  select distinct on (gp.parzelle_id) gp.parzelle_id, gel.ausloeser,
         p.address, p.gemeinde, p.owner_name, p.area, p.marge_chf
  from gel
  join public.gelegenheit_parzelle gp on gp.gelegenheit_id = gel.id and gp.rolle = 'nachbar'
  join public.properties p on p.id = gp.parzelle_id
  -- Ein Nachbar, der selbst im Portfolio liegt, gehört dem Kunden schon.
  where gp.parzelle_id not in (select parzelle_id from pos where parzelle_id is not null)
),
netz as (
  select nb.parzelle_id, nb.address, nb.gemeinde, nb.area, nb.ausloeser, a.id as akteur_id, a.name,
         array_remove(array[
           case when exists (select 1 from public.investorprofil i where i.akteur_id = a.id and i.aktiv) then 'Investor' end,
           case when exists (select 1 from public.mandant m where m.akteur_id = a.id) then 'Kunde' end,
           case when exists (select 1 from public.kontakt k where k.akteur_id = a.id) then 'Kontakt' end,
           case when exists (select 1 from public.anruf r where r.akteur_id = a.id) then 'Gespräch' end
         ], null) as wieso
  from nb
  join public.eigentum e on e.parzelle_id = nb.parzelle_id
  join public.akteur a on a.id = e.akteur_id
)
select jsonb_build_object(
  'adressen',      (select count(*) from pos),
  'zugeordnet',    (select count(*) from pos where parzelle_id is not null),
  'offen',         (select count(*) from pos where parzelle_id is null),
  'flaeche_m2',    (select coalesce(sum(area), 0) from pos),
  'hnf_reserve',   (select coalesce(sum(hnf_delta) filter (where hnf_delta > 0), 0) from pos),
  'mit_reserve',   (select count(*) filter (where hnf_delta > 0) from pos),
  'marge_chf',     (select coalesce(sum(marge_chf) filter (where marge_chf > 0), 0) from pos),
  'zonen',         (select coalesce(jsonb_agg(z order by z.n desc), '[]') from
                     (select coalesce(zone, 'ohne Zone') as zone, count(*) as n from pos
                      where parzelle_id is not null group by 1 order by 2 desc limit 8) z),
  'gemeinden',     (select coalesce(jsonb_agg(z order by z.n desc), '[]') from
                     (select coalesce(gemeinde, '–') as gemeinde, count(*) as n from pos
                      where parzelle_id is not null group by 1 order by 2 desc limit 8) z),
  -- Je Gemeinde und Objektart: daran misst der Browser die Investoren.
  'lage_art',      (select coalesce(jsonb_agg(z), '[]') from
                     (select gemeinde, kategorie, count(*) as n from pos
                      where parzelle_id is not null group by 1, 2) z),
  'arrondierungen', (select count(*) from gel),
  'gepruefte_positionen', (select count(distinct ausloeser) from gel),
  'nachbarn',      (select count(*) from nb),
  'nachbarn_mit_eigentuemer', (select count(*) from nb where nullif(trim(owner_name), '') is not null),
  'nachbarn_ausserhalb', (select coalesce(sum(jsonb_array_length(coalesce(fremde_nachbarn, '[]'::jsonb))), 0) from gel),
  'netzwerk',      (select coalesce(jsonb_agg(n order by n.area desc nulls last), '[]') from
                     (select netz.address, netz.gemeinde, netz.area, netz.name, netz.wieso,
                             (select address from public.properties where id = netz.ausloeser) as neben
                      from netz where cardinality(netz.wieso) > 0 limit 50) n),
  'top',           (select coalesce(jsonb_agg(t), '[]') from
                     (select pos.address, pos.gemeinde, pos.zone, pos.area, pos.hnf_delta, pos.marge_chf, pos.egrid,
                             (select count(*) from nb where nb.ausloeser = pos.parzelle_id) as nachbarn
                      from pos where pos.parzelle_id is not null
                      order by pos.marge_chf desc nulls last limit 15) t)
);
$$;

revoke all on function public.vorhaben_analyse(uuid) from public, anon;
grant execute on function public.vorhaben_analyse(uuid) to authenticated;

-- Die Zentrale zählt Vorhaben je Zustand und zeigt Kunde und Umfang;
-- das in einer Abfrage statt einer je Vorhaben.
create or replace view public.vorhaben_liste
with (security_invoker = true) as
select v.*, a.name as kunde, a.art as kunde_art,
       (select count(*) from public.portfolio_position pp where pp.portfolio_id = v.portfolio_id) as adressen,
       (select max(e.am) from public.vorhaben_eintrag e where e.vorhaben_id = v.id) as letzter_eintrag
from public.vorhaben v
join public.mandant m on m.id = v.mandant_id
join public.akteur a on a.id = m.akteur_id;

grant select on public.vorhaben_liste to authenticated;

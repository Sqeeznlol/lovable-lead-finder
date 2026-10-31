-- =====================================================================
-- Fundament der Plattform: Akteure, Eigentum, Nachbarschaft, Gelegenheit
-- =====================================================================
-- Begründung und Gesamtbild stehen in docs/plattform.md.
--
-- Diese Migration legt das Modell an. Sie zieht nichts um und löscht
-- nichts: `properties` bleibt mit allen 118 Spalten bestehen und trägt
-- weiter die Oberfläche. Die neuen Tabellen stehen daneben und werden
-- schrittweise gefüllt. Ein Umbau in einem Zug bei 396'271 Zeilen und
-- laufendem Telefonbetrieb wäre fahrlässig.
--
-- Zum Zugang: Alles, was Personen oder Kunden betrifft, bekommt hier
-- *keine* Regel für anonyme Zugriffe. Die Anwendung hat seit dem
-- 31. Oktober keine Anmeldung; diese Tabellen bleiben deshalb
-- unlesbar, bis es wieder eine gibt. Das ist Absicht. Ein Portfolio
-- von Helvetica darf nicht auf einer Datenbank liegen, die jeder mit
-- der Adresse der Webseite lesen kann.
-- =====================================================================

-- PostGIS liegt bei Supabase im Schema `extensions`, in einem
-- gewöhnlichen PostgreSQL meist in `public`. Diese Migration legt
-- sich auf keines von beiden fest: sie stellt nur sicher, dass die
-- Erweiterung da ist, und erweitert den Suchpfad. Der erste Lauf des
-- Ablaufs "Modell prüfen" scheiterte an genau dieser Annahme -- ein
-- fest vorangestelltes Schema gibt es nur dort, wo Supabase steht.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
set search_path to public, extensions;

-- Ein Name, ein Schlüssel.
--
-- "Müller" und "Mueller" müssen denselben Schlüssel ergeben, sonst
-- steht derselbe Eigentümer zweimal da -- und beim Einpflegen der
-- vorhandenen Daten zog genau das doppeltes Eigentum nach sich.
-- Deshalb steht die Regel *einmal* hier und wird überall von hier
-- geholt, statt an zwei Stellen abgeschrieben zu werden.
create or replace function public.akteur_norm(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select regexp_replace(
           replace(replace(replace(replace(replace(replace(replace(
             lower(coalesce(p_name, '')),
             'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),
             'é','e'),'è','e'),'à','a'),
           '[^a-z0-9]', '', 'g');
$$;


-- ------------------------------------------------- Parzellengeometrie
-- LV95 (EPSG:2056) ist das amtliche Schweizer Bezugssystem; die
-- Amtliche Vermessung liefert darin. Umrechnen würde bei jeder
-- Nachbarschaftsabfrage Genauigkeit kosten.
alter table public.properties
  add column if not exists geometrie geometry(MultiPolygon, 2056),
  add column if not exists geometrie_quelle text,
  add column if not exists geometrie_stand  timestamptz;

create index if not exists idx_properties_geometrie
  on public.properties using gist (geometrie);

comment on column public.properties.geometrie is
  'Liegenschaftspolygon der Amtlichen Vermessung. Ohne dieses Feld ist '
  'keine Nachbarschaft berechenbar -- und damit weder Arrondierung '
  'noch die Zuordnung von Baugesuchen.';

-- ----------------------------------------------------------- Akteure
-- Ein Akteur, viele Rollen: Swisscanto ist nicht einmal Eigentümer,
-- einmal Kunde und einmal Investor in drei Tabellen, sondern einmal
-- hier. Eigentum, Mandat und Suchprofil hängen als Beziehungen daran.
-- Nur so beantwortet "Zeig mir alles zu Swisscanto" eine Abfrage statt
-- einer Textsuche über vier Spalten.
create table if not exists public.akteur (
  id          uuid primary key default gen_random_uuid(),
  -- 'gemeinschaft' steht für Erbengemeinschaften. Im Bestand stehen
  -- Einträge wie "Steiner Robert Erben" -- das ist keine Person, die
  -- man anruft, sondern eine unbekannte Zahl von Erben. Sie als
  -- Person zu führen hiesse, einen Toten ins Telefonverzeichnis zu
  -- schreiben.
  art         text not null
              check (art in ('person', 'firma', 'institution', 'gemeinschaft')),
  name        text not null,
  -- Für den Abgleich: Umlaute aufgelöst, alles andere weg. "Müller"
  -- und "Mueller" müssen denselben Schlüssel ergeben, sonst steht
  -- derselbe Eigentümer zweimal da.
  name_norm   text generated always as (public.akteur_norm(name)) stored,
  adresse     text,
  plz         text,
  ort         text,
  land        text default 'CH',
  uid         text,                       -- UID-Register, falls bekannt
  bemerkung   text,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);

create index if not exists idx_akteur_name_norm on public.akteur (name_norm);
create index if not exists idx_akteur_art       on public.akteur (art);

create table if not exists public.kontakt (
  id          uuid primary key default gen_random_uuid(),
  akteur_id   uuid not null references public.akteur(id) on delete cascade,
  name        text not null,
  funktion    text,
  telefon     text,
  email       text,
  -- Wer entscheidet, steht selten im Grundbuch. Abschnitt 6 verlangt
  -- es ausdrücklich ("decision-makers").
  entscheider boolean not null default false,
  bemerkung   text,
  erstellt_am timestamptz not null default now()
);

create index if not exists idx_kontakt_akteur on public.kontakt (akteur_id);

-- ---------------------------------------------------------- Eigentum
-- n:m, weil eine Parzelle mehreren gehört und einem Akteur viele.
-- Quelle, Stand und Prüfstatus stehen dabei, weil Abschnitt 4 das
-- verlangt -- und weil eine Eigentümerangabe ohne Herkunft im
-- Verkaufsgespräch nichts wert ist.
create table if not exists public.eigentum (
  id            uuid primary key default gen_random_uuid(),
  parzelle_id   uuid not null references public.properties(id) on delete cascade,
  akteur_id     uuid not null references public.akteur(id)     on delete cascade,
  anteil        text,                     -- "1/2", "1/1" -- wie im Auszug
  art           text,                     -- Allein-, Mit-, Stockwerkeigentum
  quelle        text not null,            -- 'grundbuchauszug', 'portal', 'manuell'
  stand         timestamptz not null default now(),
  geprueft      boolean not null default false,
  geprueft_von  text,
  unique (parzelle_id, akteur_id)
);

create index if not exists idx_eigentum_parzelle on public.eigentum (parzelle_id);
create index if not exists idx_eigentum_akteur   on public.eigentum (akteur_id);

-- Wer bewirtschaftet, ist oft nicht wer besitzt -- und beim Anruf ist
-- die Verwaltung oft der einzige erreichbare Weg.
create table if not exists public.verwaltung (
  id          uuid primary key default gen_random_uuid(),
  parzelle_id uuid not null references public.properties(id) on delete cascade,
  akteur_id   uuid not null references public.akteur(id)     on delete cascade,
  rolle       text,
  seit        date,
  unique (parzelle_id, akteur_id)
);

-- ----------------------------------------- Mandanten und Portfolios
create table if not exists public.mandant (
  id          uuid primary key default gen_random_uuid(),
  akteur_id   uuid not null references public.akteur(id),
  -- Welches Produkt der Kunde bezieht (siehe docs/plattform.md).
  produkt     text check (produkt in ('monitor', 'acquisition', 'intelligence')),
  aktiv       boolean not null default true,
  seit        date not null default current_date,
  bemerkung   text
);

create table if not exists public.portfolio (
  id          uuid primary key default gen_random_uuid(),
  mandant_id  uuid not null references public.mandant(id) on delete cascade,
  name        text not null,
  erstellt_am timestamptz not null default now()
);

create table if not exists public.portfolio_position (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolio(id) on delete cascade,
  parzelle_id   uuid references public.properties(id) on delete set null,
  -- Der Kunde liefert Adressen, nicht EGRID. Was noch nicht zugeordnet
  -- ist, bleibt mit dem Rohtext stehen, statt stillschweigend zu
  -- verschwinden.
  roh_adresse   text,
  zuordnung     text not null default 'offen'
                check (zuordnung in ('offen', 'zugeordnet', 'mehrdeutig', 'nicht gefunden')),
  erstellt_am   timestamptz not null default now()
);

create index if not exists idx_portfolio_position_portfolio
  on public.portfolio_position (portfolio_id);
create index if not exists idx_portfolio_position_parzelle
  on public.portfolio_position (parzelle_id);

-- --------------------------------------------------------- Baugesuche
-- Zürich veröffentlicht sie offen und täglich; der Thurgau erst mit
-- dem elektronischen Amtsblatt ab 2027. Siehe docs/plattform.md.
create table if not exists public.baugesuch (
  id            uuid primary key default gen_random_uuid(),
  quelle        text not null,
  fremd_id      text,                     -- Kennung beim Herausgeber
  publiziert_am date not null,
  kanton        text,
  bfs_nr        text,
  gemeinde      text,
  adresse       text,
  parzelle_nr   text,
  egrid         text,
  bauherrschaft text,
  beschreibung  text,
  kosten_chf    numeric,
  zustand       text not null default 'eingereicht'
                check (zustand in ('eingereicht', 'bewilligt', 'abgelehnt', 'zurueckgezogen')),
  geometrie     geometry(Point, 2056),
  -- Zuordnung mit Herkunft und Sicherheit: ein Gesuch, das der
  -- falschen Parzelle zugeordnet wird, erzeugt eine Meldung über ein
  -- fremdes Grundstück. Genau dieser Fehler ist hier schon einmal
  -- passiert (20260912150000_falsche_zuordnung_gubler.sql).
  parzelle_id   uuid references public.properties(id) on delete set null,
  zuordnung_art text check (zuordnung_art in ('egrid', 'parzellennummer', 'punkt_in_polygon', 'manuell')),
  zuordnung_sicher boolean not null default false,
  erfasst_am    timestamptz not null default now(),
  unique (quelle, fremd_id)
);

create index if not exists idx_baugesuch_datum    on public.baugesuch (publiziert_am desc);
create index if not exists idx_baugesuch_parzelle on public.baugesuch (parzelle_id);
create index if not exists idx_baugesuch_offen    on public.baugesuch (zuordnung_sicher)
  where zuordnung_sicher = false;
create index if not exists idx_baugesuch_geometrie on public.baugesuch using gist (geometrie);

-- ------------------------------------------------------ Nachbarschaft
-- Vorberechnet, nicht bei jeder Anfrage gerechnet: ST_Touches über
-- 400'000 Polygone ist nichts für den Klick eines Benutzers.
create table if not exists public.nachbarschaft (
  parzelle_id   uuid not null references public.properties(id) on delete cascade,
  nachbar_id    uuid not null references public.properties(id) on delete cascade,
  grenzlaenge_m numeric,
  distanz_m     numeric not null default 0,
  berechnet_am  timestamptz not null default now(),
  primary key (parzelle_id, nachbar_id),
  check (parzelle_id <> nachbar_id)
);

create index if not exists idx_nachbarschaft_nachbar on public.nachbarschaft (nachbar_id);

-- --------------------------------------------------------- Gelegenheit
-- Das Herzstück. Eine Meldung, die nur benachrichtigt, ist nach zwei
-- Tagen Rauschen; eine Gelegenheit hat Zustand, Anlass und Ergebnis.
-- Erst dadurch lässt sich einem Kunden am Jahresende zeigen, was das
-- Abonnement gebracht hat.
create table if not exists public.gelegenheit (
  id            uuid primary key default gen_random_uuid(),
  anlass        text not null
                check (anlass in ('baugesuch', 'arrondierung', 'ausnuetzungsreserve',
                                  'zonenaenderung', 'investorentreffer', 'manuell')),
  baugesuch_id  uuid references public.baugesuch(id) on delete set null,
  mandant_id    uuid references public.mandant(id)   on delete set null,
  zustand       text not null default 'erkannt'
                check (zustand in ('erkannt', 'geprueft', 'gemeldet',
                                   'in bearbeitung', 'abgeschlossen', 'verworfen')),
  titel         text not null,
  begruendung   text,
  zustaendig    text,
  erkannt_am    timestamptz not null default now(),
  gemeldet_am   timestamptz,
  abgeschlossen_am timestamptz,
  ergebnis      text
);

create table if not exists public.gelegenheit_parzelle (
  gelegenheit_id uuid not null references public.gelegenheit(id) on delete cascade,
  parzelle_id    uuid not null references public.properties(id)  on delete cascade,
  rolle          text,                    -- 'ausloeser', 'nachbar', 'im portfolio'
  primary key (gelegenheit_id, parzelle_id)
);

create index if not exists idx_gelegenheit_zustand on public.gelegenheit (zustand, erkannt_am desc);
create index if not exists idx_gelegenheit_mandant on public.gelegenheit (mandant_id);

-- --------------------------------------------------------- Gespräche
-- Abschnitt 6: jedes Gespräch erzeugt strukturierte Daten, nicht nur
-- eine Notiz. Was hier nicht als Feld steht, ist später nicht
-- auswertbar.
create table if not exists public.anruf (
  id                uuid primary key default gen_random_uuid(),
  parzelle_id       uuid references public.properties(id) on delete set null,
  akteur_id         uuid references public.akteur(id)     on delete set null,
  kontakt_id        uuid references public.kontakt(id)    on delete set null,
  gefuehrt_am       timestamptz not null default now(),
  gefuehrt_von      text,
  erreicht          boolean,
  verkaufsabsicht   text check (verkaufsabsicht in
                      ('ja', 'spaeter', 'nein', 'nur bei preis', 'unklar')),
  preisvorstellung_chf numeric,
  ablehnungsgrund   text,
  -- Wer nicht verkauft, kauft vielleicht. Abschnitt 6 will genau das
  -- im Gespräch erfassen statt es zu verlieren.
  kauft_selbst      boolean not null default false,
  weitere_objekte   text,
  wiedervorlage_am  date,
  notiz             text
);

create index if not exists idx_anruf_parzelle     on public.anruf (parzelle_id);
create index if not exists idx_anruf_akteur       on public.anruf (akteur_id);
create index if not exists idx_anruf_wiedervorlage on public.anruf (wiedervorlage_am)
  where wiedervorlage_am is not null;

-- ----------------------------------------------------- Investorprofil
create table if not exists public.investorprofil (
  id              uuid primary key default gen_random_uuid(),
  akteur_id       uuid not null references public.akteur(id) on delete cascade,
  lagen           text[],
  objekttypen     text[],
  budget_min_chf  numeric,
  budget_max_chf  numeric,
  rendite_min_pct numeric,
  strategie       text,
  horizont        text,
  kriterien       text,
  aktiv           boolean not null default true,
  erfasst_am      timestamptz not null default now(),
  erfasst_von     text
);

create index if not exists idx_investorprofil_akteur on public.investorprofil (akteur_id);

-- =====================================================================
-- Zugang
-- =====================================================================
-- Amtliche Tatsachen (Baugesuche, Nachbarschaft) dürfen gelesen
-- werden wie die Objekte auch. Alles über Personen, Kunden und
-- Gespräche nicht: diese Tabellen bekommen bewusst *keine* Regel für
-- anonyme Zugriffe und bleiben damit verschlossen, solange es keine
-- Anmeldung gibt.
-- =====================================================================

alter table public.baugesuch    enable row level security;
alter table public.nachbarschaft enable row level security;

drop policy if exists baugesuch_lesen on public.baugesuch;
create policy baugesuch_lesen on public.baugesuch
  for select to anon, authenticated using (true);

drop policy if exists nachbarschaft_lesen on public.nachbarschaft;
create policy nachbarschaft_lesen on public.nachbarschaft
  for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array[
    'akteur', 'kontakt', 'eigentum', 'verwaltung',
    'mandant', 'portfolio', 'portfolio_position',
    'gelegenheit', 'gelegenheit_parzelle', 'anruf', 'investorprofil'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Nur Angemeldete. Da es derzeit niemanden gibt, der angemeldet
    -- wäre, ist das gleichbedeutend mit: verschlossen.
    execute format('drop policy if exists %I on public.%I', t || '_angemeldet', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_angemeldet', t);
  end loop;
end $$;

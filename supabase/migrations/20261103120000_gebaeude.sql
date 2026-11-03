-- =====================================================================
-- Gebäude: jedes bestehende Zürcher Gebäude mit Heizung, Baujahr, Geschossen
-- =====================================================================
-- Für die 3D-Karte (Julian, 3. November: "du siehst, wie hoch es ist,
-- du weisst, wie sie heizen"). Die Gebäude der Karte kommen vom Bund
-- (swissBUILDINGS3D) und tragen ihre EGID -- nachgesehen in einer
-- Kachel über Albisrieden. Über die EGID findet die Karte hier, was das
-- Gebäuderegister über das Haus weiss.
--
-- Gefüllt vom Ablauf "Gebäude" (tools/gwr_gebaeude.py) aus dem
-- öffentlichen Register des BFS. Öffentliche Daten, keine Personen:
-- darum für Angemeldete lesbar, geschrieben nur vom Ablauf.
--
-- Schlank gehalten (die Datenbank hat bei 1107 MB ihre Grenze): nur
-- Zahlen und Codes; die Texte der Codes stehen einmal in gwr_kode.
-- =====================================================================

create table if not exists public.gebaeude (
  egid               bigint primary key,
  egrid              text,
  baujahr            smallint,
  geschosse          smallint,
  wohnungen          smallint,
  grundflaeche       integer,   -- GAREA, m²
  energieflaeche     integer,   -- GEBF, m²
  volumen            integer,   -- GVOL, m³
  kategorie          smallint,  -- GKAT
  klasse             smallint,  -- GKLAS
  heizung            smallint,  -- GWAERZH1, Wärmeerzeuger
  heizung_energie    smallint,  -- GENH1, Energie-/Wärmequelle
  warmwasser_energie smallint,  -- GENW1
  heizung_seit       date,      -- GWAERDATH1, Stand der Angabe
  geladen_am         date not null default current_date
);
create index if not exists idx_gebaeude_egrid on public.gebaeude (egrid);

create table if not exists public.gwr_kode (
  merkmal text not null,
  code    integer not null,
  text    text not null,
  primary key (merkmal, code)
);

alter table public.gebaeude enable row level security;
alter table public.gwr_kode enable row level security;
drop policy if exists gebaeude_lesen on public.gebaeude;
create policy gebaeude_lesen on public.gebaeude for select to authenticated using (true);
drop policy if exists gwr_kode_lesen on public.gwr_kode;
create policy gwr_kode_lesen on public.gwr_kode for select to authenticated using (true);
revoke all on public.gebaeude, public.gwr_kode from anon;
grant select on public.gebaeude, public.gwr_kode to authenticated;

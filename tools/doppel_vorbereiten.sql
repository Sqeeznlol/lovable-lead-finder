-- =====================================================================
-- Doppelte Zürcher Parzellen zusammenführen -- Vorbereitung und Zählung
-- =====================================================================
-- Gemessen am 1. November (Ablauf "Zürcher Parzellen"): 70'160 Zeilen
-- ohne EGRID aus "parzellen-zusammengefuehrt.csv" tragen eine
-- Gebäudenummer (EGID), deren Parzelle laut Gebäuderegister schon mit
-- EGRID im Bestand steht. Dieselbe Parzelle also zweimal.
--
-- Julians Regel (1. November): "doppelt nur löschen wenn es selbe
-- daten sind, sonst gegenseitig ergänzen, eine davon behalten".
--
-- Behalten wird die Zeile mit EGRID (K) -- sie hängt an der amtlichen
-- Parzelle. Vom Doppel (D) kommt herüber, was K fehlt. Widerspricht
-- sich ein Feld, bleibt Ks Wert, und Ds Wert wird in Ks Notiz
-- festgehalten -- verloren geht nichts. Verweise anderer Tabellen auf
-- D werden auf K umgehängt, dann wird D gelöscht.
--
-- Erwartet /tmp/gwr_egid.csv (egid, egrid) aus tools/gwr_zh.py.
-- Ausgegeben werden nur Zählungen und Spaltennamen, keine Werte.
-- =====================================================================
\set ON_ERROR_STOP on
set statement_timeout = '20min';

create temp table gwr_egid (egid text, egrid text);
\copy gwr_egid from '/tmp/gwr_egid.csv' with (format csv)
create index on gwr_egid (egid);
analyze gwr_egid;

create temp table paar as
select distinct on (d.id) d.id as did, k.id as kid
from public.properties d
join gwr_egid m on m.egid = trim(d.gwr_egid)
join public.properties k on k.egrid = m.egrid
where d.kanton = 'ZH' and d.egrid is null and k.id <> d.id
order by d.id;
-- Mehrere Doppel derselben Parzelle (ein Haus je Zeile) kommen ins
-- selbe Stück und werden nacheinander (rang) eingearbeitet -- ein
-- UPDATE mit mehreren passenden Zeilen nähme sonst nur eine davon.
create temp table paar2 as
select did, kid,
       row_number() over (partition by kid order by did) as rang,
       (dense_rank() over (order by kid) - 1) / 10000 as stueck
from paar;
drop table paar;
alter table paar2 rename to paar;
create index on paar (did);
create index on paar (kid);
analyze paar;

-- Spalten einteilen. Was nicht ausdrücklich anders steht, ist "fach"
-- und wird ergänzt bzw. auf Widerspruch geprüft.
--   meta:       Verwaltung der Zeile selbst
--   amtlich:    bei K aus Vermessung und Register -- K gilt
--   abgeleitet: rechnet der Auslöser aus den Eingaben neu
create temp table spalte as
select c.column_name::text as name,
  case
    when c.column_name in ('id', 'egrid', 'created_at', 'updated_at', 'imported_at', 'source_file', 'list_id',
                           'duplicate_flag', 'duplicate_group_id', 'score_input_hash', 'scored_at', 'score_version',
                           'stage_changed_at', 'notes', 'address', 'ortschaftsname') then 'meta'
    -- gwr_egid: mehrere Häuser auf einer Parzelle haben verschiedene
    -- Gebäudenummern -- das ist kein Widerspruch.
    when c.column_name in ('parzelle', 'plot_number', 'bfs_nr', 'area', 'kanton', 'gemeinde', 'bezirk',
                           'gis_url', 'google_maps_url', 'streetview_url', 'housing_stat_url') then 'amtlich'
    -- Gebäudefelder: auf einer Parzelle mit vielen Häusern (bis 195
    -- Doppel je Parzelle, gemessen am 1. November) unterscheiden sie
    -- sich natürlich -- kein Widerspruch. Sie füllen nur Lücken; bei K
    -- stehen die aus dem Register, je Parzelle zusammengefasst.
    when c.column_name in ('baujahr', 'renovationsjahr', 'geschosse', 'vollgeschosse', 'wohnungen', 'gebaeudeflaeche',
                           'nutzflaeche', 'wohnflaeche', 'gebaeudeart', 'geb_status', 'kategorie', 'strassenname',
                           'hausnummer', 'plz', 'plz_ort', 'objektadresse', 'gebaeude_anzahl', 'gvz_nr', 'gwr_egid') then 'gebaeude'
    when c.column_name ~ '^(hnf_|marge_|erloes_|investition_|potenzial_|gf_|reserve_|bebaubar_|score_|ai_)'
      or c.column_name in ('vollgeschosse_zulaessig', 'az_quelle', 'confidence', 'data_quality', 'deal_score',
                           'ausnuetzung', 'anrechenbare_geschosse') then 'abgeleitet'
    else 'fach' end as art
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'properties' and c.is_generated = 'NEVER';

-- Wer auf eine Parzelle verweist -- aus der Datenbank, nicht aus einer
-- Liste: eine vergessene Tabelle verlöre sonst still ihre Verweise.
create temp table verweis as
select c.conrelid::regclass::text as tabelle, a.attname::text as spalte
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.confrelid = 'public.properties'::regclass
  and array_length(c.conkey, 1) = 1;

-- Der Ausdruck, der je Paar die Widersprüche als Text sammelt.
create or replace function pg_temp.widerspruch_sql() returns text language sql as $$
  select 'concat_ws('', '', '
    || string_agg(format($f$case when nullif(k.%1$I::text, '') is not null and nullif(d.%1$I::text, '') is not null
                         and k.%1$I::text <> d.%1$I::text then %1$L || ': ' || d.%1$I::text end$f$, name), ', ')
    || $f$, case when k.address not like 'Parzelle %' and nullif(d.address, '') is not null
            and lower(k.address) <> lower(d.address) then 'weitere Adresse: ' || d.address end)$f$
  from spalte where art = 'fach';
$$;

\echo '### Paare'
select count(*) as doppel, count(distinct kid) as parzellen, max(rang) as hoechstens_doppel_je_parzelle,
       count(distinct stueck) as stuecke
from paar;

\echo '### Wie viele Doppel je Parzelle'
select case when n = 1 then '1' when n <= 3 then '2-3' when n <= 10 then '4-10' else 'mehr als 10' end as doppel_je_parzelle, count(*) as parzellen, sum(n) as doppel
from (select kid, count(*) n from paar group by kid) x group by 1 order by min(n);

\echo '### Je Feld: ergänzbar (K leer, D gefüllt) und Widerspruch (beide gefüllt, verschieden)'
-- Alle Felder in einem Durchgang: je Feld einzeln las der erste
-- Probelauf (1. November) die 70'379 Paare gut hundertmal und lief in
-- die Zeitgrenze von 20 Minuten.
create temp table vergleich (spalte text, ergaenzbar bigint, widerspruch bigint);
do $$
declare q text;
begin
  select format($q$
    insert into vergleich
    select unnest(%s), unnest(array[%s]), unnest(array[%s])
    from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid$q$,
    quote_literal(array_agg(name order by name)::text) || '::text[]',
    string_agg(format($f$count(*) filter (where nullif(k.%1$I::text, '') is null and nullif(d.%1$I::text, '') is not null)$f$, name), ', ' order by name),
    string_agg(format($f$count(*) filter (where nullif(k.%1$I::text, '') is not null and nullif(d.%1$I::text, '') is not null and k.%1$I::text <> d.%1$I::text)$f$, name), ', ' order by name))
  into q from spalte where art in ('fach', 'gebaeude');
  execute q;
  insert into vergleich
  select 'address', count(*) filter (where k.address like 'Parzelle %' and nullif(d.address, '') is not null),
         count(*) filter (where k.address not like 'Parzelle %' and nullif(d.address, '') is not null and lower(k.address) <> lower(d.address))
  from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid;
  insert into vergleich
  select 'notes', count(*) filter (where nullif(k.notes, '') is null and nullif(d.notes, '') is not null),
         count(*) filter (where nullif(k.notes, '') is not null and nullif(d.notes, '') is not null and k.notes <> d.notes)
  from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid;
end $$;
select * from vergleich where ergaenzbar > 0 or widerspruch > 0 order by widerspruch desc, ergaenzbar desc;

\echo '### Paare ohne jeden Widerspruch (reine Doppel)'
do $$
declare n bigint; t bigint;
begin
  execute format('select count(*) filter (where %s = %L), count(*)
                  from paar p join public.properties d on d.id = p.did join public.properties k on k.id = p.kid',
                 pg_temp.widerspruch_sql(), '') into n, t;
  raise notice 'ohne Widerspruch: % von %', n, t;
end $$;

\echo '### Verweise anderer Tabellen auf die Doppel'
create temp table verweise_zahl (tabelle text, spalte text, zeilen bigint);
do $$
declare v record; z bigint;
begin
  for v in select * from verweis loop
    execute format('select count(*) from %s where %I in (select did from paar)', v.tabelle, v.spalte) into z;
    insert into verweise_zahl values (v.tabelle, v.spalte, z);
  end loop;
end $$;
select * from verweise_zahl order by zeilen desc;

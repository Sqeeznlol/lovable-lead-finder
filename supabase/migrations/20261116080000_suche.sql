-- =====================================================================
-- Suche: ein Satz, eine Liste
-- =====================================================================
-- Julian, 16. November: «ein Extra Icon für Suche ... wo ich sagen kann:
-- Alle W2 in Dietikon ... dann wird mir eine komplette Liste gezeigt,
-- links ein Bild der Parzelle, in der Mitte die Strasse, dann Eigentümer
-- ... und rechts die Eckpunkte, also Grösse, Baujahr, Heizung,
-- Stockwerke und was dort noch ein mögliches Potenzial ist, auch BZO,
-- ist das denkmalgeschützt».
--
-- Die Seite versteht den Satz und schickt, was sie verstanden hat, als
-- Filter hierher. Diese Migration bringt drei Funktionen:
--
--   zone_kurz        macht aus dem Zonennamen des Bestands ein Kürzel
--   suche_gemeinden  die Gemeinden des Bestands, damit die Seite sie im
--                    Satz erkennt
--   suche_parzellen  die Liste zu einem Filter
--
-- Warum zone_kurz: «W2» steht nirgends. Gemessen am 16. November
-- (Auswerten «suche-daten») heisst dieselbe Zone in Dietikon «Wohnzone
-- 2/30%», in Uster «Wohnzone 2/40», in Kloten «Wohnzone, 2-geschossig a»
-- und in Frauenfeld «W2a Wohnzone 2a», dazu je Parzelle ein
-- Klammerzusatz mit ihrem Flächenanteil.
--
-- Warum die Suche einen Ort verlangt: ohne Ort müsste die Datenbank
-- alle 530'000 Parzellen lesen, und das verträgt die kleine Instanz
-- nicht (CLAUDE.md, «Die Datenbank bedient die Seite»). Mit Ort liest
-- sie über den Index auf gemeinde oder plz nur dessen Parzellen.
--
-- Es wird nichts geschrieben und kein Index angelegt.
-- =====================================================================

/**
 * Kürzel einer Zone: Art und Geschosse, z.B. W2, WG3, K2, Z5, D, LH2.
 * Ohne Geschosszahl im Namen bleibt die Art allein («Wohnzone 1.6» ist
 * W: die 1.6 ist eine Ziffer, keine Geschosszahl). Leer für alles, was
 * keine Wohn-, Misch-, Kern-, Zentrums- oder Dorfzone ist.
 */
create or replace function public.zone_kurz(p_zone text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  t   text;
  art text;
  n   text;
begin
  if p_zone is null then return null; end if;
  -- Der Klammerzusatz gehört zur Parzelle, nicht zur Zone.
  t := lower(btrim(regexp_replace(regexp_replace(p_zone, '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g')));
  if t = '' then return null; end if;

  if t ~ '(wohn- und gewerbe|wohn- und arbeits|wohnzone mit gewerbe|gewerbeerleichterung|m\. ?g\.? ?erl|wohnzone g ?[0-9])'
     or t ~ '^w[ga][0-9]?[a-z]?( |$)' or t ~ '^w[0-9]g$' then art := 'WG';
  elsif t ~ 'landhauszone' then art := 'LH';
  elsif t ~ 'wohnzone' or t ~ '^w[0-9]?[a-z]?( |$)' then art := 'W';
  elsif t ~ 'kernzone' or t ~ '^k[a-z]?[0-9]?( |$)' then art := 'K';
  elsif t ~ 'zentrumszone' or t ~ '^z[0-9]?( |$)' then art := 'Z';
  elsif t ~ 'dorfzone' or t ~ '^d[0-9]?( |$)' then art := 'D';
  elsif t ~ 'quartiererhaltung' then art := 'Q';
  else return null;
  end if;

  -- Geschosse, in der Reihenfolge der Verlässlichkeit.
  n := (regexp_match(t, '([0-9]+) ?-? ?geschossig'))[1];
  if n is null then
    n := case when t ~ 'eingeschossig' then '1' when t ~ 'zweigeschossig' then '2' when t ~ 'dreigeschossig' then '3'
              when t ~ 'viergeschossig' then '4' when t ~ 'fünfgeschossig' then '5' when t ~ 'sechsgeschossig' then '6' end;
  end if;
  -- «Wohnzone 2/30%», «Wohnzone G3/65%»: Geschosse vor dem Schrägstrich.
  if n is null and art in ('W', 'WG') then n := (regexp_match(t, 'wohnzone g? ?([0-9]) ?/'))[1]; end if;
  -- Kürzel vorn: «w2a wohnzone 2a», «wa3 ...», «d2 dorfzone 2», «ks4 ...», «w3».
  if n is null then n := (regexp_match(t, '^[a-z]{1,2}([0-9])[a-z]?( |$)'))[1]; end if;
  if n is null and t ~ '^w[0-9]g$' then n := substr(t, 2, 1); end if;
  -- «Kernzone 2», «Zentrumszone 5», «Kernzone 3/4», «Kernzone Stadt 4».
  if n is null then n := (regexp_match(t, 'zone (stadt )?([0-9])[a-z]?( ?/ ?[0-9]+ ?%?)?$'))[2]; end if;
  -- Kürzel irgendwo im Namen: «Wohnzone W2», «Zentrumszone Z5».
  if n is null then n := (regexp_match(t, '\m(?:wg|w|k|z|d)([0-9])[a-z]?\M'))[1]; end if;

  return art || coalesce(n, '');
end;
$$;

comment on function public.zone_kurz(text) is
  'Kürzel einer Zone (W2, WG3, K2, Z5, D, LH2) aus dem Namen im Bestand. '
  'Geprüft an den echten Namen von Dietikon, Uster, Kloten und Frauenfeld.';

-- Die Probe steht in der Migration: liefert die Funktion für einen der
-- echten Namen etwas anderes, lässt sie sich nicht einspielen.
do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('Wohnzone 2/30% (rechtskräftig, 612m², 100%)', 'W2'),   -- Dietikon
      ('Wohnzone 3/65%', 'W3'), ('Wohnzone 1/18%', 'W1'), ('Wohnzone 4/80%', 'W4'),
      ('Wohnzone G3/65%', 'WG3'), ('Wohnzone G2/45%', 'WG2'),
      ('Kernzone 2', 'K2'), ('Zentrumszone 5', 'Z5'), ('Quartiererhaltungszone', 'Q'),
      ('Wohnzone 2/40', 'W2'), ('Wohnzone, 3-geschossig /50', 'W3'),            -- Uster
      ('Wohnzone, 4-geschossig, m. G.erl.', 'WG4'), ('Wohnzone, 3-geschossig m. G.erl.', 'WG3'),
      ('Kernzone 3/4', 'K3'), ('Landhauszone', 'LH'), ('Dorfzone', 'D'),
      ('Landhauszone, 2-geschossig', 'LH2'), ('Wohnzone, 2-geschossig a', 'W2'), -- Kloten
      ('Wohn- und Gewerbezone, 4-geschossig', 'WG4'), ('Wohn- und Gewerbezone, 2-geschossig b', 'WG2'),
      ('W2a Wohnzone 2a', 'W2'), ('W3 Wohnzone 3', 'W3'), ('W1 Wohnzone 1', 'W1'), -- Frauenfeld
      ('WA3 Wohn- und Arbeitszone 3', 'WG3'), ('D2 Dorfzone 2', 'D2'),
      ('KA Kernzone Altstadt', 'K'), ('KS4 Kernzone Stadt 4', 'K4'),
      ('W3', 'W3'), ('w4g ', 'WG4'), ('WG3', 'WG3'), ('W3 (3 Vollgeschosse)', 'W3'),
      ('Wohnzone 1.6 (rechtskräftig, 8460m², 95%)', 'W'), ('Wohnzone 2.0', 'W'),
      ('3-geschossige Wohnzone 2.5', 'W3'), ('Wohnzone dreigeschossig 2.7 BMZ', 'W3'),
      ('Wohnzone W2', 'W2'), ('Zentrumszone Z5', 'Z5'),
      -- Keine Zone, in der gewohnt wird.
      ('Kantonale Landwirtschaftszone', null), ('Wald', null), ('Industriezone 4', null),
      ('Gewerbezone 3', null), ('Zone für öffentliche Bauten', null), ('zarchivat', null),
      ('Freihaltezone', null), ('L Landwirtschaftszone', null), ('A Arbeitszone', null),
      ('Aa Arbeitszone a', null), ('Fo Wald', null), ('Reservezone', null), ('', null)
    ) as t(name, soll)
  loop
    if public.zone_kurz(f.name) is distinct from f.soll then
      raise exception 'zone_kurz(%) liefert %, erwartet %', f.name, coalesce(public.zone_kurz(f.name), '(leer)'), coalesce(f.soll, '(leer)');
    end if;
  end loop;
end $$;

/**
 * Die Gemeinden des Bestands mit Kanton und Anzahl Parzellen. Die Seite
 * erkennt damit den Ort im Satz. Gelesen aus der abgelegten Sicht
 * gemeinde_stats_mv, nicht aus den Parzellen.
 */
create or replace function public.suche_gemeinden()
returns table(gemeinde text, kanton text, parzellen int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.gemeinde::text, g.kanton::text, g.total::int
    from gemeinde_stats_mv g
   where g.gemeinde is not null and btrim(g.gemeinde) <> ''
   order by g.total desc;
$$;

revoke all on function public.suche_gemeinden() from public, anon;
grant execute on function public.suche_gemeinden() to authenticated;

/**
 * Die Liste zu einem Filter. Der Filter ist, was die Seite aus dem Satz
 * verstanden hat:
 *
 *   gemeinden, plz        Ort (mindestens eines davon)
 *   zone                  Kürzel wie W2; ohne Zahl (W) alle Geschosse
 *   flaeche_min/_max      m² Grundstück
 *   baujahr_min/_max, geschosse_min/_max, wohnungen_min/_max
 *   heizung               Energieträger als Kodes des Gebäuderegisters
 *   reserve_min           mögliche zusätzliche Hauptnutzfläche in m²
 *   art                   efh | mfh
 *   unbebaut              true: ohne Gebäude
 *   eigentuemer           bekannt | unbekannt
 *   denkmal               mit | ohne
 *   sortierung            potenzial | flaeche | baujahr | adresse
 *
 * Zurück kommen die Anzahl, die Zeilen einer Seite mit Umriss für das
 * Bild, und wie sich die Parzellen des Ortes auf die Zonen verteilen.
 * Gelesen wird mit den Rechten des Angemeldeten.
 */
create or replace function public.suche_parzellen(
  p_filter jsonb,
  p_grenze int default 50,
  p_ab     int default 0
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'extensions'
as $$
declare
  f           jsonb := coalesce(p_filter, '{}'::jsonb);
  v_gemeinden text[];
  v_plz       text[];
  v_heizung   int[];
  -- Nur Buchstaben und Ziffern: das Kürzel geht unten in einen regulären Ausdruck.
  v_zone      text := upper(nullif(regexp_replace(coalesce(f->>'zone', ''), '[^A-Za-z0-9]', '', 'g'), ''));
  v_sort      text := coalesce(nullif(f->>'sortierung', ''), 'potenzial');
  v_grenze    int  := least(greatest(coalesce(p_grenze, 50), 1), 100);
  v_ab        int  := greatest(coalesce(p_ab, 0), 0);
  v_aus       jsonb;
begin
  v_gemeinden := array(select jsonb_array_elements_text(case when jsonb_typeof(f->'gemeinden') = 'array' then f->'gemeinden' else '[]'::jsonb end));
  v_plz       := array(select jsonb_array_elements_text(case when jsonb_typeof(f->'plz') = 'array' then f->'plz' else '[]'::jsonb end));
  v_heizung   := array(select (jsonb_array_elements_text(case when jsonb_typeof(f->'heizung') = 'array' then f->'heizung' else '[]'::jsonb end))::int);

  if cardinality(v_gemeinden) = 0 and cardinality(v_plz) = 0 then
    raise exception 'Die Suche braucht eine Gemeinde oder eine Postleitzahl.' using errcode = '22023';
  end if;
  if cardinality(v_gemeinden) > 12 or cardinality(v_plz) > 12 then
    raise exception 'Höchstens zwölf Orte je Suche.' using errcode = '22023';
  end if;

  with kandidaten as materialized (
    -- Nur die Parzellen des Ortes, über den Index auf gemeinde oder plz.
    select p.id, p.egrid, p.address, p.plz, p.gemeinde, p.plot_number, p.area, p.zone, p.ausnuetzung,
           p.baujahr, p.geschosse, p.wohnungen, p.kategorie, p.hnf_delta, p.owner_name,
           p.denkmalschutz, p.denkmalschutz_titel, p.isos, p.gebaeudeflaeche,
           public.zone_kurz(p.zone) as zk
      from properties p
     where p.gemeinde = any(v_gemeinden) or p.plz = any(v_plz)
  ), treffer as materialized (
    select k.*
      from kandidaten k
     where (v_zone is null or k.zk = v_zone or (v_zone !~ '[0-9]' and k.zk ~ ('^' || v_zone || '[0-9]*$')))
       and ((f->>'flaeche_min')   is null or k.area      >= (f->>'flaeche_min')::numeric)
       and ((f->>'flaeche_max')   is null or k.area      <= (f->>'flaeche_max')::numeric)
       and ((f->>'baujahr_min')   is null or k.baujahr   >= (f->>'baujahr_min')::numeric)
       and ((f->>'baujahr_max')   is null or k.baujahr   <= (f->>'baujahr_max')::numeric)
       and ((f->>'geschosse_min') is null or k.geschosse >= (f->>'geschosse_min')::numeric)
       and ((f->>'geschosse_max') is null or k.geschosse <= (f->>'geschosse_max')::numeric)
       and ((f->>'wohnungen_min') is null or k.wohnungen >= (f->>'wohnungen_min')::numeric)
       and ((f->>'wohnungen_max') is null or k.wohnungen <= (f->>'wohnungen_max')::numeric)
       and ((f->>'reserve_min')   is null or k.hnf_delta >= (f->>'reserve_min')::numeric)
       and ((f->>'art') is null
            or ((f->>'art') = 'efh' and k.kategorie = 'Einfamilienhaus')
            or ((f->>'art') = 'mfh' and k.kategorie = 'Mehrfamilienhaus'))
       -- Ohne Gebäude: keine Gebäudefläche in der Liste und keines im Register.
       and ((f->>'unbebaut') is distinct from 'true'
            or (coalesce(k.gebaeudeflaeche, 0) = 0
                and not exists (select 1 from gebaeude g where g.egrid = k.egrid)))
       and ((f->>'eigentuemer') is null
            or ((f->>'eigentuemer') = 'bekannt'   and nullif(btrim(k.owner_name), '') is not null)
            or ((f->>'eigentuemer') = 'unbekannt' and nullif(btrim(k.owner_name), '') is null))
       -- «nicht vorhanden» ist die Angabe der Liste, dass kein Schutz besteht.
       and ((f->>'denkmal') is null
            or ((f->>'denkmal') = 'mit'  and nullif(btrim(k.denkmalschutz), '') is not null and lower(btrim(k.denkmalschutz)) !~ '^(nicht vorhanden|kein|nein)')
            or ((f->>'denkmal') = 'ohne' and (nullif(btrim(k.denkmalschutz), '') is null or lower(btrim(k.denkmalschutz)) ~ '^(nicht vorhanden|kein|nein)')))
       and (cardinality(v_heizung) = 0
            or exists (select 1 from gebaeude g where g.egrid = k.egrid and g.heizung_energie = any(v_heizung)))
  ), gereiht as (
    select t.*, row_number() over (
             order by case when v_sort = 'potenzial' then t.hnf_delta end desc nulls last,
                      case when v_sort = 'flaeche'   then t.area      end desc nulls last,
                      case when v_sort = 'baujahr'   then t.baujahr   end asc  nulls last,
                      t.address nulls last, t.id) as nr
      from treffer t
  ), seite as (
    select * from gereiht where nr > v_ab and nr <= v_ab + v_grenze
  )
  select jsonb_build_object(
    'anzahl',       (select count(*) from treffer),
    'im_ort',       (select count(*) from kandidaten),
    'ohne_zone',    (select count(*) from kandidaten where nullif(btrim(zone), '') is null),
    'zonen',        coalesce((select jsonb_agg(jsonb_build_object('kurz', z.zk, 'anzahl', z.n) order by z.n desc)
                                from (select zk, count(*) as n from kandidaten where zk is not null group by zk) z), '[]'::jsonb),
    'zeilen',       coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'egrid', s.egrid,
               'adresse', s.address, 'plz', s.plz, 'gemeinde', s.gemeinde, 'parzelle', s.plot_number,
               'flaeche', s.area,
               'zone', nullif(btrim(regexp_replace(regexp_replace(coalesce(s.zone, ''), '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g')), ''),
               'zone_kurz', s.zk, 'az', s.ausnuetzung,
               -- Die Liste zuerst; fehlt die Angabe, das Hauptgebäude aus dem Register.
               'baujahr', coalesce(s.baujahr, hg.baujahr),
               'geschosse', coalesce(s.geschosse, hg.geschosse),
               'wohnungen', coalesce(s.wohnungen, hg.wohnungen),
               'heizung', hg.heizung_energie,
               'art', s.kategorie,
               'reserve', s.hnf_delta,
               'eigentuemer', nullif(btrim(s.owner_name), ''),
               'denkmal', nullif(btrim(s.denkmalschutz), ''), 'denkmal_titel', nullif(btrim(s.denkmalschutz_titel), ''),
               'isos', nullif(btrim(s.isos), ''),
               'rahmen', case when geo.x0 is not null then jsonb_build_array(round(geo.x0::numeric, 1), round(geo.y0::numeric, 1), round(geo.x1::numeric, 1), round(geo.y1::numeric, 1)) end,
               'umriss', geo.umriss
             ) order by s.nr)
        from seite s
        -- Das Hauptgebäude: das mit der grössten Grundfläche.
        left join lateral (
          select g.baujahr, g.geschosse, g.wohnungen, g.heizung_energie
            from gebaeude g
           where g.egrid = s.egrid
           order by g.grundflaeche desc nulls last, g.egid
           limit 1) hg on s.egrid is not null
        -- Der Umriss nur für die Zeilen der Seite: vereinfacht auf 40 cm,
        -- das genügt für ein Bild von 300 Pixeln.
        left join lateral (
          select ST_XMin(pg.geometrie) as x0, ST_YMin(pg.geometrie) as y0,
                 ST_XMax(pg.geometrie) as x1, ST_YMax(pg.geometrie) as y1,
                 -- Ohne Angabe des Koordinatensystems (0): die Seite weiss, dass es LV95 ist.
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(pg.geometrie, 0.4), 1, 0)::jsonb as umriss
            from properties pg
           where pg.id = s.id and pg.geometrie is not null) geo on true), '[]'::jsonb)
  ) into v_aus;

  return v_aus;
end;
$$;

revoke all on function public.suche_parzellen(jsonb, int, int) from public, anon;
grant execute on function public.suche_parzellen(jsonb, int, int) to authenticated;

-- =====================================================================
-- zone_kurz: ein Kürzel vorn zählt nur mit Geschosszahl
-- =====================================================================
-- Auswerten «suche-probe», 16. November, alle Zonennamen von Dietikon,
-- Uster, Kloten und Frauenfeld: 120 von 121 fielen richtig. Falsch war
-- «Wp Waffenplatzzone» (Frauenfeld, 3 Parzellen) -- sie wurde zu «W»,
-- weil ein W mit beliebigem Buchstaben dahinter als Wohnzone galt.
--
-- Jetzt zählt ein Kürzel vorn nur, wenn eine Geschosszahl folgt (W2,
-- W2a, WG3, K2) oder es allein steht (W, WG, K, Z, D). Wohnzonen mit
-- Namen («Wohnzone ...», «Kernzone ...») erkennt der Name wie bisher.
--
-- Die Probe unten enthält alle 49 Namen der ersten Fassung und die
-- Namen der Messung, die dort fehlten.
-- =====================================================================

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
     or t ~ '^wg[0-9]?[a-z]?( |$)' or t ~ '^wa[0-9][a-z]?( |$)' or t ~ '^w[0-9]g$' then art := 'WG';
  elsif t ~ 'landhauszone' then art := 'LH';
  elsif t ~ 'wohnzone' or t ~ '^w[0-9][a-z]?( |$)' or t = 'w' then art := 'W';
  elsif t ~ 'kernzone' or t ~ '^k[0-9]?( |$)' then art := 'K';
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
  'Geprüft an allen Namen von Dietikon, Uster, Kloten und Frauenfeld (16. November).';

do $$
declare
  f record;
begin
  for f in
    select * from (values
      -- Dietikon
      ('Wohnzone 2/30% (rechtskräftig, 612m², 100%)', 'W2'), ('Wohnzone 2/30%', 'W2'), ('Wohnzone 2/45%', 'W2'), ('Wohnzone 2/25%', 'W2'),
      ('Wohnzone 3/65%', 'W3'), ('Wohnzone 1/18%', 'W1'), ('Wohnzone 4/80%', 'W4'),
      ('Wohnzone G3/65%', 'WG3'), ('Wohnzone G2/45%', 'WG2'), ('Wohnzone G4/80%', 'WG4'),
      ('Kernzone 2', 'K2'), ('Kernzone 3', 'K3'), ('Zentrumszone 4', 'Z4'), ('Zentrumszone 5', 'Z5'), ('Quartiererhaltungszone', 'Q'),
      ('Industriezone', null), ('Freihaltezone', null), ('zarchivat', null), ('Kantonale Freihaltezone', null), ('Reservezone', null),
      ('Strassen', null), ('Erholungszone Sport', null), ('Erholungszone G', null), ('Gewässer', null), ('Nicht zonierte Flächen', null),
      -- Uster
      ('Wohnzone 2/40', 'W2'), ('Wohnzone 2/30', 'W2'), ('Wohnzone, 3-geschossig /50', 'W3'), ('Wohnzone, 4-geschossig /70', 'W4'),
      ('Wohnzone, 4-geschossig, m. G.erl.', 'WG4'), ('Wohnzone, 3-geschossig m. G.erl.', 'WG3'), ('Wohnzone, 3-geschossig, m. G.erl.', 'WG3'),
      ('Wohnzone, 2-geschossig, m. G.erl.', 'WG2'), ('Kernzone 3/4', 'K3'), ('Landhauszone', 'LH'), ('Dorfzone', 'D'),
      ('Zentrumszone 3', 'Z3'), ('Industriezone 4', null), ('Gewerbezone 3', null), ('Bahnareal', null), ('Nicht zonierte Fläche', null),
      -- Kloten
      ('Landhauszone, 2-geschossig', 'LH2'), ('Wohnzone, 2-geschossig a', 'W2'), ('Wohnzone, 2-geschossig b', 'W2'), ('Wohnzone, 2-geschossig c', 'W2'),
      ('Wohnzone, 3-geschossig', 'W3'), ('Wohnzone, 4-geschossig', 'W4'), ('Wohnzone, 5-geschossig', 'W5'),
      ('Wohn- und Gewerbezone, 4-geschossig', 'WG4'), ('Wohn- und Gewerbezone, 2-geschossig b', 'WG2'), ('Wohn- und Gewerbezone, 5-geschossig', 'WG5'),
      ('Zone für öffentliche Bauten II', null), ('Industriezone Flughafen', null), ('Erholungszone A', null), ('Gewerbezone', null),
      -- Frauenfeld
      ('W2a Wohnzone 2a', 'W2'), ('W2b Wohnzone 2b', 'W2'), ('W3 Wohnzone 3', 'W3'), ('W1 Wohnzone 1', 'W1'), ('W4 Wohnzone 4', 'W4'),
      ('WA2 Wohn- und Arbeitszone 2', 'WG2'), ('WA3 Wohn- und Arbeitszone 3', 'WG3'), ('WA4 Wohn- und Arbeitszone 4', 'WG4'),
      ('D2 Dorfzone 2', 'D2'), ('KA Kernzone Altstadt', 'K'), ('KV Kernzone Vorstadt', 'K'),
      ('KS3 Kernzone Stadt 3', 'K3'), ('KS4 Kernzone Stadt 4', 'K4'), ('KS5 Kernzone Stadt 5', 'K5'),
      ('Wp Waffenplatzzone', null), ('SZ Sonderbauzone Zoo', null), ('SF Sonderbauzone Familiengärten', null),
      ('StrBg Strasse im Baugebiet', null), ('Cp Campingzone', null), ('Gw Gewässer', null), ('L Landwirtschaftszone', null),
      ('A Arbeitszone', null), ('Aa Arbeitszone a', null), ('Fo Wald', null), ('Oe Zone für öffentliche Bauten und Anlagen', null),
      ('NsW Naturschutzzone im Wald', null), ('FZ Freihaltezone', null), ('BaBg Bahnareal im Baugebiet', null),
      -- Kurzformen aus anderen Listen
      ('W3', 'W3'), ('w4g ', 'WG4'), ('WG3', 'WG3'), ('W3 (3 Vollgeschosse)', 'W3'), ('W', 'W'), ('WG', 'WG'), ('K', 'K'), ('Z', 'Z'),
      ('Wohnzone 1.6 (rechtskräftig, 8460m², 95%)', 'W'), ('Wohnzone 2.0', 'W'),
      ('3-geschossige Wohnzone 2.5', 'W3'), ('Wohnzone dreigeschossig 2.7 BMZ', 'W3'),
      ('Wohnzone W2', 'W2'), ('Zentrumszone Z5', 'Z5'), ('Wohnzone mit Gewerbeerleichterung WG3', 'WG3'),
      ('Kantonale Landwirtschaftszone', null), ('Wald', null), ('Zone für öffentliche Bauten', null), ('', null)
    ) as t(name, soll)
  loop
    if public.zone_kurz(f.name) is distinct from f.soll then
      raise exception 'zone_kurz(%) liefert %, erwartet %', f.name, coalesce(public.zone_kurz(f.name), '(leer)'), coalesce(f.soll, '(leer)');
    end if;
  end loop;
end $$;

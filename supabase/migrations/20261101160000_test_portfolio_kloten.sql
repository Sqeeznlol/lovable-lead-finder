-- =====================================================================
-- Testdaten: ein Portfolio der "Test AG" in Kloten
-- =====================================================================
-- Gewünscht am 1. November: ein Probeportfolio mit 5 bis 10 Parzellen
-- in Kloten, auf der Karte sichtbar samt dem Manager. Damit lässt sich
-- der institutionelle Teil (docs/plattform.md, Abschnitt 1) ansehen,
-- bevor ein echter Kunde ein echtes Portfolio liefert.
--
-- "Test AG" und "Test Immobilien-Management AG" gibt es nicht. Die
-- Parzellen sind echte Parzellen aus dem Bestand -- eine Zuordnung zu
-- einer erfundenen Firma; am Grundstück selbst ändert sich nichts.
-- Jede Zeile trägt den Vermerk TESTDATEN. Wegräumen, alles auf einmal:
--
--   delete from public.akteur where bemerkung like 'TESTDATEN%';
--
-- (Mandant, Portfolio, Positionen und Verwaltung hängen daran und
-- gehen mit -- ausser der Mandant, der zuerst weg muss:
--   delete from public.mandant m using public.akteur a
--    where m.akteur_id = a.id and a.bemerkung like 'TESTDATEN%';)
--
-- Mehrfach einspielen schadet nicht: was schon da ist, wird gefunden.
-- =====================================================================

do $$
declare
  eigner   uuid;
  manager  uuid;
  kunde    uuid;
  mappe    uuid;
  n        int;
begin
  select id into eigner from public.akteur
   where name = 'Test AG' and bemerkung like 'TESTDATEN%';
  if eigner is null then
    insert into public.akteur (art, name, ort, plz, bemerkung)
    values ('firma', 'Test AG', 'Kloten', '8302', 'TESTDATEN -- erfundener Portfolio-Eigner')
    returning id into eigner;
  end if;

  select id into manager from public.akteur
   where name = 'Test Immobilien-Management AG' and bemerkung like 'TESTDATEN%';
  if manager is null then
    insert into public.akteur (art, name, ort, plz, bemerkung)
    values ('firma', 'Test Immobilien-Management AG', 'Zürich', '8001',
            'TESTDATEN -- erfundene Bewirtschafterin des Test-Portfolios')
    returning id into manager;
  end if;

  select id into kunde from public.mandant where akteur_id = eigner;
  if kunde is null then
    insert into public.mandant (akteur_id, produkt, bemerkung)
    values (eigner, 'monitor', 'TESTDATEN')
    returning id into kunde;
  end if;

  select id into mappe from public.portfolio where mandant_id = kunde and name = 'Test AG -- Kloten';
  if mappe is null then
    insert into public.portfolio (mandant_id, name) values (kunde, 'Test AG -- Kloten')
    returning id into mappe;
  end if;

  -- Acht Parzellen: mit EGRID (sonst findet die Karte keinen Umriss),
  -- mit Adresse (sonst steht in der Liste nur eine Nummer), nicht
  -- ausgeschlossen, je Adresse nur eine. Die grössten zuerst -- ein
  -- institutionelles Portfolio besteht nicht aus Garagenplätzen.
  insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
  select mappe, p.id, p.address, 'zugeordnet'
    from (
      select distinct on (lower(address)) id, address, area
        from public.properties
       where gemeinde ilike 'Kloten%'
         and egrid is not null
         and coalesce(address, '') <> ''
         and coalesce(ausgeschlossen, false) = false
       order by lower(address), area desc nulls last
    ) p
   where not exists (select 1 from public.portfolio_position x
                      where x.portfolio_id = mappe and x.parzelle_id = p.id)
   order by p.area desc nulls last
   limit greatest(0, 8 - (select count(*) from public.portfolio_position where portfolio_id = mappe));

  insert into public.verwaltung (parzelle_id, akteur_id, rolle, seit)
  select pp.parzelle_id, manager, 'Bewirtschaftung', current_date
    from public.portfolio_position pp
   where pp.portfolio_id = mappe and pp.parzelle_id is not null
  on conflict (parzelle_id, akteur_id) do nothing;

  select count(*) into n from public.portfolio_position where portfolio_id = mappe;
  raise notice 'Test-Portfolio Kloten: % Positionen', n;
end $$;

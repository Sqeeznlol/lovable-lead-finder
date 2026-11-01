-- =====================================================================
-- Testdaten: Portfolio "Zürich Stadt Test" -- 20 Parzellen in der Stadt
-- =====================================================================
-- Gewünscht am 1. November: 20 zufällige Parzellen in der Stadt Zürich,
-- zusammengefasst als Portfolio und einem erfundenen Eigner zugewiesen.
-- Wie beim Kloten-Portfolio: die Parzellen sind echt, die Firma nicht,
-- jede Zeile trägt TESTDATEN. Wegräumen siehe
-- 20261101160000_test_portfolio_kloten.sql.
--
-- "Zufällig", aber jedes Mal dieselben: sortiert wird nach einer
-- Prüfsumme der Kennung, nicht nach random(). Sonst stünden nach jedem
-- Einspielen andere Parzellen im Portfolio, und niemand könnte sagen,
-- welche gestern gemeint waren.
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
   where name = 'Zürich Stadt Test AG' and bemerkung like 'TESTDATEN%';
  if eigner is null then
    insert into public.akteur (art, name, ort, plz, bemerkung)
    values ('firma', 'Zürich Stadt Test AG', 'Zürich', '8001', 'TESTDATEN -- erfundener Portfolio-Eigner')
    returning id into eigner;
  end if;

  -- Dieselbe erfundene Bewirtschafterin wie in Kloten: so sieht man,
  -- dass ein Manager mehrere Portfolios betreuen kann.
  select id into manager from public.akteur
   where name = 'Test Immobilien-Management AG' and bemerkung like 'TESTDATEN%';
  if manager is null then
    insert into public.akteur (art, name, ort, plz, bemerkung)
    values ('firma', 'Test Immobilien-Management AG', 'Zürich', '8001',
            'TESTDATEN -- erfundene Bewirtschafterin der Test-Portfolios')
    returning id into manager;
  end if;

  select id into kunde from public.mandant where akteur_id = eigner;
  if kunde is null then
    insert into public.mandant (akteur_id, produkt, bemerkung)
    values (eigner, 'monitor', 'TESTDATEN') returning id into kunde;
  end if;

  select id into mappe from public.portfolio where mandant_id = kunde and name = 'Zürich Stadt Test';
  if mappe is null then
    insert into public.portfolio (mandant_id, name) values (kunde, 'Zürich Stadt Test')
    returning id into mappe;
  end if;

  insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
  select mappe, p.id, p.address, 'zugeordnet'
    from (
      select distinct on (lower(address)) id, address
        from public.properties
       where gemeinde in ('Zürich', 'Zuerich', 'Zurich')
         and egrid is not null
         and coalesce(address, '') <> ''
         and coalesce(ausgeschlossen, false) = false
       order by lower(address), id
    ) p
   where not exists (select 1 from public.portfolio_position x
                      where x.portfolio_id = mappe and x.parzelle_id = p.id)
   order by md5(p.id::text)
   limit greatest(0, 20 - (select count(*) from public.portfolio_position where portfolio_id = mappe));

  insert into public.verwaltung (parzelle_id, akteur_id, rolle, seit)
  select pp.parzelle_id, manager, 'Bewirtschaftung', current_date
    from public.portfolio_position pp
   where pp.portfolio_id = mappe and pp.parzelle_id is not null
  on conflict (parzelle_id, akteur_id) do nothing;

  select count(*) into n from public.portfolio_position where portfolio_id = mappe;
  raise notice 'Zürich Stadt Test: % Positionen', n;
  if n = 0 then
    raise exception 'Keine Parzelle in der Stadt Zürich gefunden -- Gemeindename prüfen';
  end if;
end $$;

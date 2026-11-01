-- =====================================================================
-- Wohntraums-Testmaske: eine erfundene Fondsleitung mit sieben Fonds
-- =====================================================================
-- Damit sichtbar wird, wie ein Fondsmanager die Oberfläche erlebt
-- (Julian, 1. November). "Wohntraums Fondsleitung (Demo)" und ihre
-- Immofonds gibt es nicht; die Parzellen sind echte Zürcher Parzellen.
--
-- Auswahl: Baugesuche, zu denen der Bund die Nachbarn geliefert hat
-- (baugesuch.nachbar_egrids). Das Baugrundstück kommt in einen Fonds,
-- zwei seiner Nachbarn in andere -- so liegen Liegenschaften
-- verschiedener Fonds belegbar nebeneinander, und die Nachbarschaft
-- wird gleich mit eingetragen. Bevorzugt Parzellen mit Zone, sonst
-- lässt sich kein Potenzial rechnen.
--
-- Jede Zeile trägt TESTDATEN. Wegräumen:
--   delete from public.mandant m using public.akteur a
--    where m.akteur_id = a.id and a.bemerkung = 'TESTDATEN -- Fonds-Demo';
--   delete from public.akteur where bemerkung = 'TESTDATEN -- Fonds-Demo';
--   delete from public.team where name = 'Wohntraums Fonds';
-- (Die eingetragenen Nachbarschaften sind echte Nachbarschaften und
-- dürfen bleiben.)
-- =====================================================================

do $$
declare
  tid uuid; aid uuid; mid uuid; fonds uuid[] := '{}'; i int; r record; n record; k int; pid uuid;
  namen text[] := array['Immofonds 1 · Wohnen Stadt', 'Immofonds 2 · Wohnen Agglomeration', 'Immofonds 3 · Gemischt',
                        'Immofonds 4 · Gewerbe', 'Immofonds 5 · Entwicklung', 'Immofonds 6 · Nachhaltig', 'Immofonds 7 · Core'];
begin
  select id into tid from public.team where name = 'Wohntraums Fonds';
  if tid is null then
    insert into public.team (name, art) values ('Wohntraums Fonds', 'fonds') returning id into tid;
  end if;

  select id into aid from public.akteur where bemerkung = 'TESTDATEN -- Fonds-Demo';
  if aid is not null then
    raise notice 'Fonds-Demo besteht schon.';
    return;
  end if;
  insert into public.akteur (art, name, ort, bemerkung)
  values ('institution', 'Wohntraums Fondsleitung (Demo)', 'Zürich', 'TESTDATEN -- Fonds-Demo') returning id into aid;
  insert into public.mandant (akteur_id, produkt, bemerkung, team_id)
  values (aid, 'intelligence', 'TESTDATEN', tid) returning id into mid;

  for i in 1 .. 7 loop
    insert into public.portfolio (mandant_id, name) values (mid, namen[i]) returning id into pid;
    fonds := fonds || pid;
  end loop;

  i := 0;
  for r in
    select g.id, g.parzelle_id, g.nachbar_egrids
    from public.baugesuch g join public.properties p on p.id = g.parzelle_id
    where p.kanton = 'ZH' and coalesce(array_length(g.nachbar_egrids, 1), 0) >= 2
      and nullif(trim(p.zone), '') is not null and p.zone <> 'zarchivat'
    order by (coalesce(p.hnf_delta, 0) > 0) desc, md5(g.id::text)
    limit 70
  loop
    if exists (select 1 from public.portfolio_position x where x.parzelle_id = r.parzelle_id and x.portfolio_id = any (fonds)) then
      continue;
    end if;
    insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
    select fonds[(i % 7) + 1], p.id, p.address, 'zugeordnet' from public.properties p where p.id = r.parzelle_id;
    k := 0;
    for n in
      select p.id, p.address from public.properties p
      where p.egrid = any (r.nachbar_egrids) and p.id <> r.parzelle_id
        and not exists (select 1 from public.portfolio_position x where x.parzelle_id = p.id and x.portfolio_id = any (fonds))
      order by (coalesce(p.hnf_delta, 0) > 0) desc, p.area desc nulls last
      limit 2
    loop
      k := k + 1;
      -- Der Nachbar in einen anderen Fonds: genau das soll auffallen.
      insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
      values (fonds[((i + 2 * k) % 7) + 1], n.id, n.address, 'zugeordnet');
      insert into public.nachbarschaft (parzelle_id, nachbar_id) values (r.parzelle_id, n.id), (n.id, r.parzelle_id)
      on conflict do nothing;
    end loop;
    i := i + 1;
  end loop;

  raise notice 'Fonds-Demo: % Baugrundstücke, % Liegenschaften',
    i, (select count(*) from public.portfolio_position where portfolio_id = any (fonds));
end $$;

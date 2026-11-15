-- =====================================================================
-- Erfundene Fonds und Testportfolios entfernen, Helvetica bleibt
-- =====================================================================
-- Julian, 15. November: «entferne alle Fonds, die du gemacht hast, die
-- HL, also Helvetica, die lassen, die ist fix, die habe ich importiert.»
--
-- Weg kommt, was frühere Migrationen erfunden und als TESTDATEN markiert
-- haben (akteur.bemerkung beginnt mit TESTDATEN):
--   20261101160000 Test AG (Kloten), Test Immobilien-Management AG
--   20261101170000 Zürich Stadt Test
--   20261101280000 die 30 Demo-Firmen der Zentrale
--   20261101310000 Wohntraums Fondsleitung (Demo), Team «Wohntraums Fonds»
--   20261101320000 Seeufer Anlagestiftung (Demo), Alpenblick Immobilienfonds (Demo)
-- Die Parzellen selbst sind echt und bleiben; nur die Zuordnung geht.
-- Die eingelesenen Gefässe aus Jahresberichten (fonds_liegenschaft) sind
-- echte, öffentliche Daten und nicht gemeint.
--
-- Sicherung: Helvetica (Mandant der Helvetica Asset Management AG) wird
-- vorher und nachher gezählt; weicht eine Zahl ab, bricht alles ab.
do $$
declare
  vorher text; nachher text;
  n_gel int; n_man int; n_akt int; n_team int;
begin
  select format('%s/%s/%s', count(distinct m.id), count(distinct pf.id), count(pp.id)) into vorher
    from public.mandant m join public.akteur a on a.id = m.akteur_id
    left join public.portfolio pf on pf.mandant_id = m.id left join public.portfolio_position pp on pp.portfolio_id = pf.id
   where a.name = 'Helvetica Asset Management AG';

  -- Gelegenheiten der Demo-Kunden zuerst: sie verlören sonst nur den Bezug.
  delete from public.gelegenheit g using public.mandant m, public.akteur a
   where g.mandant_id = m.id and m.akteur_id = a.id and a.bemerkung like 'TESTDATEN%';
  get diagnostics n_gel = row_count;
  -- Mandanten (mit ihnen Portfolios, Positionen, Vorhaben).
  delete from public.mandant m using public.akteur a
   where m.akteur_id = a.id and a.bemerkung like 'TESTDATEN%';
  get diagnostics n_man = row_count;
  -- Die erfundenen Firmen selbst (Verwaltung und Eigentum hängen daran und gehen mit).
  delete from public.akteur where bemerkung like 'TESTDATEN%';
  get diagnostics n_akt = row_count;
  -- Die Teams der erfundenen Leitungen, sofern kein echter Mandant mehr daran hängt.
  delete from public.team t
   where t.name in ('Wohntraums Fonds', 'Seeufer Anlagestiftung', 'Alpenblick Immobilien')
     and not exists (select 1 from public.mandant m where m.team_id = t.id);
  get diagnostics n_team = row_count;

  select format('%s/%s/%s', count(distinct m.id), count(distinct pf.id), count(pp.id)) into nachher
    from public.mandant m join public.akteur a on a.id = m.akteur_id
    left join public.portfolio pf on pf.mandant_id = m.id left join public.portfolio_position pp on pp.portfolio_id = pf.id
   where a.name = 'Helvetica Asset Management AG';
  if vorher is distinct from nachher or vorher = '0/0/0' then
    raise exception 'Helvetica vorher % nachher %: abgebrochen, nichts gelöscht', vorher, nachher;
  end if;
  raise notice 'Weg: % Gelegenheiten, % Mandanten, % Firmen, % Teams. Helvetica (Mandanten/Portfolios/Positionen): %',
    n_gel, n_man, n_akt, n_team, nachher;
end $$;

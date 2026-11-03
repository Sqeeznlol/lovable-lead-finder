-- Die Gebäude jeder Parzelle, zusammengefasst (Julian, 3. November: "für
-- jede einzelne Parzelle müssen die Informationen nachgetragen werden,
-- damit die Liste von Zürich komplett ist").
--
-- Gemessen am 3. November (Ablauf Tempo): 223'330 der 394'917 Zürcher
-- Parzellen tragen Gebäude im Register; nur 997 Gebäude stehen auf einer
-- Parzelle, die bei uns fehlt. Die übrigen Parzellen sind unbebaut.
--
-- Eine Ansicht, keine Tabelle und kein Nachschreiben in properties:
--   * properties ist 454 MB gross, die Datenbank bei 949 von 1107 MB.
--     223'000 Zeilen dort zu ändern legte jede Zeile vorübergehend doppelt
--     an -- bis zur Schreibsperre.
--   * Die Ansicht ist immer so aktuell wie die Tabelle gebaeude (Ablauf
--     "Gebäude"), ohne zweiten Schritt.
-- Abgefragt wird sie nach egrid; der Filter wirkt in die Gruppierung
-- hinein, und idx_gebaeude_egrid findet die Gebäude der Parzelle.
--
-- Hauptgebäude ist das mit der grössten Grundfläche: sein Baujahr und
-- seine Heizung beschreiben die Parzelle (ein Gartenhaus soll das Bild
-- nicht bestimmen).
--
-- Fossil: Codes 7520 (Gas) und 7530 (Heizöl) -- die Texte stehen so in
-- gwr_kode (Ablauf "Gebäude", Zusammenfassung vom 3. November).

create or replace view public.parzelle_gebaeude
with (security_invoker = true) as
select
  g.egrid,
  count(*)::int                                                        as gebaeude,
  sum(g.wohnungen)::int                                                as wohnungen,
  max(g.geschosse)::int                                                as geschosse_max,
  min(g.baujahr)::int                                                  as baujahr_aeltestes,
  max(g.baujahr)::int                                                  as baujahr_juengstes,
  sum(g.energieflaeche)::int                                           as energieflaeche,
  (array_agg(g.baujahr order by g.grundflaeche desc nulls last))[1]    as haupt_baujahr,
  (array_agg(g.heizung order by g.grundflaeche desc nulls last))[1]    as haupt_heizung,
  (array_agg(g.heizung_energie order by g.grundflaeche desc nulls last))[1] as haupt_heizung_energie,
  (array_agg(g.heizung_seit order by g.grundflaeche desc nulls last))[1]    as haupt_heizung_seit,
  coalesce(bool_or(g.heizung_energie in (7520, 7530)), false)          as fossil
from public.gebaeude g
where g.egrid is not null
group by g.egrid;

revoke all on public.parzelle_gebaeude from anon;
grant select on public.parzelle_gebaeude to authenticated;

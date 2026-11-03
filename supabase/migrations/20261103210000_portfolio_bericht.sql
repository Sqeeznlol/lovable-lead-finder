-- =====================================================================
-- Portfolio-Bericht je Kunde (Portfolio Intelligence)
-- =====================================================================
-- Tims Brief, Abschnitt 11D: "Analyze an existing portfolio for
-- development reserves, possible disposals, neighboring acquisition
-- options and relevant planning changes, delivered as a periodic
-- report with specific recommendations." Und 15: "Institutional
-- reporting -- show clients detected opportunities, running activities
-- and actual results."
--
-- Eine Abfrage liefert alles, was der Bericht zeigt (Punkt 2 der Nacht
-- vom 3. November). Reserven und Marge kommen aus der Potenzialrechnung,
-- Baujahr und Heizung aus dem Register (parzelle_gebaeude), Nachbarn
-- aus nachbarschaft, Baugesuche der letzten zwölf Monate aus baugesuch,
-- Gelegenheiten mit Zustand und Ergebnis.
--
-- Sehen darf ihn, wer den Kunden sehen darf (darf_mandant: Team oder
-- Admin); sonst kommt null. Keine Eigentümernamen der Nachbarn -- nur
-- ob einer bekannt ist. Der Bericht geht an den Kunden, und Namen
-- Dritter gehören nicht hinein (wie in der Potenzialanalyse).
-- =====================================================================

create or replace function public.portfolio_bericht(p_mandant uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
with m as (
  select m.id, a.name, m.produkt, m.seit
  from mandant m join akteur a on a.id = m.akteur_id
  where m.id = p_mandant and public.darf_mandant(m.id)
),
pf as (
  select pf.id, pf.name from portfolio pf join m on m.id = pf.mandant_id
),
pos as (
  select distinct on (pp.parzelle_id) pp.parzelle_id, pp.portfolio_id, pp.zuordnung
  from portfolio_position pp join pf on pf.id = pp.portfolio_id
  where pp.parzelle_id is not null
  order by pp.parzelle_id, pp.portfolio_id
),
offen as (
  select count(*) as n from portfolio_position pp join pf on pf.id = pp.portfolio_id where pp.parzelle_id is null
),
p as (
  select pos.portfolio_id, pr.id, pr.address, pr.gemeinde, pr.zone, pr.area, pr.egrid,
         pr.hnf_delta, pr.reserve_quote, pr.marge_chf, pr.confidence,
         coalesce(pg.haupt_baujahr, pr.baujahr::int) as baujahr, pg.geschosse_max, coalesce(pg.fossil, false) as fossil,
         pg.haupt_heizung_energie, pg.gebaeude, pg.wohnungen
  from pos join properties pr on pr.id = pos.parzelle_id
  left join parzelle_gebaeude pg on pg.egrid = pr.egrid
),
nb as (
  select distinct on (np.id) np.id, np.address, np.gemeinde, np.area, np.hnf_delta, np.marge_chf,
         nullif(trim(np.owner_name), '') is not null as eigentuemer_bekannt, p.address as neben
  from p join nachbarschaft n on n.parzelle_id = p.id join properties np on np.id = n.nachbar_id
  where np.id not in (select id from p) and coalesce(np.ausgeschlossen, false) = false
  order by np.id, np.hnf_delta desc nulls last
),
bau as (
  select g.id, g.publiziert_am, g.adresse, g.gemeinde, left(coalesce(g.beschreibung, ''), 140) as beschreibung,
         bool_or(g.egrid = p.egrid) as im_portfolio, min(p.address) as neben
  from baugesuch g join p on p.egrid is not null and (p.egrid = g.egrid or p.egrid = any (coalesce(g.nachbar_egrids, '{}')))
  where g.publiziert_am > current_date - 365
  group by g.id, g.publiziert_am, g.adresse, g.gemeinde, g.beschreibung
),
gel as (
  select g.id, g.anlass, g.zustand, g.titel, g.erkannt_am, g.gemeldet_am, g.abgeschlossen_am, g.ergebnis, g.prioritaet
  from gelegenheit g join m on m.id = g.mandant_id
)
select case when not exists (select 1 from m) then null else jsonb_build_object(
  'kunde', (select name from m), 'produkt', (select produkt from m), 'seit', (select seit from m),
  'stand', jsonb_build_object(
    'gebaeude', (select max(geladen_am) from gebaeude),
    'baugesuch', (select max(publiziert_am) from baugesuch),
    'potenzial', (select max(scored_at)::date from properties where id in (select id from p))),
  'portfolios', coalesce((select jsonb_agg(jsonb_build_object('id', pf.id, 'name', pf.name,
      'parzellen', (select count(*) from pos where pos.portfolio_id = pf.id)) order by pf.name) from pf), '[]'),
  'parzellen', (select count(*) from p),
  'offen', (select n from offen),
  'flaeche_m2', (select coalesce(sum(area), 0) from p),
  'reserve_hnf', (select coalesce(sum(hnf_delta) filter (where hnf_delta > 0), 0) from p),
  'mit_reserve', (select count(*) filter (where hnf_delta >= 200) from p),
  'ohne_rechnung', (select count(*) filter (where coalesce(confidence, 'keine') = 'keine') from p),
  'marge_chf', (select coalesce(sum(marge_chf) filter (where marge_chf > 0), 0) from p),
  'gebaeude', jsonb_build_object(
    'mit_register', (select count(*) filter (where gebaeude is not null) from p),
    'anzahl', (select coalesce(sum(gebaeude), 0) from p),
    'wohnungen', (select coalesce(sum(wohnungen), 0) from p),
    'baujahr_schnitt', (select round(avg(baujahr)) from p where baujahr is not null),
    'bis_1975', (select count(*) filter (where baujahr <= 1975) from p),
    'fossil', (select count(*) filter (where fossil) from p),
    'heizungen', coalesce((select jsonb_agg(h order by h.n desc) from (
        select coalesce(k.text, 'ohne Angabe') as titel, count(*) as n
        from p left join gwr_kode k on k.merkmal = 'GENH' and k.code = p.haupt_heizung_energie
        where p.gebaeude is not null group by 1) h), '[]')),
  'nachbarn', jsonb_build_object(
    'gesamt', (select count(*) from nb),
    'mit_reserve', (select count(*) filter (where hnf_delta >= 200) from nb),
    'mit_eigentuemer', (select count(*) filter (where eigentuemer_bekannt) from nb)),
  'zukauf', coalesce((select jsonb_agg(z) from (
      select address, gemeinde, area, hnf_delta, marge_chf, eigentuemer_bekannt, neben
      from nb where hnf_delta >= 200 or eigentuemer_bekannt
      order by hnf_delta desc nulls last limit 12) z), '[]'),
  'top_reserve', coalesce((select jsonb_agg(t) from (
      select address, gemeinde, zone, area, hnf_delta, marge_chf, baujahr, fossil, reserve_quote
      from p where hnf_delta > 0 order by marge_chf desc nulls last limit 12) t), '[]'),
  'ersatzneubau', coalesce((select jsonb_agg(e) from (
      select address, gemeinde, baujahr, hnf_delta, reserve_quote, fossil
      from p where hnf_delta >= 200 and baujahr <= extract(year from current_date)::int - 50 and coalesce(reserve_quote, 0) >= 0.4
      order by hnf_delta desc limit 10) e), '[]'),
  'baugesuche', jsonb_build_object(
    'im_portfolio', (select count(*) filter (where im_portfolio) from bau),
    'beim_nachbarn', (select count(*) filter (where not im_portfolio) from bau),
    'liste', coalesce((select jsonb_agg(b order by b.publiziert_am desc) from (
        select publiziert_am, adresse, gemeinde, beschreibung, im_portfolio, neben from bau
        order by publiziert_am desc limit 20) b), '[]')),
  'gelegenheiten', jsonb_build_object(
    'je_zustand', coalesce((select jsonb_agg(jsonb_build_object('zustand', zustand, 'n', n)) from
        (select zustand, count(*) as n from gel group by 1) z), '[]'),
    'je_anlass', coalesce((select jsonb_agg(jsonb_build_object('anlass', anlass, 'n', n)) from
        (select anlass, count(*) as n from gel group by 1) z), '[]'),
    'liste', coalesce((select jsonb_agg(g) from (
        select titel, anlass, zustand, erkannt_am::date as erkannt_am, gemeldet_am::date as gemeldet_am,
               abgeschlossen_am::date as abgeschlossen_am, ergebnis, prioritaet
        from gel
        order by (zustand in ('abgeschlossen', 'verworfen')), prioritaet desc nulls last, erkannt_am desc limit 40) g), '[]'))
) end;
$$;

revoke all on function public.portfolio_bericht(uuid) from public, anon;
grant execute on function public.portfolio_bericht(uuid) to authenticated;

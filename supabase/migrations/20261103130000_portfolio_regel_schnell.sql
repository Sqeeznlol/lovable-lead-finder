-- Die Portfolios luden 2,2 Sekunden im Mittel, bis 7 (pg_stat_statements,
-- Ablauf "Tempo", 3. November: 36 Aufrufe der Abfrage portfolio mit
-- portfolio_position). Grund war die Regel auf portfolio_position: Sie
-- prüfte für jede der 3807 Positionen einzeln, ob ihr Portfolio sichtbar
-- ist -- eine Unterabfrage auf portfolio, die selbst wieder der Regel von
-- portfolio unterliegt, also zweimal darf_mandant() je Zeile, jedes Mal
-- mit has_role, mandant und team_mitglied.
--
-- Jetzt bestimmt die Datenbank die erlaubten Portfolios einmal je Abfrage
-- (eine Unterabfrage ohne Bezug zur Zeile wird nur einmal ausgewertet) und
-- prüft jede Position nur noch gegen diese Menge. Wer was sehen darf,
-- bleibt genau gleich: eine Position, deren Portfolio darf_mandant()
-- erlaubt.

create or replace function public.erlaubte_portfolios()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id from public.portfolio p where public.darf_mandant(p.mandant_id);
$$;

revoke all on function public.erlaubte_portfolios() from public, anon;
grant execute on function public.erlaubte_portfolios() to authenticated;

drop policy if exists portfolio_position_team on public.portfolio_position;
create policy portfolio_position_team on public.portfolio_position for all to authenticated
  using (portfolio_id in (select public.erlaubte_portfolios()))
  with check (portfolio_id in (select public.erlaubte_portfolios()));

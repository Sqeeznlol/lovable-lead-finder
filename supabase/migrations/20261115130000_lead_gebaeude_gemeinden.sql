-- Gemeinden der Lead-Listen mit Anzahl: für die Auswahl in Aurora, ohne
-- alle Gebäude zu laden. Mit den Rechten der Lesenden (nur angemeldet).
create or replace view public.lead_gebaeude_gemeinden with (security_invoker = on) as
  select kanton, bfs, gemeinde, count(*)::int as gebaeude from public.lead_gebaeude group by 1, 2, 3;
revoke all on public.lead_gebaeude_gemeinden from anon;
grant select on public.lead_gebaeude_gemeinden to authenticated;

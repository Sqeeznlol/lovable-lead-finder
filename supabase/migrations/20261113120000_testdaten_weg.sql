-- =====================================================================
-- Testdaten der Landingpages entfernen
-- =====================================================================
-- Julian, 13. November: "nimm die Testdaten raus, auch die Möglichkeit,
-- das anzuzeigen und auszublenden". Gelöscht wird nur, was als Test
-- markiert ist: Leads mit angaben.test oder Quelle "test" (die Test-Leads
-- vom 8. November, Namen mit TEST) und die Aufrufe der Test-Webseiten
-- mit Quelle "test". Echte Anfragen tragen diese Marken nie.
-- =====================================================================

do $$
declare leads int; ereignisse int;
begin
  delete from public.anfrage
  where angaben->>'test' = 'true' or angaben->>'utm_source' = 'test';
  get diagnostics leads = row_count;

  delete from public.check_ereignis where quelle = 'test';
  get diagnostics ereignisse = row_count;

  raise notice 'Testdaten entfernt: % Leads, % Ereignisse', leads, ereignisse;
end $$;

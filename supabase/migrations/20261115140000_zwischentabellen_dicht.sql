-- =====================================================================
-- Zwischentabellen der Datenabläufe: Zeilenschutz an, Rechte weg
-- =====================================================================
-- Der Sicherheitsberater von Supabase meldete am 15. November sechs
-- Tabellen ohne Zeilenschutz. Gemessen (Auswerten «regeln»): anon kam
-- nicht heran, aber jedes angemeldete Konto durfte sie lesen und
-- schreiben, auch Kundenkonten. Die App liest keine davon (grep über
-- src, Funktionen und Akquise); nur die Abläufe brauchen sie, und die
-- verbinden sich als Eigentümer der Tabellen, für den der Zeilenschutz
-- nicht gilt.
do $$
declare t text;
begin
  foreach t in array array['gwr_eingang', 'gwr_gebaeude', 'gwr_kodes', 'schema_migrationen', 'verschnitt_tg', 'zonentypen'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

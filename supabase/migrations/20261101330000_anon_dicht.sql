-- =====================================================================
-- Der öffentliche Schlüssel darf nichts mehr lesen und nichts ändern
-- =====================================================================
-- Sicherheitsprüfung, 1. November: Der anon-Schlüssel steht im
-- öffentlichen Repository (.env) und im Bündel der Seite. Mit ihm
-- liessen sich bisher `properties` (Eigentümer, Telefon, Pipedrive),
-- `phone_numbers`, Protokolle, Listen und Einstellungen lesen, ändern
-- und löschen -- Regeln aus der Lovable-Zeit ("Anon users can ...",
-- "Anyone can ..."), die nie entfernt wurden. Zusammen mit einem
-- eingeschleusten Skript in einer Adresse hätte das für eine Übernahme
-- der Sitzung gereicht.
--
-- Was ohne Anmeldung gebraucht wird (nachgesehen): nur das Einreichen
-- einer Anfrage (/bewertung, /potenzial, /investor -> anfrage, insert).
-- Alles andere liegt hinter dem Torwächter; die Abläufe melden sich
-- seit heute als aui an (tools/anmelden.sh).
--
-- Vorgehen, ohne jede Regel einzeln zu kennen (die Namen stammen aus
-- generierten Migrationen und sind live nicht alle gleich):
--   * Regel nur für anon            -> weg
--   * Regel für anon und andere     -> ohne anon weiter
--   * Regel für "public" (= alle)   -> nur noch für authenticated
--   * Ausnahme: anfrage, einfügen   -> bleibt
-- Dazu die Tabellenrechte von anon entziehen, damit auch eine Tabelle
-- ohne RLS nichts preisgibt, und für künftige Tabellen gleich mit.
-- =====================================================================

do $$
declare r record; rest text[]; n_weg int := 0; n_um int := 0;
begin
  for r in
    select tablename, policyname, roles::text[] as rollen, cmd
    from pg_policies
    where schemaname = 'public' and roles && array['anon', 'public']::name[]
  loop
    if r.tablename = 'anfrage' and r.cmd = 'INSERT' then
      continue;
    end if;
    -- Was übrig bleibt, wenn anon wegfällt; "public" heisst alle, also
    -- auch authenticated.
    rest := array(select case when x = 'public' then 'authenticated' else x end
                  from unnest(r.rollen) x where x <> 'anon');
    rest := array(select distinct x from unnest(rest) x);
    if cardinality(rest) = 0 then
      execute format('drop policy %I on public.%I', r.policyname, r.tablename);
      n_weg := n_weg + 1;
    else
      execute format('alter policy %I on public.%I to %s', r.policyname, r.tablename,
                     (select string_agg(quote_ident(x), ', ') from unnest(rest) x));
      n_um := n_um + 1;
    end if;
  end loop;
  raise notice 'anon-Regeln: % entfernt, % auf Angemeldete beschränkt', n_weg, n_um;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
do $$ begin
  if to_regclass('public.anfrage') is not null then grant insert on public.anfrage to anon; end if;
end $$;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Sichten ohne security_invoker laufen mit den Rechten ihres Eigentümers
-- und umgehen damit die Regeln der Tabellen darunter.
alter view if exists public.eigentuemer_zu_pruefen set (security_invoker = true);
alter view if exists public.nachbarn set (security_invoker = true);

-- Die teure Neuberechnung durfte jeder beliebig oft auslösen.
do $$
begin
  if to_regprocedure('public.refresh_gemeinde_stats()') is not null then
    revoke all on function public.refresh_gemeinde_stats() from public, anon, authenticated;
  end if;
end $$;

-- =====================================================================
-- Eigentümer als Akteure: einmal Swisscanto, mit allen Parzellen
-- =====================================================================
-- Tims Brief, Abschnitt 4: "One owner connects to all relevant
-- properties without duplicating information" und "Search by
-- individual, company or institution". Der Eigentümer steht im
-- Bestand als Text in der Parzellenzeile (owner_name, owner_name_2);
-- die Tabellen akteur und eigentum gibt es seit dem 31. Oktober,
-- gefüllt wurden sie nur aus Gesprächen und Auskünften (gemessen am
-- 3. November: 185 Eigentum-Zeilen, 114 Parzellen mit Eigentümer).
--
-- Diese Funktion verdichtet, was im Text steht, zu Akteuren:
--   * Schlüssel ist akteur_norm(name) -- "Müller" und "Mueller" sind
--     einer, "Swisscanto Anlagestiftung" steht einmal da.
--   * Die Art kommt aus dem Namen: AG, GmbH, SA, Genossenschaft,
--     Stiftung, Pensionskasse, Fonds, Gemeinde, Kanton, Bund, Kirche
--     -> firma/institution; "Erben", "Erbengemeinschaft" -> gemeinschaft;
--     sonst person.
--   * Je Parzelle und Akteur eine Zeile eigentum, quelle 'bestand',
--     stand = letzte Änderung der Parzelle, geprueft = false. Was aus
--     einem Auszug oder Gespräch schon da ist, bleibt unberührt.
-- Idempotent; läuft täglich mit den Baugesuchen. Die Eigentümersuche
-- findet damit über den Akteur alle Parzellen, nicht nur die mit
-- derselben Schreibweise.
-- =====================================================================

create or replace function public.akteur_art_aus_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name ~* '(^|\W)(erben|erbengemeinschaft|erbgemeinschaft|gemeinschaft|miteigentümer)(\W|$)' then 'gemeinschaft'
    when p_name ~* '(^|\W)(gemeinde|stadt|kanton|bund|kirchgemeinde|kirche|pensionskasse|anlagestiftung|stiftung|fonds|versicherung|bank|genossenschaft|immobilien|invest|real estate)(\W|$)'
      then 'institution'
    when p_name ~* '(^|\W)(ag|gmbh|sa|sàrl|sarl|ltd|inc|holding|kg|co)\.?(\W|$)' then 'firma'
    else 'person' end;
$$;

create or replace function public.eigentuemer_verdichten(p_schreiben boolean default false)
returns table (parzellen int, namen int, akteure_neu int, eigentum_neu int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_p int; n_n int; n_a int := 0; n_e int := 0; r record; a_id uuid;
begin
  create temp table if not exists _eig (parzelle_id uuid, name text, norm text, stand timestamptz) on commit drop;
  truncate _eig;
  insert into _eig
  select p.id, trim(x.name), public.akteur_norm(x.name), coalesce(p.updated_at, now())
  from properties p
  cross join lateral (values (p.owner_name), (p.owner_name_2)) x(name)
  where nullif(trim(x.name), '') is not null
    -- Platzhalter aus den alten Listen sind keine Eigentümer.
    and trim(x.name) !~* '^(unbekannt|offen|keine angabe|n/?a|-+)$'
    and length(trim(x.name)) >= 3;

  select count(distinct parzelle_id), count(distinct norm) into n_p, n_n from _eig;

  if p_schreiben then
    for r in select distinct on (norm) norm, name from _eig order by norm, length(name) desc loop
      select id into a_id from akteur where name_norm = r.norm limit 1;
      if a_id is null then
        insert into akteur (art, name, bemerkung) values (public.akteur_art_aus_name(r.name), r.name, 'Aus dem Bestand verdichtet')
        returning id into a_id;
        n_a := n_a + 1;
      end if;
    end loop;
    insert into eigentum (parzelle_id, akteur_id, quelle, stand, geprueft)
    select distinct e.parzelle_id, a.id, 'bestand', e.stand, false
    from _eig e join akteur a on a.name_norm = e.norm
    on conflict (parzelle_id, akteur_id) do nothing;
    get diagnostics n_e = row_count;
  end if;

  return query select n_p, n_n, n_a, n_e;
end;
$$;

revoke all on function public.eigentuemer_verdichten(boolean) from public, anon, authenticated;

-- Alle Parzellen eines Akteurs, für die Eigentümersuche und das
-- Objektfenster ("gehört auch: ..."). Nur für Angemeldete.
create or replace function public.akteur_parzellen(p_akteur uuid)
returns table (parzelle_id uuid, adresse text, gemeinde text, egrid text, area numeric, quelle text, geprueft boolean)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select p.id, p.address, p.gemeinde, p.egrid, p.area, e.quelle, e.geprueft
  from eigentum e join properties p on p.id = e.parzelle_id
  where e.akteur_id = p_akteur
  order by p.gemeinde nulls last, p.address nulls last;
$$;

revoke all on function public.akteur_parzellen(uuid) from public, anon;
grant execute on function public.akteur_parzellen(uuid) to authenticated;

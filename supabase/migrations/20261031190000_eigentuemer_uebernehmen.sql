-- =====================================================================
-- Die vorhandenen Eigentümer ins neue Modell übernehmen
-- =====================================================================
-- Der Bestand trägt die Eigentümer als Text *in* der Parzellenzeile:
-- `owner_name`, `owner_name_2`, `eigentuemer_name` und `owners_json`.
-- Hier werden daraus echte Akteure mit Eigentumsbeziehungen.
--
-- Entworfen an den wirklichen Daten, nicht an gedachten. Am
-- 31. Oktober standen 114 Auskünfte im Bestand, und sie zeigen vier
-- Dinge, die man sonst übersieht:
--
--   "Steiner Robert Erben"       eine Erbengemeinschaft, keine Person
--   "Brunner Werner Emil"   Nachname zuerst, Grundbuch-Schreibweise
--   "Talacker AG", "K + M AG"   Firmen
--   "Erwin Amrein" zweimal      derselbe Mensch, zwei Parzellen
--
-- Zwei Regeln ergeben sich daraus, und beide sind vorsichtig:
--
--   * Eine Erbengemeinschaft wird nicht zur Person. Wer "Erben"
--     anruft, ruft niemanden an.
--   * Personen werden nur zusammengeführt, wenn Name *und*
--     Postleitzahl übereinstimmen. Zwei "Hans Brunner" in zwei
--     Gemeinden sind zwei Menschen. Firmen dagegen über den Namen
--     allein -- sonst stünde dieselbe AG mehrfach da, und genau das
--     soll das Modell ja beenden.
--
-- Die Schreibweise des Namens wird *nicht* umgedreht. Aus
-- "Brunner Werner Emil" automatisch "Werner Emil Brunner" zu
-- machen hiesse raten, welches Wort der Nachname ist -- und ein
-- falsch zusammengelegter Eigentümer ist schlimmer als zwei getrennte.
-- Solche Fälle stehen in `eigentuemer_zu_pruefen` und gehören einem
-- Menschen vorgelegt.
-- =====================================================================

-- Woher ein Akteur stammt und wie sicher die Einstufung ist.
alter table public.akteur
  add column if not exists herkunft       text,
  add column if not exists art_sicher     boolean not null default true,
  add column if not exists name_umgedreht boolean not null default false;

-- ------------------------------------------------- Art eines Namens
-- Reihenfolge ist wichtig: "Erben" schlägt alles, sonst würde
-- "Steiner Ernst Erben" als Person durchgehen.
create or replace function public.akteur_art(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_name ~* '(\merben\M|erbengemeinschaft|erbschaft)'      then 'gemeinschaft'
    when p_name ~* '(kirchgemeinde|kirchgemein|politische gemeinde|\mgemeinde\M|\mkanton\M|\mstadt\M|pensionskasse|anlagestiftung|\mstiftung\M|schulgemeinde|korporation|genossame)'
                                                                   then 'institution'
    when p_name ~* '(\mag\M|\mgmbh\M|\msa\M|\msarl\M|\msagl\M|genossenschaft|\mverein\M|fabrik|immobilien|holding|treuhand|\mkig\M|\bkollektivgesellschaft\b|\bin liquidation\b)'
                                                                   then 'firma'
    else 'person'
  end;
$$;

comment on function public.akteur_art(text) is
  'Schätzt die Art eines Eigentümernamens. Eine Schätzung, kein '
  'Urteil -- was unsicher ist, wird in akteur.art_sicher vermerkt.';

-- Ob der Name vermutlich "Nachname Vorname" geschrieben ist. Nur ein
-- Hinweis für die Nachkontrolle, keine Umstellung.
create or replace function public.akteur_name_umgedreht(p_name text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  -- Im Grundbuch steht oft der Nachname zuerst. Erkennbar ist das
  -- nicht sicher -- "Steiner Robert" und "Robert Steiner" sehen gleich
  -- aus. Markiert wird nur, was drei Wörter hat und mit einem
  -- häufigen Vornamen *endet*: "Brunner Werner Emil".
  select p_name ~* '^\S+\s+\S+\s+\S+$'
     and p_name ~* '\m(emil|ernst|werner|hans|peter|robert|maria|anna|rosa|fritz|walter|otto|paul|karl|josef|heinrich)\M\s*$';
$$;

-- =====================================================================
-- Die Übernahme
-- =====================================================================
create or replace function public.eigentuemer_uebernehmen()
returns table(akteure_neu int, eigentum_neu int, quellzeilen int)
language plpgsql
set search_path to 'public'
as $$
declare
  v_akteure   int := 0;
  v_eigentum  int := 0;
  v_zeilen    int := 0;
begin
  -- Alle Eigentümernennungen aus beiden Quellen in einer Form.
  -- `owners_json` wird bevorzugt: es trägt alle Eigentümer einer
  -- Parzelle, die Textfelder nur die ersten zwei.
  create temporary table if not exists _nennung on commit drop as
  with aus_json as (
    select p.id as parzelle_id,
           nullif(btrim(o.wert ->> 'name'), '')    as name,
           nullif(btrim(o.wert ->> 'address'), '') as adresse,
           nullif(btrim(o.wert ->> 'plz'), '')     as plz,
           nullif(btrim(o.wert ->> 'ort'), '')     as ort,
           nullif(btrim(o.wert ->> 'ownershipType'), '') as art_eigentum,
           'owners_json'::text                     as quelle,
           p.eigentuemer_fetched_at                as stand
    from public.properties p
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p.owners_json::jsonb) = 'array'
           then p.owners_json::jsonb else '[]'::jsonb end) as o(wert)
  ),
  aus_text as (
    -- Nur dort, wo owners_json nichts hergibt -- sonst stünde jeder
    -- Eigentümer zweimal.
    select p.id,
           nullif(btrim(n.name), '') as name,
           nullif(btrim(p.eigentuemer_adresse), '') as adresse,
           split_part(coalesce(p.eigentuemer_plz_ort, ''), ' ', 1) as plz,
           btrim(substr(coalesce(p.eigentuemer_plz_ort, ''),
                        length(split_part(coalesce(p.eigentuemer_plz_ort,''),' ',1)) + 1)) as ort,
           null::text as art_eigentum,
           'owner_name'::text as quelle,
           p.eigentuemer_fetched_at as stand
    from public.properties p
    cross join lateral (values (p.owner_name), (p.owner_name_2)) as n(name)
    where not exists (
      select 1 from aus_json j where j.parzelle_id = p.id
    )
  )
  select * from aus_json where name is not null
  union all
  select * from aus_text where name is not null;

  select count(*) into v_zeilen from _nennung;

  -- ------------------------------------------------------- Akteure
  -- Der Schlüssel unterscheidet nach Art: Firmen über den Namen,
  -- Personen zusätzlich über die Postleitzahl.
  with eingestuft as (
    select distinct on (schluessel)
           schluessel, name, art, adresse, plz, ort
    from (
      select n.name,
             public.akteur_art(n.name) as art,
             n.adresse, n.plz, n.ort,
             -- Der Schlüssel muss derselbe sein, den die Tabelle
             -- später führt -- sonst legt die Übernahme zwei Akteure
             -- an, die die Datenbank für denselben hält, und jede
             -- Nennung hängt sich an beide.
             case when public.akteur_art(n.name) in ('firma', 'institution')
                  then public.akteur_art(n.name) || '|' || public.akteur_norm(n.name)
                  else public.akteur_art(n.name) || '|' || public.akteur_norm(n.name)
                       || '|' || coalesce(n.plz, '')
             end as schluessel
      from _nennung n
    ) x
    order by schluessel, length(coalesce(adresse, '')) desc
  ),
  eingefuegt as (
    insert into public.akteur (art, name, adresse, plz, ort, herkunft,
                               art_sicher, name_umgedreht)
    select e.art, e.name, e.adresse, e.plz, e.ort,
           'uebernahme properties',
           -- Ein einzelnes Wort sagt zu wenig: "Rieder" steht so im
           -- Bestand und kann Person oder Firma sein.
           e.name ~ '\s',
           public.akteur_name_umgedreht(e.name)
    from eingestuft e
    where not exists (
      select 1 from public.akteur a
      where a.name_norm = public.akteur_norm(e.name)
        and (a.art in ('firma', 'institution')
             or coalesce(a.plz, '') = coalesce(e.plz, ''))
    )
    returning 1
  )
  select count(*) into v_akteure from eingefuegt;

  -- ------------------------------------------------------ Eigentum
  with zuordnung as (
    select distinct n.parzelle_id, a.id as akteur_id,
           n.art_eigentum, n.quelle, n.stand
    from _nennung n
    join public.akteur a
      on a.name_norm = public.akteur_norm(n.name)
     and (a.art in ('firma', 'institution')
          or coalesce(a.plz, '') = coalesce(n.plz, ''))
  ),
  eingefuegt as (
    insert into public.eigentum (parzelle_id, akteur_id, art, quelle, stand, geprueft)
    select z.parzelle_id, z.akteur_id, z.art_eigentum,
           'uebernahme ' || z.quelle,
           coalesce(z.stand, now()),
           -- Nichts gilt als geprüft, nur weil es umgezogen wurde.
           false
    from zuordnung z
    on conflict (parzelle_id, akteur_id) do nothing
    returning 1
  )
  select count(*) into v_eigentum from eingefuegt;

  return query select v_akteure, v_eigentum, v_zeilen;
end;
$$;

-- =====================================================================
-- Was ein Mensch nachsehen muss
-- =====================================================================
create or replace view public.eigentuemer_zu_pruefen as
select a.id, a.art, a.name, a.plz, a.ort,
       (select count(*) from public.eigentum e where e.akteur_id = a.id) as parzellen,
       case
         when a.art = 'gemeinschaft'  then 'Erbengemeinschaft -- kein Anruf an eine Person'
         when not a.art_sicher        then 'Einzelnes Wort -- Person oder Firma?'
         when a.name_umgedreht        then 'Vermutlich Nachname zuerst'
         when a.plz is null           then 'Keine Postleitzahl -- Zusammenführung unsicher'
       end as grund
from public.akteur a
where a.herkunft = 'uebernahme properties'
  and (a.art = 'gemeinschaft' or not a.art_sicher
       or a.name_umgedreht or a.plz is null);

comment on view public.eigentuemer_zu_pruefen is
  'Die Fälle, bei denen die Übernahme geraten hätte. Lieber vorlegen '
  'als still falsch zuordnen.';

-- Die Übernahme selbst läuft einmal mit. Sie ist wiederholbar:
-- bestehende Akteure werden nicht doppelt angelegt, bestehendes
-- Eigentum nicht doppelt eingetragen.
select * from public.eigentuemer_uebernehmen();

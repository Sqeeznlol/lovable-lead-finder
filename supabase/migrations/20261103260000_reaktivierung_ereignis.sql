-- =====================================================================
-- Reaktivierung über Ereignisse, nicht über das Datum
-- =====================================================================
-- Tims Brief, Abschnitt 7, "Not selling": "monitor the parcel for
-- permit and planning events, contact again on a trigger rather than
-- on a date." Bisher hatte jede Kategorie der Reaktivierung einen
-- nächsten Schritt mit Datum (Wiedervorlage). Jetzt kommt der Anlass
-- dazu: Wer im Gespräch "nein", "später" oder "nur zum richtigen Preis"
-- gesagt hat, bekommt eine Gelegenheit "Wieder ansprechen", sobald
-- nach dem Gespräch ein Baugesuch auf seiner Parzelle oder nebenan
-- publiziert wird. Der Anruf hat dann einen Grund, den der Eigentümer
-- kennt.
--
-- Je Parzelle und Gesuch eine Gelegenheit (anlass 'baugesuch', ohne
-- Kunde, Rolle 'ausloeser' für die Parzelle des Eigentümers). Läuft
-- täglich mit den Baugesuchen; p_schreiben = false zählt nur.
-- =====================================================================

create or replace function public.gelegenheiten_reaktivierung(p_tage int default 30, p_schreiben boolean default false)
returns table (gespraeche int, kandidaten int, angelegt int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_g int; n_k int; n_neu int := 0; k record; gid uuid;
begin
  create temp table if not exists _reakt (parzelle_id uuid, anruf_id uuid, gefuehrt_am timestamptz, absicht text,
    baugesuch_id uuid, publiziert_am date, adresse text, gemeinde text, beschreibung text, eigene boolean, g_adresse text) on commit drop;
  truncate _reakt;

  insert into _reakt
  select distinct on (p.id, g.id)
         p.id, a.id, a.gefuehrt_am, a.verkaufsabsicht,
         g.id, g.publiziert_am, p.address, p.gemeinde, g.beschreibung, (g.egrid = p.egrid), g.adresse
  from (
    -- Je Parzelle das letzte Gespräch; ein älteres "nein" ist durch ein
    -- neueres "ja" überholt.
    select distinct on (parzelle_id) id, parzelle_id, gefuehrt_am, verkaufsabsicht
    from anruf where parzelle_id is not null order by parzelle_id, gefuehrt_am desc
  ) a
  join properties p on p.id = a.parzelle_id
  join baugesuch g on g.publiziert_am > greatest(a.gefuehrt_am::date, current_date - p_tage)
                  and p.egrid is not null
                  and (g.egrid = p.egrid or p.egrid = any (coalesce(g.nachbar_egrids, '{}')))
  where a.verkaufsabsicht in ('nein', 'spaeter', 'nur bei preis')
    and coalesce(p.ausgeschlossen, false) = false
  order by p.id, g.id, g.publiziert_am desc;

  select count(distinct anruf_id), count(*) into n_g, n_k from _reakt;

  if p_schreiben then
    for k in
      select * from _reakt r
      where not exists (
        select 1 from gelegenheit x join gelegenheit_parzelle xp on xp.gelegenheit_id = x.id
        where x.baugesuch_id = r.baugesuch_id and x.mandant_id is null
          and xp.parzelle_id = r.parzelle_id and x.titel like 'Wieder ansprechen:%')
    loop
      insert into gelegenheit (anlass, baugesuch_id, mandant_id, zustand, titel, begruendung, prioritaet)
      values ('baugesuch', k.baugesuch_id, null, 'erkannt',
              'Wieder ansprechen: ' || coalesce(k.adresse, '') || coalesce(', ' || k.gemeinde, ''),
              'Im Gespräch vom ' || to_char(k.gefuehrt_am, 'DD.MM.YYYY') || ': '
                || case k.absicht when 'nein' then 'will nicht verkaufen' when 'spaeter' then 'später vielleicht' else 'nur zum richtigen Preis' end
                || '. Seither ' || case when k.eigene then 'ein Baugesuch auf der eigenen Parzelle' else 'ein Baugesuch nebenan (' || coalesce(k.g_adresse, '') || ')' end
                || ', publiziert ' || to_char(k.publiziert_am, 'DD.MM.YYYY') || ': ' || left(coalesce(k.beschreibung, ''), 200) || '.',
              case when k.eigene then 8 else 4 end + case when k.absicht = 'nein' then 0 else 2 end)
      returning id into gid;
      insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, k.parzelle_id, 'ausloeser');
      n_neu := n_neu + 1;
    end loop;
  end if;

  return query select n_g, n_k, n_neu;
end;
$$;

revoke all on function public.gelegenheiten_reaktivierung(int, boolean) from public, anon, authenticated;

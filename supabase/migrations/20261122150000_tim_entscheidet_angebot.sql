-- =====================================================================
-- CALC YOU LATER: Tim entscheidet
-- =====================================================================
-- Julian, 22. November: «es muss ein ganz simpler Workflow sein, Tim
-- entscheidet immer schlussendlich», und Tim verschickt selbst. Der Weg
-- durch vier Hände (David prüft, Tim visiert, Julian kontrolliert, Tim
-- bestätigt, David verschickt; 20261119120000_angebot.sql) wird zu:
-- einreichen -> Tim legt den Preis fest -> Tim verschickt.
-- Wer «visum» hat, tut beides; wer sonst eingetragen ist, bleibt für
-- Unterschrift und Kontakt im Brief.
-- =====================================================================

/**
 * Ein Schritt im Ablauf einer Kalkulation, seit dem 22. November einfach
 * (Julian: «es muss ein ganz simpler Workflow sein, Tim entscheidet immer
 * schlussendlich»): Tim legt den Preis fest und verschickt.
 *
 *   einreichen    Entwurf  -> Prüfung   Empfänger gewählt; die Uhr startet: 24 Stunden
 *   speichern     Prüfung, Angebot      Firma, Vorlage, Angebot zwischenspeichern
 *   pruefen       Prüfung  -> Angebot   Tim: Preis, Urteil mit Grund, Firma und Vorlage; sein Preis gilt
 *   senden        Angebot  -> Gesendet  Tim; die Uhr hält an
 *   zurueck       Angebot (und Stände des alten Wegs) -> Prüfung, mit Grund
 *   ablehnen      Prüfung, Angebot -> Abgelehnt, mit Grund
 *   oeffnen       Abgelehnt -> Entwurf
 *
 * Die Schrift gehört zur Firma (stimo Nunito Sans, Studer Carlito,
 * Lebensraum Helvetica); gewählt wird sie nicht mehr.
 */
create or replace function public.kalkulation_schritt(
  p_id uuid, p_schritt text, p_name text,
  p_chf numeric default null, p_notiz text default null, p_text text default null, p_daten jsonb default null)
returns public.kalkulation
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '5s'
as $$
declare
  k      public.kalkulation;
  wer    text := left(nullif(btrim(coalesce(p_name, '')), ''), 80);
  notiz  text := left(nullif(btrim(coalesce(p_notiz, '')), ''), 2000);
  inhalt text := left(nullif(btrim(coalesce(p_text, '')), ''), 8000);
  d      jsonb := coalesce(p_daten, '{}'::jsonb);
  urteil text;
  rolle  text;
  merken boolean := true;
begin
  if auth.uid() is null or public.ist_fondsmanager() then
    raise exception 'Kein Zugriff.' using errcode = '42501';
  end if;
  if wer is null then raise exception 'Bitte den Namen angeben.'; end if;
  if p_chf is not null and (p_chf <= 0 or p_chf > 1e10) then raise exception 'Der Betrag ist nicht gültig.'; end if;
  if jsonb_typeof(d) <> 'object' or pg_column_size(d) > 60000 then raise exception 'Die Angaben zum Angebot sind nicht gültig.'; end if;
  urteil := nullif(d->>'urteil', '');

  select * into k from public.kalkulation where id = p_id for update;
  if not found then raise exception 'Diese Kalkulation gibt es nicht.'; end if;

  -- Beide Schritte tut Tim (Rolle «visum»).
  rolle := case when k.zustand in ('pruefung', 'angebot') then 'visum' end;
  if rolle is not null and not public.angebot_darf(rolle) then
    raise exception 'Diesen Schritt tut, wer dafür eingetragen ist.' using errcode = '42501';
  end if;

  -- Firma, Vorlage und Angebot ändert Tim beim Festlegen und vor dem Versand.
  if p_daten is not null and k.zustand in ('pruefung', 'angebot') and p_schritt in ('speichern', 'pruefen') then
    k.firma   := coalesce(nullif(d->>'firma', ''), k.firma);
    k.vorlage := coalesce(nullif(d->>'vorlage', ''), k.vorlage);
    if d ? 'angebot' then
      if jsonb_typeof(d->'angebot') <> 'object' then raise exception 'Die Angaben zum Angebot sind nicht gültig.'; end if;
      k.angebot := d->'angebot';
    end if;
  end if;

  if p_schritt = 'einreichen' and k.zustand = 'entwurf' then
    if coalesce(k.empfehlung_chf, 0) <= 0 then
      raise exception 'Ohne Kaufpreisempfehlung lässt sich nichts einreichen.';
    end if;
    if not exists (select 1 from jsonb_array_elements(k.personen) p where p->>'empfaenger' = 'true') then
      raise exception 'Bitte wählen, an wen das Angebot geht.';
    end if;
    k.zustand := 'pruefung';
    k.eingereicht_am := now();
    k.frist_am := now() + interval '24 hours';
    k.preis_chf := null;
    k.gesendet_am := null;
  elsif p_schritt = 'speichern' and k.zustand in ('pruefung', 'angebot') then
    -- Zwischenspeichern ist kein Schritt: der Verlauf zeigt Hände, nicht Tastendrücke.
    merken := false;
  elsif p_schritt = 'pruefen' and k.zustand = 'pruefung' then
    if urteil is null or urteil not in ('zu_tief', 'passt', 'zu_hoch') then
      raise exception 'Bitte sagen, ob die Empfehlung zu tief, richtig oder zu hoch ist.';
    end if;
    if notiz is null or length(notiz) < 10 then
      raise exception 'Bitte begründen, warum der Preis so ist: daraus lernt die Rechnung.';
    end if;
    k.preis_chf := coalesce(p_chf, k.empfehlung_chf);
    if urteil = 'zu_tief' and k.preis_chf <= k.empfehlung_chf then
      raise exception 'Ist die Empfehlung zu tief, liegt der Preis darüber.';
    end if;
    if urteil = 'zu_hoch' and k.preis_chf >= k.empfehlung_chf then
      raise exception 'Ist die Empfehlung zu hoch, liegt der Preis darunter.';
    end if;
    if k.firma is null or k.vorlage is null then
      raise exception 'Bitte Firma und Vorlage wählen.';
    end if;
    k.schrift := case k.firma when 'studer' then 'carlito' when 'lebensraum' then 'helvetica' else 'nunito' end;
    k.preis_urteil := urteil;
    k.preis_grund := notiz;
    k.zustand := 'angebot';
  elsif p_schritt = 'zurueck' and k.zustand in ('visum', 'kontrolle', 'bestaetigung', 'angebot') then
    if notiz is null then raise exception 'Bitte sagen, was zu ändern ist.'; end if;
    k.zustand := 'pruefung';
  elsif p_schritt = 'ablehnen' and k.zustand in ('pruefung', 'visum', 'kontrolle', 'bestaetigung', 'angebot') then
    if notiz is null then raise exception 'Bitte den Grund angeben.'; end if;
    k.zustand := 'abgelehnt';
  elsif p_schritt = 'senden' and k.zustand = 'angebot' then
    k.angebot_text := coalesce(inhalt, k.angebot_text);
    k.zustand := 'gesendet';
    k.gesendet_am := now();
  elsif p_schritt = 'oeffnen' and k.zustand = 'abgelehnt' then
    k.zustand := 'entwurf';
    k.eingereicht_am := null;
    k.frist_am := null;
    k.preis_chf := null;
  else
    raise exception 'Dieser Schritt passt nicht zum Stand der Kalkulation.';
  end if;

  update public.kalkulation set
    zustand = k.zustand, preis_chf = k.preis_chf, eingereicht_am = k.eingereicht_am, frist_am = k.frist_am,
    gesendet_am = k.gesendet_am, angebot_text = k.angebot_text, geaendert_am = now(),
    firma = k.firma, vorlage = k.vorlage, schrift = k.schrift, angebot = k.angebot,
    preis_urteil = k.preis_urteil, preis_grund = k.preis_grund,
    verlauf = case when merken then verlauf || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'schritt', p_schritt, 'name', wer, 'am', now(), 'notiz', notiz, 'von', auth.uid(),
      'urteil', case when p_schritt = 'pruefen' then urteil end,
      'chf', case when p_schritt = 'pruefen' then k.preis_chf end))) else verlauf end
  where id = p_id
  returning * into k;
  return k;
end;
$$;

revoke all on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) from public, anon;
grant execute on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) to authenticated;

comment on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) is
  'CALC YOU LATER: ein Schritt im Ablauf (einreichen, Preis festlegen durch Tim, senden, zurück, ablehnen, öffnen). Erzwingt Reihenfolge, Rolle und Uhr.';

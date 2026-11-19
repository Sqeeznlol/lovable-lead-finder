-- =====================================================================
-- CALC YOU LATER: das Angebot, durch vier Hände
-- =====================================================================
-- Julian, 19. November: «Ein Agent muss ein Angebot machen. Er hat die
-- Daten der Parzelle (könnten auch mehrere sein) und Eigentümer, vielleicht
-- auch mehrere, er muss entscheiden, an wen es gerichtet ist ... David
-- kontrolliert den vorgeschlagenen Preis, er kann entscheiden, welche
-- Firma das Angebot macht und welche Schriftart ... muss bestätigen, warum
-- zu wenig, warum zu viel oder warum der Preis passt, damit das System
-- permanent lernt ... dann Tim, er visiert den finalen Preis, dann kommt
-- es zu mir, ich überprüfe es, und am Schluss wieder zu David, der das
-- Angebot verschickt. Aber Tim muss auch nochmals bestätigen.»
--
-- Der Weg (Migration 20261116140000 hatte Prüfung, Freigabe, Angebot):
--
--   entwurf      der Agent rechnet, wählt Parzellen und Empfänger
--   pruefung     David: Preis, Urteil mit Grund, Firma, Vorlage, Schrift
--   visum        Tim visiert den Preis
--   kontrolle    Julian prüft das ganze Angebot
--   bestaetigung Tim bestätigt noch einmal
--   angebot      David verschickt
--   gesendet
--
-- Aus «freigabe» wird «visum»: was dort lag, wartete auf Tim.
--
-- Das Urteil (zu tief, passt, zu hoch) und sein Grund bleiben an der
-- Kalkulation. Daraus rechnet die Seite, wie weit die Empfehlung von dem
-- liegt, was David und Tim am Ende bieten (src/lib/angebot.ts). Julians
-- Formel ändert sich dadurch nicht: der Vorschlag aus den Rückmeldungen
-- steht daneben, mit Zahl und Herkunft.
--
-- Wer welchen Schritt tut, steht in angebot_person. Ist dort ein Konto
-- hinterlegt, lässt die Datenbank den Schritt nur diesem Konto; ohne Konto
-- zählt der Name, wie bisher (wenige Konten, mehrere Hände). Namen,
-- Telefonnummern und Adressen von Menschen stehen nur in der Datenbank,
-- nie im Repository.
-- =====================================================================

-- ---------------------------------------------------------------- Spalten

alter table public.kalkulation
  add column if not exists quelle       text not null default 'aurora',
  add column if not exists parzellen    jsonb not null default '[]'::jsonb,
  add column if not exists personen     jsonb not null default '[]'::jsonb,
  add column if not exists firma        text,
  add column if not exists vorlage      text,
  add column if not exists schrift      text,
  add column if not exists angebot      jsonb not null default '{}'::jsonb,
  add column if not exists preis_urteil text,
  add column if not exists preis_grund  text;

alter table public.kalkulation drop constraint if exists kalkulation_quelle_check;
alter table public.kalkulation add constraint kalkulation_quelle_check check (quelle in ('aurora', 'mail'));
alter table public.kalkulation drop constraint if exists kalkulation_parzellen_check;
alter table public.kalkulation add constraint kalkulation_parzellen_check
  check (jsonb_typeof(parzellen) = 'array' and jsonb_array_length(parzellen) <= 20 and pg_column_size(parzellen) < 40000);
alter table public.kalkulation drop constraint if exists kalkulation_personen_check;
alter table public.kalkulation add constraint kalkulation_personen_check
  check (jsonb_typeof(personen) = 'array' and jsonb_array_length(personen) <= 20 and pg_column_size(personen) < 40000);
alter table public.kalkulation drop constraint if exists kalkulation_firma_check;
alter table public.kalkulation add constraint kalkulation_firma_check check (firma is null or firma in ('stimo', 'lebensraum', 'studer'));
alter table public.kalkulation drop constraint if exists kalkulation_vorlage_check;
alter table public.kalkulation add constraint kalkulation_vorlage_check
  check (vorlage is null or vorlage in ('bauland', 'bestand', 'bedingt', 'bieterverfahren', 'unverbindlich'));
alter table public.kalkulation drop constraint if exists kalkulation_schrift_check;
alter table public.kalkulation add constraint kalkulation_schrift_check
  check (schrift is null or schrift in ('nunito', 'dmsans', 'carlito', 'serif', 'helvetica'));
alter table public.kalkulation drop constraint if exists kalkulation_angebot_check;
alter table public.kalkulation add constraint kalkulation_angebot_check
  check (jsonb_typeof(angebot) = 'object' and pg_column_size(angebot) < 60000);
alter table public.kalkulation drop constraint if exists kalkulation_preis_urteil_check;
alter table public.kalkulation add constraint kalkulation_preis_urteil_check
  check (preis_urteil is null or preis_urteil in ('zu_tief', 'passt', 'zu_hoch'));
alter table public.kalkulation drop constraint if exists kalkulation_preis_grund_check;
alter table public.kalkulation add constraint kalkulation_preis_grund_check
  check (preis_grund is null or length(preis_grund) <= 2000);

-- Der neue Weg. Erst die Regel weg, dann die Freigaben umhängen, dann die neue Regel.
alter table public.kalkulation drop constraint if exists kalkulation_zustand_check;
update public.kalkulation set zustand = 'visum' where zustand = 'freigabe';
alter table public.kalkulation add constraint kalkulation_zustand_check
  check (zustand in ('entwurf', 'pruefung', 'visum', 'kontrolle', 'bestaetigung', 'angebot', 'gesendet', 'abgelehnt'));

-- Was der Agent im Entwurf angibt: woher der Lead kam, welche Parzellen,
-- welche Menschen und wer das Angebot bekommt. Firma, Vorlage, Schrift,
-- Angebot, Urteil und Grund schreibt nur kalkulation_schritt.
grant insert (quelle, parzellen, personen) on public.kalkulation to authenticated;
grant update (quelle, parzellen, personen) on public.kalkulation to authenticated;

-- ------------------------------------------------------- Wer was tut

create table if not exists public.angebot_person (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 2 and 80),
  titel      text check (titel is null or length(titel) <= 80),
  email      text check (email is null or (length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  telefon    text check (telefon is null or length(telefon) <= 40),
  -- Für welche Firma jemand unterschreibt; leer, wer nur im Ablauf steht.
  firma      text check (firma is null or firma in ('stimo', 'lebensraum', 'studer')),
  -- preis (David), visum (Tim), kontrolle (Julian), versand (David), unterschrift.
  rollen     text[] not null default '{}'
             check (rollen <@ array['preis', 'visum', 'kontrolle', 'versand', 'unterschrift']::text[]),
  -- Ist ein Konto hinterlegt, tut nur dieses Konto die Schritte der Rolle.
  user_id    uuid references auth.users(id) on delete set null,
  reihe      int not null default 0,
  erstellt_am timestamptz not null default now()
);

comment on table public.angebot_person is
  'CALC YOU LATER: wer Preise prüft, visiert, kontrolliert, versendet und unterschreibt. Nur in der Datenbank, nie im Repository.';

alter table public.angebot_person enable row level security;
revoke all on public.angebot_person from public, anon, authenticated;
grant select, insert, update, delete on public.angebot_person to authenticated;

drop policy if exists angebot_person_lesen on public.angebot_person;
create policy angebot_person_lesen on public.angebot_person for select to authenticated
  using (not public.ist_fondsmanager());
-- Wer im Ablauf welche Rolle hat, legt nur ein Admin fest.
drop policy if exists angebot_person_pflegen on public.angebot_person;
create policy angebot_person_pflegen on public.angebot_person for all to authenticated
  using (not public.ist_fondsmanager() and public.has_role(auth.uid(), 'admin'))
  with check (not public.ist_fondsmanager() and public.has_role(auth.uid(), 'admin'));

/** Darf das angemeldete Konto die Schritte dieser Rolle tun? Ja, solange niemand mit Konto eingetragen ist. */
create or replace function public.angebot_darf(p_rolle text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (select 1 from public.angebot_person where p_rolle = any (rollen) and user_id is not null)
      or exists (select 1 from public.angebot_person where p_rolle = any (rollen) and user_id = auth.uid());
$$;

revoke all on function public.angebot_darf(text) from public, anon;
grant execute on function public.angebot_darf(text) to authenticated;

-- ------------------------------------------------------- Der Ablauf

drop function if exists public.kalkulation_schritt(uuid, text, text, numeric, text, text);

/**
 * Ein Schritt im Ablauf einer Kalkulation.
 *
 *   einreichen    Entwurf      -> Prüfung       Empfänger gewählt; die Uhr startet: 24 Stunden
 *   speichern     Prüfung, Kontrolle            Firma, Vorlage, Schrift, Angebot zwischenspeichern
 *   pruefen       Prüfung      -> Visum         David: Preis, Urteil mit Grund, Firma, Vorlage, Schrift
 *   visieren      Visum        -> Kontrolle     Tim, Preis bleibt oder ändert mit Grund
 *   kontrollieren Kontrolle    -> Bestätigung   Julian, darf Text und Preis (mit Grund) ändern
 *   bestaetigen   Bestätigung  -> Angebot       Tim, noch einmal
 *   senden        Angebot      -> Gesendet      David; die Uhr hält an
 *   zurueck       Visum bis Angebot -> Prüfung, mit Grund
 *   ablehnen      Prüfung bis Bestätigung -> Abgelehnt, mit Grund
 *   oeffnen       Abgelehnt    -> Entwurf
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

  rolle := case k.zustand
    when 'pruefung' then 'preis' when 'visum' then 'visum' when 'kontrolle' then 'kontrolle'
    when 'bestaetigung' then 'visum' when 'angebot' then 'versand' end;
  if rolle is not null and not public.angebot_darf(rolle) then
    raise exception 'Diesen Schritt tut, wer dafür eingetragen ist.' using errcode = '42501';
  end if;

  -- Firma, Vorlage, Schrift und Angebot ändern David beim Prüfen und Julian bei der Kontrolle.
  if p_daten is not null and k.zustand in ('pruefung', 'kontrolle') and p_schritt in ('speichern', 'pruefen', 'kontrollieren') then
    k.firma   := coalesce(nullif(d->>'firma', ''), k.firma);
    k.vorlage := coalesce(nullif(d->>'vorlage', ''), k.vorlage);
    k.schrift := coalesce(nullif(d->>'schrift', ''), k.schrift);
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
  elsif p_schritt = 'speichern' and k.zustand in ('pruefung', 'kontrolle') then
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
    if k.firma is null or k.vorlage is null or k.schrift is null then
      raise exception 'Bitte Firma, Vorlage und Schrift wählen.';
    end if;
    k.preis_urteil := urteil;
    k.preis_grund := notiz;
    k.zustand := 'visum';
  elsif (p_schritt = 'visieren' and k.zustand = 'visum') or (p_schritt = 'kontrollieren' and k.zustand = 'kontrolle') then
    if p_chf is not null and p_chf <> k.preis_chf and notiz is null then
      raise exception 'Bitte sagen, warum der Preis ändert.';
    end if;
    k.preis_chf := coalesce(p_chf, k.preis_chf);
    k.zustand := (case when p_schritt = 'visieren' then 'kontrolle' else 'bestaetigung' end);
  elsif p_schritt = 'bestaetigen' and k.zustand = 'bestaetigung' then
    k.zustand := 'angebot';
  elsif p_schritt = 'zurueck' and k.zustand in ('visum', 'kontrolle', 'bestaetigung', 'angebot') then
    if notiz is null then raise exception 'Bitte sagen, was zu ändern ist.'; end if;
    k.zustand := 'pruefung';
  elsif p_schritt = 'ablehnen' and k.zustand in ('pruefung', 'visum', 'kontrolle', 'bestaetigung') then
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
      'chf', case when p_schritt in ('pruefen', 'visieren', 'kontrollieren', 'bestaetigen') then k.preis_chf end))) else verlauf end
  where id = p_id
  returning * into k;
  return k;
end;
$$;

revoke all on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) from public, anon;
grant execute on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) to authenticated;

comment on function public.kalkulation_schritt(uuid, text, text, numeric, text, text, jsonb) is
  'CALC YOU LATER: ein Schritt im Ablauf (einreichen, prüfen, visieren, kontrollieren, bestätigen, senden, zurück, ablehnen, öffnen). Erzwingt Reihenfolge, Rollen und Uhr.';

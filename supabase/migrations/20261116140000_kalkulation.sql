-- =====================================================================
-- CALC YOU LATER: Kalkulation je Lead, mit Freigabe in einem Tag
-- =====================================================================
-- Die Idee, am 16. November an Julian weitergegeben: Lele gibt einen
-- Lead ein, das Werkzeug liefert Landwert, mögliche Hauptnutzfläche,
-- Kubatur, Baukosten, Verkaufserlös, Gewinn, Chancen und Risiken. Dann
-- ein Ablauf, der «nöd länger als 1 Tag dure dörf»: David bestätigt
-- oder ändert die Kaufpreisempfehlung, es folgt die finale Freigabe,
-- dann wird das Angebot formuliert und abgeschickt.
--
-- Gerechnet wird im Browser (src/lib/calc.ts); hier liegt, was bleiben
-- muss: die Momentaufnahme der Rechnung und der Weg durch die Hände.
--
-- Zwei Dinge erzwingt die Datenbank, nicht die Seite:
--
--   * Die Reihenfolge. Freigeben kann man nur, was geprüft ist; senden
--     nur, was freigegeben ist. Die Spalten des Ablaufs lassen sich von
--     aussen gar nicht schreiben, nur über kalkulation_schritt.
--   * Die Uhr. Eingereicht, Frist und Versand setzt die Datenbank mit
--     ihrer eigenen Zeit; ein Tag ist ein Tag.
--
-- Wer einen Schritt getan hat, steht im Verlauf mit dem Namen, den er
-- angibt, und mit seinem Konto. Fondsleitungen (Wohntraums) sehen die
-- Tabelle nicht.
--
-- Die Tabelle bleibt klein (eine Zeile je Lead); keine Rechnung, kein
-- Zählen über grosse Tabellen (CLAUDE.md, «Die Datenbank bedient die
-- Seite»).
-- =====================================================================

create table if not exists public.kalkulation (
  id             uuid primary key default gen_random_uuid(),
  erstellt_am    timestamptz not null default now(),
  erstellt_von   uuid default auth.uid() references auth.users(id) on delete set null,
  geaendert_am   timestamptz not null default now(),

  -- Worum es geht.
  adresse        text not null check (length(btrim(adresse)) between 3 and 200),
  plz            text check (plz is null or length(plz) <= 10),
  gemeinde       text check (gemeinde is null or length(gemeinde) <= 120),
  kanton         text check (kanton is null or kanton ~ '^[A-Z]{2}$'),
  egrid          text check (egrid is null or egrid ~ '^CH[0-9A-Z]{12}$'),
  parzelle_id    uuid references public.properties(id) on delete set null,
  anfrage_id     uuid references public.anfrage(id) on delete set null,
  kontakt        text check (kontakt is null or length(kontakt) <= 200),
  -- Testdaten sind gekennzeichnet und lassen sich ausblenden.
  test           boolean not null default false,

  -- Die Rechnung: was eingegeben wurde und was herauskam.
  eingaben       jsonb not null default '{}'::jsonb check (pg_column_size(eingaben) < 100000),
  ergebnis       jsonb not null default '{}'::jsonb check (pg_column_size(ergebnis) < 300000),
  empfehlung_chf numeric check (empfehlung_chf is null or empfehlung_chf between 0 and 1e10),

  -- Der Ablauf. Nur kalkulation_schritt schreibt diese Spalten.
  zustand        text not null default 'entwurf'
                 check (zustand in ('entwurf', 'pruefung', 'freigabe', 'angebot', 'gesendet', 'abgelehnt')),
  preis_chf      numeric check (preis_chf is null or preis_chf between 0 and 1e10),
  eingereicht_am timestamptz,
  frist_am       timestamptz,
  gesendet_am    timestamptz,
  angebot_text   text check (angebot_text is null or length(angebot_text) <= 8000),
  verlauf        jsonb not null default '[]'::jsonb
);

create index if not exists idx_kalkulation_stand on public.kalkulation (zustand, erstellt_am desc);

comment on table public.kalkulation is
  'CALC YOU LATER: Kalkulation je Lead (Neubau und Bestand) und ihr Weg von der Prüfung über die Freigabe zum Angebot.';

alter table public.kalkulation enable row level security;

drop policy if exists kalkulation_lesen on public.kalkulation;
create policy kalkulation_lesen on public.kalkulation for select to authenticated
  using (not public.ist_fondsmanager());

drop policy if exists kalkulation_anlegen on public.kalkulation;
create policy kalkulation_anlegen on public.kalkulation for insert to authenticated
  with check (not public.ist_fondsmanager());

-- Ändern und löschen lässt sich nur ein Entwurf. Was eingereicht ist,
-- bleibt, wie es geprüft wird.
drop policy if exists kalkulation_entwurf on public.kalkulation;
create policy kalkulation_entwurf on public.kalkulation for update to authenticated
  using (not public.ist_fondsmanager() and zustand = 'entwurf')
  with check (not public.ist_fondsmanager());

drop policy if exists kalkulation_loeschen on public.kalkulation;
create policy kalkulation_loeschen on public.kalkulation for delete to authenticated
  using (not public.ist_fondsmanager() and zustand = 'entwurf');

-- Die Spalten des Ablaufs sind von aussen nicht schreibbar: beim Anlegen
-- gelten ihre Vorgaben (Entwurf, leerer Verlauf), danach schreibt sie
-- nur die Funktion unten.
revoke all on public.kalkulation from public, anon, authenticated;
grant select, delete on public.kalkulation to authenticated;
grant insert (adresse, plz, gemeinde, kanton, egrid, parzelle_id, anfrage_id, kontakt, test, eingaben, ergebnis, empfehlung_chf)
  on public.kalkulation to authenticated;
grant update (adresse, plz, gemeinde, kanton, egrid, parzelle_id, anfrage_id, kontakt, test, eingaben, ergebnis, empfehlung_chf, geaendert_am)
  on public.kalkulation to authenticated;

/**
 * Ein Schritt im Ablauf einer Kalkulation.
 *
 *   einreichen  Entwurf    -> Prüfung    die Uhr startet: 24 Stunden
 *   pruefen     Prüfung    -> Freigabe   Preis bestätigt oder geändert
 *   freigeben   Freigabe   -> Angebot    finale Freigabe
 *   zurueck     Freigabe   -> Prüfung    mit Grund
 *   ablehnen    Prüfung, Freigabe -> Abgelehnt, mit Grund
 *   angebot     Angebot                  Text speichern
 *   senden      Angebot    -> Gesendet   die Uhr hält an
 *   oeffnen     Abgelehnt  -> Entwurf    neu rechnen und wieder einreichen
 *
 * Jeder Schritt verlangt einen Namen und steht danach im Verlauf.
 */
create or replace function public.kalkulation_schritt(
  p_id uuid, p_schritt text, p_name text,
  p_chf numeric default null, p_notiz text default null, p_text text default null)
returns public.kalkulation
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '5s'
as $$
declare
  k     public.kalkulation;
  wer   text := left(nullif(btrim(coalesce(p_name, '')), ''), 80);
  notiz text := left(nullif(btrim(coalesce(p_notiz, '')), ''), 2000);
  inhalt text := left(nullif(btrim(coalesce(p_text, '')), ''), 8000);
  merken boolean := true;
begin
  if auth.uid() is null or public.ist_fondsmanager() then
    raise exception 'Kein Zugriff.' using errcode = '42501';
  end if;
  if wer is null then raise exception 'Bitte den Namen angeben.'; end if;
  if p_chf is not null and (p_chf <= 0 or p_chf > 1e10) then raise exception 'Der Betrag ist nicht gültig.'; end if;

  select * into k from public.kalkulation where id = p_id for update;
  if not found then raise exception 'Diese Kalkulation gibt es nicht.'; end if;

  if p_schritt = 'einreichen' and k.zustand = 'entwurf' then
    if coalesce(k.empfehlung_chf, 0) <= 0 then
      raise exception 'Ohne Kaufpreisempfehlung lässt sich nichts einreichen.';
    end if;
    k.zustand := 'pruefung';
    k.eingereicht_am := now();
    k.frist_am := now() + interval '24 hours';
    k.preis_chf := null;
    k.gesendet_am := null;
  elsif p_schritt = 'pruefen' and k.zustand = 'pruefung' then
    k.preis_chf := coalesce(p_chf, k.empfehlung_chf);
    k.zustand := 'freigabe';
  elsif p_schritt = 'freigeben' and k.zustand = 'freigabe' then
    k.preis_chf := coalesce(p_chf, k.preis_chf);
    k.zustand := 'angebot';
  elsif p_schritt = 'zurueck' and k.zustand = 'freigabe' then
    if notiz is null then raise exception 'Bitte sagen, was zu ändern ist.'; end if;
    k.zustand := 'pruefung';
  elsif p_schritt = 'ablehnen' and k.zustand in ('pruefung', 'freigabe') then
    if notiz is null then raise exception 'Bitte den Grund angeben.'; end if;
    k.zustand := 'abgelehnt';
  elsif p_schritt = 'angebot' and k.zustand = 'angebot' then
    k.angebot_text := inhalt;
    -- Zwischenspeichern ist kein Schritt: der Verlauf zeigt Hände, nicht Tastendrücke.
    merken := false;
  elsif p_schritt = 'senden' and k.zustand = 'angebot' then
    k.angebot_text := coalesce(inhalt, k.angebot_text);
    if k.angebot_text is null then raise exception 'Das Angebot ist noch leer.'; end if;
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
    verlauf = case when merken then verlauf || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'schritt', p_schritt, 'name', wer, 'am', now(), 'notiz', notiz, 'von', auth.uid(),
      'chf', case when p_schritt in ('pruefen', 'freigeben') then k.preis_chf end))) else verlauf end
  where id = p_id
  returning * into k;
  return k;
end;
$$;

revoke all on function public.kalkulation_schritt(uuid, text, text, numeric, text, text) from public, anon;
grant execute on function public.kalkulation_schritt(uuid, text, text, numeric, text, text) to authenticated;

comment on function public.kalkulation_schritt(uuid, text, text, numeric, text, text) is
  'CALC YOU LATER: ein Schritt im Ablauf (einreichen, prüfen, freigeben, zurück, ablehnen, Angebot, senden, öffnen). Erzwingt Reihenfolge und Uhr.';

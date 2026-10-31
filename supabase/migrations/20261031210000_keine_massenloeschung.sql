-- =====================================================================
-- Niemand löscht den ganzen Bestand mit einer Zeile
-- =====================================================================
-- Gemessen am 31. Oktober über "Auswerten → regeln": 26 Regeln geben
-- `anon` Rechte, darunter diese hier:
--
--   properties    | d | Anon users can delete properties
--   properties    | w | Anon users can update properties
--   phone_numbers | * | Anon users can manage phone_numbers
--
-- Der öffentliche Schlüssel steckt im JavaScript der Webseite. Wer
-- ihn ausliest, kann damit alle 396'271 Objekte und sämtliche
-- Telefonnummern löschen -- mit einer einzigen Anfrage.
--
-- Die Migration `20260905230000_zugang_beschraenken` sollte das
-- beenden und ist auch eingespielt. Sie entfernte aber nur die Regel
-- "Allow all access"; die älteren `anon`-Regeln aus
-- `20260414152532` hat nie jemand weggenommen. Die Anmeldung davor
-- war damit von Anfang an eine Tür ohne Wand -- genau die
-- Befürchtung, die in jener Migration steht.
--
-- Warum hier nicht einfach die Löschregel fällt: Die Oberfläche
-- löscht wirklich, einzeln, über `useDeleteProperty` in
-- `PropertyList`. Nimmt man `anon` das Recht, bricht diese Funktion
-- -- und eine Anmeldung, auf die man ausweichen könnte, gibt es
-- nicht mehr.
--
-- Deshalb bleibt das Recht und die Menge wird begrenzt. Das ist
-- keine Zugangskontrolle, sondern ein Geländer: der Klick auf
-- "löschen" geht weiter, der Griff nach dem ganzen Bestand nicht.
-- Eine wirkliche Lösung ist eine Anmeldung oder ein Dienst, der im
-- Namen des Benutzers schreibt.
--
-- Migrationen und Abläufe sind nicht betroffen: die laufen über
-- psql als Eigentümer, nicht als `anon`.
-- =====================================================================

/** Wie viele Zeilen `anon` auf einmal löschen darf. */
-- Ausdrücklich *ohne* `security definer`: damit wäre `current_user`
-- innerhalb des Auslösers der Eigentümer der Funktion und niemals
-- `anon` -- die Prüfung unten liefe immer ins Leere. Der erste
-- Probelauf hat genau das gezeigt: die Sicherung stand da und tat
-- nichts.
create or replace function public.keine_massenloeschung()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_anzahl int;
  v_grenze constant int := 20;
begin
  -- Nur der öffentliche Zugang wird begrenzt. Wer über psql oder den
  -- Dienstschlüssel arbeitet, räumt bewusst auf und soll das können.
  if current_user <> 'anon' then
    return null;
  end if;

  select count(*) into v_anzahl from geloescht;

  if v_anzahl > v_grenze then
    raise exception
      'Abgewiesen: % Zeilen auf einmal. Über den öffentlichen Zugang '
      'sind höchstens % erlaubt. Grössere Aufräumarbeiten laufen über '
      'den SQL-Editor oder einen Ablauf.', v_anzahl, v_grenze
      using errcode = 'insufficient_privilege';
  end if;

  return null;
end;
$$;

drop trigger if exists properties_keine_massenloeschung on public.properties;
create trigger properties_keine_massenloeschung
  after delete on public.properties
  referencing old table as geloescht
  for each statement
  execute function public.keine_massenloeschung();

drop trigger if exists phone_numbers_keine_massenloeschung on public.phone_numbers;
create trigger phone_numbers_keine_massenloeschung
  after delete on public.phone_numbers
  referencing old table as geloescht
  for each statement
  execute function public.keine_massenloeschung();

-- Der Auslöser läuft in der Rolle des Aufrufers; sie braucht deshalb
-- das Recht, die Funktion auszuführen.
grant execute on function public.keine_massenloeschung() to anon, authenticated;

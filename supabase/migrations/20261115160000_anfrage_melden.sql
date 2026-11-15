-- =====================================================================
-- Jede neue Anfrage sofort nach Pipedrive (Funktion lead-melden)
-- =====================================================================
-- Julian, 15. November: Sofort-Meldung bei neuem Lead. Der Auslöser ruft
-- nach jedem Einfügen die Funktion lead-melden der Akquise auf; sie legt
-- Person, Deal, Notiz und eine heute fällige Anruf-Aufgabe an und trägt
-- die Deal-Nummer hier ein (0 = in Arbeit). pg_net schickt die Anfrage
-- nach dem Einfügen, ohne es aufzuhalten; scheitert der Aufruf, bleibt
-- die Anfrage trotzdem gespeichert.
--
-- Mitgeschickt wird nur die Kennung der Anfrage, kein Name, keine Nummer.
alter table public.anfrage add column if not exists pipedrive_deal_id bigint;
comment on column public.anfrage.pipedrive_deal_id is
  'Deal in Pipedrive (Funktion lead-melden); 0 während der Übertragung, leer wenn nicht übertragen.';

create extension if not exists pg_net with schema extensions;

create or replace function public.anfrage_melden()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://wwoeaysppiusdjntogxi.supabase.co/functions/v1/lead-melden',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000);
  return new;
exception when others then
  -- Nie die Anfrage verlieren, weil die Meldung nicht ging.
  return new;
end $$;
revoke all on function public.anfrage_melden() from public, anon, authenticated;

drop trigger if exists anfrage_melden on public.anfrage;
create trigger anfrage_melden after insert on public.anfrage
  for each row execute function public.anfrage_melden();

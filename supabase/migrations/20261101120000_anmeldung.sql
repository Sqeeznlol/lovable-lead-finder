-- =====================================================================
-- Wer sich anmeldet, wird festgehalten -- und nur der Admin sieht es
-- =====================================================================
-- Am 1. November kam die Anmeldung zurück, und mit ihr der Wunsch:
-- jede Anmeldung mit Adresse und Gerät festhalten, sichtbar nur im
-- Admin-Bereich.
--
-- Die Adresse sieht nicht der Browser, sondern der Rand von Supabase.
-- PostgREST reicht die Kopfzeilen jeder Anfrage als `request.headers`
-- in die Datenbank; dort liest sie diese Funktion. Der Browser schickt
-- nur den Gerätenamen mit, den er selbst kennt -- System und Browser,
-- nicht den Namen des Geräts, den gibt kein Browser her.
--
-- Geschrieben wird ausschliesslich über die Funktion (security
-- definer). Eine Insert-Regel gibt es nicht, also kann niemand eine
-- fremde Adresse eintragen. Gelesen wird nur mit der Admin-Rolle.
--
-- Hinweis fürs Geschäft: Wer festhält, wann sich wer von wo anmeldet,
-- muss die Betroffenen darüber informieren. Es sind zwei Konten im
-- eigenen Betrieb -- zumutbar, aber es gehört gesagt.
-- =====================================================================

create table if not exists public.anmeldung (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  ip          text,
  geraet      text,
  user_agent  text,
  zeit        timestamptz not null default now()
);

create index if not exists idx_anmeldung_zeit on public.anmeldung (zeit desc);

alter table public.anmeldung enable row level security;

drop policy if exists anmeldung_lesen on public.anmeldung;
create policy anmeldung_lesen on public.anmeldung
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Keine Regel für insert, update oder delete: geschrieben wird nur
-- durch die Funktion unten, geändert und gelöscht wird nichts. Ein
-- Protokoll, das sich ändern lässt, ist keines.

create or replace function public.anmeldung_merken(p_geraet text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  k  json;
  ip text;
begin
  if auth.uid() is null then
    return;
  end if;

  -- Die Kopfzeilen der Anfrage, wie PostgREST sie durchreicht. Fehlt
  -- die Einstellung (etwa in einem Test ohne PostgREST), bleibt die
  -- Adresse leer -- festgehalten wird trotzdem.
  begin
    k := current_setting('request.headers', true)::json;
  exception when others then
    k := null;
  end;

  -- Hinter einem Proxy steht die echte Adresse zuerst in der Liste.
  ip := coalesce(
    nullif(trim(k->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(k->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(k->>'x-real-ip'), '')
  );

  insert into public.anmeldung (user_id, email, ip, geraet, user_agent)
  select u.id, u.email, ip, left(p_geraet, 120), left(k->>'user-agent', 400)
  from auth.users u
  where u.id = auth.uid();
end;
$$;

revoke all on function public.anmeldung_merken(text) from public;
grant execute on function public.anmeldung_merken(text) to authenticated;

-- ---------------------------------------------------------------------
-- Das Admin-Konto bekommt seine Rolle von selbst
-- ---------------------------------------------------------------------
-- Die Konten werden von Hand bei Supabase angelegt; die Passwörter
-- stehen nirgends im Code. Welches Konto Admin ist, soll aber nicht an
-- einem zweiten Handgriff hängen, den man vergisst: Trägt ein neues
-- Konto diese Adresse, bekommt es die Rolle beim Anlegen -- und falls
-- es schon da ist, gleich hier.
create or replace function public.rolle_fuer_neues_konto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if lower(new.email) = 'sqeezn@wohntraums.life' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists rolle_fuer_neues_konto on auth.users;
create trigger rolle_fuer_neues_konto
  after insert on auth.users
  for each row execute function public.rolle_fuer_neues_konto();

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'sqeezn@wohntraums.life'
on conflict (user_id, role) do nothing;

-- =====================================================================
-- Anmeldung: Ort zur Adresse, und Geräte, die der Admin benennt
-- =====================================================================
-- Gemessen am 1. November ("Auswerten -> konten"): vier Anmeldungen,
-- alle mit Adresse, als Gerät nur "iPhone · Safari" und "Windows ·
-- Chrome". Gewünscht: der Gerätename und woher die Adresse kommt.
--
-- Der Ort: Die Datenbank kann aus einer Adresse keinen Ort machen, und
-- eine Abfrage nach aussen aus der Datenbank heraus gibt es hier nicht.
-- Der Browser fragt deshalb beim Anmelden einen Ortsdienst und reicht
-- den Ort mit. Er ist eine Angabe des Browsers -- ein Gerät könnte
-- etwas anderes behaupten; die Adresse selbst kommt weiterhin vom Rand
-- von Supabase und nicht vom Browser. Der Dienst liefert auch, welche
-- Adresse er gesehen hat; stimmt sie mit der vom Rand überein, steht
-- der Ort als bestätigt da.
--
-- Der Name: Kein Browser verrät "Julians iPhone". Jeder Browser trägt
-- aber eine zufällige Kennung (lib/geraet.ts, geraetKennung), und der
-- Admin benennt ein Gerät einmal. Danach steht der Name bei jeder
-- Anmeldung dieses Geräts.
-- =====================================================================

alter table public.anmeldung
  add column if not exists geraet_id  text,
  add column if not exists ort        text,
  add column if not exists ort_ip     text,
  add column if not exists ort_passt  boolean;

create table if not exists public.geraet_benennung (
  geraet_id   text primary key,
  name        text not null check (length(trim(name)) between 1 and 60),
  gesetzt_am  timestamptz not null default now()
);

alter table public.geraet_benennung enable row level security;
drop policy if exists geraet_benennung_admin on public.geraet_benennung;
create policy geraet_benennung_admin on public.geraet_benennung
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Die alte Fassung mit einem Parameter weicht der neuen. Zwei Fassungen
-- nebeneinander würde PostgREST bei einem Aufruf mit nur p_geraet nicht
-- mehr auseinanderhalten.
drop function if exists public.anmeldung_merken(text);

create or replace function public.anmeldung_merken(
  p_geraet    text default null,
  p_geraet_id text default null,
  p_ort       text default null,
  p_ort_ip    text default null
)
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

  begin
    k := current_setting('request.headers', true)::json;
  exception when others then
    k := null;
  end;

  ip := coalesce(
    nullif(trim(k->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(k->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(k->>'x-real-ip'), '')
  );

  insert into public.anmeldung
    (user_id, email, ip, geraet, user_agent, geraet_id, ort, ort_ip, ort_passt)
  select u.id, u.email, ip, left(p_geraet, 160), left(k->>'user-agent', 400),
         left(p_geraet_id, 40), left(p_ort, 120), left(p_ort_ip, 64),
         case when p_ort_ip is null or ip is null then null else p_ort_ip = ip end
  from auth.users u
  where u.id = auth.uid();
end;
$$;

revoke all on function public.anmeldung_merken(text, text, text, text) from public;
grant execute on function public.anmeldung_merken(text, text, text, text) to authenticated;

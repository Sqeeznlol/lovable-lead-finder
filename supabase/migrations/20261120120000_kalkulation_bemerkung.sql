-- =====================================================================
-- CALC YOU LATER: Bemerkungen zum Preis, wie ein Gespräch
-- =====================================================================
-- Julian, 20. November (Schöneggstrasse 18: CALC empfiehlt 1.41 Mio., das
-- Angebot steht bei 4.1 Mio.): «Wenn das andern Preis entspricht, kann man
-- das unten abvisieren ... wie so ein Chatfenster: ist richtig so, nicht
-- richtig so ... 4,1 Millionen weil das und das, dass auch Aurora den
-- Prozess und den Algo lernt, warum, weshalb.»
--
-- Bis hier urteilte nur David, einmal, im Schritt «Prüfung». Jetzt kann
-- jeder zu jeder Kalkulation, auch zu einem Entwurf, sagen: richtig so,
-- zu tief oder zu hoch, welcher Preis und warum. Die Empfehlung, gegen die
-- er urteilt, hält die Datenbank selbst fest (nicht der Browser), damit
-- das Lernen weiss, wovon die Abweichung gemessen ist, auch wenn später
-- neu gerechnet wird.
-- =====================================================================

create table if not exists public.kalkulation_bemerkung (
  id             uuid primary key default gen_random_uuid(),
  kalkulation_id uuid not null references public.kalkulation(id) on delete cascade,
  erstellt_am    timestamptz not null default now(),
  user_id        uuid default auth.uid(),
  name           text not null check (length(btrim(name)) between 1 and 80),
  urteil         text check (urteil is null or urteil in ('zu_tief', 'passt', 'zu_hoch')),
  preis_chf      numeric check (preis_chf is null or (preis_chf > 0 and preis_chf < 1e10)),
  text           text not null check (length(btrim(text)) between 1 and 2000),
  -- Festgehalten beim Schreiben, aus der Kalkulation (Auslöser unten).
  empfehlung_chf numeric,
  kanton         text,
  test           boolean not null default false
);

create index if not exists idx_kalkulation_bemerkung on public.kalkulation_bemerkung (kalkulation_id, erstellt_am);

comment on table public.kalkulation_bemerkung is
  'CALC YOU LATER: Gespräch zum Preis einer Kalkulation (richtig so, zu tief, zu hoch, Preis, warum). Daraus lernt der Vorschlag neben der Empfehlung.';

-- Wer urteilt, sagt nur Urteil, Preis und Grund; wogegen, weiss die Datenbank.
create or replace function public.kalkulation_bemerkung_vorbelegen()
returns trigger language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select empfehlung_chf, kanton, test into k from public.kalkulation where id = new.kalkulation_id;
  new.empfehlung_chf := k.empfehlung_chf;
  new.kanton := k.kanton;
  new.test := coalesce(k.test, false);
  new.user_id := auth.uid();
  new.erstellt_am := now();
  -- «Richtig so» heisst: der Preis ist die Empfehlung.
  if new.urteil = 'passt' then new.preis_chf := k.empfehlung_chf; end if;
  if new.urteil = 'zu_tief' and new.preis_chf is not null and new.preis_chf <= k.empfehlung_chf then
    raise exception 'Zu tief heisst: der richtige Preis liegt über der Empfehlung.';
  end if;
  if new.urteil = 'zu_hoch' and new.preis_chf is not null and new.preis_chf >= k.empfehlung_chf then
    raise exception 'Zu hoch heisst: der richtige Preis liegt unter der Empfehlung.';
  end if;
  return new;
end $$;

drop trigger if exists kalkulation_bemerkung_vorbelegen on public.kalkulation_bemerkung;
create trigger kalkulation_bemerkung_vorbelegen before insert on public.kalkulation_bemerkung
  for each row execute function public.kalkulation_bemerkung_vorbelegen();

alter table public.kalkulation_bemerkung enable row level security;

drop policy if exists bemerkung_lesen on public.kalkulation_bemerkung;
create policy bemerkung_lesen on public.kalkulation_bemerkung for select to authenticated
  using (not public.ist_fondsmanager());

drop policy if exists bemerkung_schreiben on public.kalkulation_bemerkung;
create policy bemerkung_schreiben on public.kalkulation_bemerkung for insert to authenticated
  with check (not public.ist_fondsmanager());

-- Zurücknehmen kann nur, wer geschrieben hat; ändern niemand: ein Gespräch bleibt, wie es war.
drop policy if exists bemerkung_loeschen on public.kalkulation_bemerkung;
create policy bemerkung_loeschen on public.kalkulation_bemerkung for delete to authenticated
  using (not public.ist_fondsmanager() and user_id = auth.uid());

revoke all on public.kalkulation_bemerkung from public, anon, authenticated;
grant select, delete on public.kalkulation_bemerkung to authenticated;
grant insert (kalkulation_id, name, urteil, preis_chf, text) on public.kalkulation_bemerkung to authenticated;
revoke all on function public.kalkulation_bemerkung_vorbelegen() from public, anon, authenticated;

-- =====================================================================
-- Liegenschaften der regulierten Immobiliengefässe
-- =====================================================================
-- Julian, 8. November: "alle regulierten Gefässe, die Immobilien
-- halten, veröffentlichen im Jahresbericht alle Infos über alle
-- Liegenschaften: Adresse, Rendite, Baujahr". Gelesen mit
-- tools/fonds_inventar.py, je Bericht gegen das Total geprüft, verortet
-- mit tools/fonds_verorten.py (Adresse -> LV95, Gemeinde, EGRID).
--
-- Wofür: Renditen und Werte je Gemeinde als Beleg auf den Check-Seiten,
-- und bei jedem Lead die Gefässe in der Nähe als mögliche Käufer.
--
-- Die Daten sind öffentlich (Jahresberichte), trotzdem liest nur, wer
-- angemeldet ist: die Auswertung gehört uns, nicht der Konkurrenz.
-- =====================================================================

create table if not exists public.fonds_liegenschaft (
  id             bigserial primary key,
  gefaess        text not null,
  typ            text not null default 'fonds' check (typ in ('fonds', 'anlagestiftung', 'immo_ag')),
  berichtsdatum  text,
  ort_adresse    text not null,
  baujahr        int check (baujahr is null or baujahr between 1400 and 2100),
  gestehung      bigint,
  verkehrswert   bigint not null check (verkehrswert > 0),
  sollmiete      bigint,
  brutto_rendite numeric(6, 2),
  gemeinde       text,
  kanton         text,
  e              double precision,
  n              double precision,
  egrid          text check (egrid is null or egrid ~ '^CH[0-9A-Z]{12}$'),
  quelle         text not null,
  eingelesen_am  timestamptz not null default now(),
  unique (gefaess, ort_adresse, verkehrswert)
);

create index if not exists idx_fonds_liegenschaft_gemeinde on public.fonds_liegenschaft (gemeinde);
create index if not exists idx_fonds_liegenschaft_egrid on public.fonds_liegenschaft (egrid) where egrid is not null;
create index if not exists idx_fonds_liegenschaft_lage on public.fonds_liegenschaft (e, n) where e is not null;

alter table public.fonds_liegenschaft enable row level security;
drop policy if exists fonds_liegenschaft_lesen on public.fonds_liegenschaft;
create policy fonds_liegenschaft_lesen on public.fonds_liegenschaft for select to authenticated using (true);
grant select on public.fonds_liegenschaft to authenticated;

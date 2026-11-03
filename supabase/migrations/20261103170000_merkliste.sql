-- Merklisten aus der Gebäudesuche (Julian, 3. November: "Ergebnisse
-- markieren und als Liste abspeichern, dann im Auge behalten", dazu ein
-- PDF mit dem Namen der Liste).
--
-- Eine Liste gehört dem, der sie anlegt; der Admin sieht alle. Gemerkt
-- wird das Gebäude (egid) mit seiner Parzelle -- die Werte (Baujahr,
-- Heizung, Eigentümer) liest die Liste beim Öffnen frisch, damit sie
-- zeigt, was heute gilt, und nicht, was beim Speichern galt.

create table if not exists public.merkliste (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 120),
  erstellt_von uuid not null default auth.uid() references auth.users(id) on delete cascade,
  erstellt_am  timestamptz not null default now(),
  -- Die Suche, aus der die Liste entstand (Gemeinde, Baujahr ...), für
  -- den Kopf des PDF.
  filter       jsonb not null default '{}'::jsonb
);
create index if not exists idx_merkliste_von on public.merkliste (erstellt_von);

create table if not exists public.merkliste_eintrag (
  liste_id    uuid not null references public.merkliste(id) on delete cascade,
  egid        bigint not null,
  parzelle_id uuid references public.properties(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  primary key (liste_id, egid)
);

alter table public.merkliste enable row level security;
alter table public.merkliste_eintrag enable row level security;
revoke all on public.merkliste, public.merkliste_eintrag from anon;

drop policy if exists merkliste_eigene on public.merkliste;
create policy merkliste_eigene on public.merkliste for all to authenticated
  using (erstellt_von = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (erstellt_von = auth.uid());

drop policy if exists merkliste_eintrag_eigene on public.merkliste_eintrag;
create policy merkliste_eintrag_eigene on public.merkliste_eintrag for all to authenticated
  using (exists (select 1 from public.merkliste m where m.id = liste_id
                 and (m.erstellt_von = auth.uid() or public.has_role(auth.uid(), 'admin'))))
  with check (exists (select 1 from public.merkliste m where m.id = liste_id and m.erstellt_von = auth.uid()));

grant select, insert, update, delete on public.merkliste, public.merkliste_eintrag to authenticated;

-- Die Einträge einer Liste mit den heutigen Werten, in derselben Form
-- wie gebaeude_suchen -- so zeigt die Seite beides mit derselben Zeile.
-- security invoker: die Regeln oben gelten auch hier.
create or replace function public.merkliste_gebaeude(p_liste uuid)
returns table (
  parzelle_id uuid, adresse text, gemeinde text, egrid text, egid bigint, klasse smallint,
  baujahr smallint, zimmer smallint, wohnflaeche integer, wohnungen smallint, geschosse smallint,
  heizung_energie smallint, eigentuemer text
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select coalesce(e.parzelle_id, p.id), p.address, p.gemeinde, g.egrid, e.egid, g.klasse,
         g.baujahr, g.zimmer, g.wohnflaeche, g.wohnungen, g.geschosse, g.heizung_energie, p.owner_name
  from public.merkliste_eintrag e
  left join public.gebaeude g on g.egid = e.egid
  left join public.properties p on p.id = e.parzelle_id
  where e.liste_id = p_liste
  order by p.gemeinde nulls last, p.address nulls last, e.egid;
$$;

revoke all on function public.merkliste_gebaeude(uuid) from public, anon;
grant execute on function public.merkliste_gebaeude(uuid) to authenticated;

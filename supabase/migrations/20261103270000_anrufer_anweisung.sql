-- =====================================================================
-- Anweisung an die Anrufer je Kunde; Vermittlung und Verkauf als Anlass
-- =====================================================================
-- Tims Brief, Abschnitt 5, Schritt 5: "Callers receive the leads with
-- project-specific instructions." Die Anweisung hängt am Kunden
-- (Mandat): was man am Telefon sagt, in wessen Namen man anfragt, was
-- man nicht sagt. Der Akquise-Modus zeigt sie oben, wenn er die
-- Gelegenheiten eines Kunden abarbeitet (?mandant=...).
--
-- Abschnitt 7, "Prefers brokerage": "Hand over to brokerage services
-- and sales mandates, tracked as its own opportunity type." Bisher
-- blieb "lieber mit Makler" eine Kategorie in der Reaktivierungsliste;
-- jetzt wird daraus eine Gelegenheit mit eigenem Anlass 'vermittlung',
-- und ein "will verkaufen" eine mit Anlass 'verkauf' -- beide mit
-- Zustand, Zuständigkeit und Ergebnis wie jede andere.
-- =====================================================================

alter table public.mandant add column if not exists anweisung text check (length(anweisung) <= 4000);

alter table public.gelegenheit drop constraint if exists gelegenheit_anlass_check;
alter table public.gelegenheit add constraint gelegenheit_anlass_check
  check (anlass in ('baugesuch', 'arrondierung', 'ausnuetzungsreserve', 'zonenaenderung',
                    'investorentreffer', 'vermittlung', 'verkauf', 'manuell'));

-- Aus einem Gespräch eine Gelegenheit: je Parzelle und Anlass höchstens
-- eine offene. security invoker: wer das Gespräch erfassen darf, darf
-- auch die Gelegenheit anlegen.
create or replace function public.gelegenheit_aus_gespraech(p_parzelle uuid, p_anlass text, p_begruendung text default null)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  gid uuid; adr text; gem text;
begin
  if p_anlass not in ('vermittlung', 'verkauf') then raise exception 'Anlass % nicht vorgesehen', p_anlass; end if;
  select g.id into gid from gelegenheit g join gelegenheit_parzelle gp on gp.gelegenheit_id = g.id
  where gp.parzelle_id = p_parzelle and g.anlass = p_anlass and g.zustand not in ('abgeschlossen', 'verworfen') limit 1;
  if gid is not null then return gid; end if;
  select address, gemeinde into adr, gem from properties where id = p_parzelle;
  insert into gelegenheit (anlass, zustand, titel, begruendung, prioritaet)
  values (p_anlass, 'erkannt',
          case p_anlass when 'vermittlung' then 'Maklermandat anbieten: ' else 'Verkaufsbereit: ' end || coalesce(adr, '') || coalesce(', ' || gem, ''),
          p_begruendung, case p_anlass when 'verkauf' then 12 else 6 end)
  returning id into gid;
  insert into gelegenheit_parzelle (gelegenheit_id, parzelle_id, rolle) values (gid, p_parzelle, 'ausloeser');
  return gid;
end;
$$;

revoke all on function public.gelegenheit_aus_gespraech(uuid, text, text) from public, anon;
grant execute on function public.gelegenheit_aus_gespraech(uuid, text, text) to authenticated;

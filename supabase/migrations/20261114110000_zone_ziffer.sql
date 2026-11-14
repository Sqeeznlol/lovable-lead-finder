-- Was die Zone erlaubt, ausserhalb Zürichs (Zürich liefert seine Ziffern
-- je Zonenfläche selbst per WFS). Quelle: Nutzungsplanung MGDM 73.1 v1.2
-- von geodienste.ch, gefüllt vom Ablauf "Zonenziffern". Nur Kantone mit
-- freier Lizenz (AG, ZG, SZ, SO, SH, LU; geprüft 14. November 2026).
--
-- Abgefragt wird per Punkt: im Aargau hat jede Fläche ihren eigenen Typ,
-- ein anderer Schlüssel als die Lage existiert nicht.
create table if not exists public.zone_ziffer (
  id          bigserial primary key,
  kanton      text not null,
  code        text,
  bezeichnung text,
  abkuerzung  text,
  ziffer      numeric not null,
  art         text,            -- wie im Kanton geschrieben, z. B. "max. Ausnützungsziffer"
  art_kurz    text check (art_kurz is null or art_kurz in ('az', 'bmz', 'uez', 'gfz', 'gruen')),
  geom        extensions.geometry(MultiPolygon, 2056) not null
);
create index if not exists idx_zone_ziffer_geom on public.zone_ziffer using gist (geom);
alter table public.zone_ziffer enable row level security;
revoke all on public.zone_ziffer from anon, authenticated;

-- Öffentlich nur diese eine Frage: welche Ziffer gilt an diesem Punkt.
create or replace function public.zone_ziffer_am(p_e double precision, p_n double precision)
returns table (kanton text, code text, bezeichnung text, abkuerzung text, ziffer numeric, art text, art_kurz text)
language sql stable security definer set search_path = public, extensions as $$
  select z.kanton, z.code, z.bezeichnung, z.abkuerzung, z.ziffer, z.art, z.art_kurz
    from public.zone_ziffer z
   where p_e between 2480000 and 2840000 and p_n between 1070000 and 1300000
     and st_intersects(z.geom, st_setsrid(st_makepoint(p_e, p_n), 2056))
   limit 3;
$$;
revoke all on function public.zone_ziffer_am(double precision, double precision) from public;
grant execute on function public.zone_ziffer_am(double precision, double precision) to anon, authenticated;

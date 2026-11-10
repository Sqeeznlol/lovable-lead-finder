import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Abschnitt, Leer, LISTE, Marke, Reiter, Seite, Strichbalken } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { FENSTER } from '@/lib/fenster';

/**
 * Arrondieren im Kundenportfolio (Julian, 10. November: "mit dem
 * Helvetica-Fonds eine Übersicht, welche die Nachbarparzellen sind,
 * damit wir sehen, welche Potenzial haben").
 *
 * Je Liegenschaft des Kunden die angrenzenden Parzellen, nach Punkten:
 * unbebaut in der Bauzone, alter oder niedriger Bestand, wenige
 * Wohnungen (wenige Eigentümer), zusammen gross genug für eine
 * Arealüberbauung. Die Nachbarparzelle ist für den Eigentümer nebenan
 * mehr wert als für jeden anderen Käufer -- darum steht hier, wem sie
 * gehört, soweit bekannt (Eigentumsauskunft im Bestand, Fondsinventar).
 */
type Nachbar = {
  position: number; haupt_egrid: string; haupt_adresse: string; nachbar_egrid: string; nummer: string | null;
  gemeinde: string | null; kanton: string | null; zone: string | null; flaeche: number | null; gebaeude: number | null;
  baujahr: number | null; wohnungen: number | null; az_heute: number | null; punkte: number; gruende: string | null;
};
type Filter = 'alle' | 'potenzial' | 'unbebaut';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const PORTFOLIO = 'helvetica';

async function inStuecken<T>(egrids: string[], frage: (teil: string[]) => Promise<T[]>): Promise<T[]> {
  const aus: T[] = [];
  for (let i = 0; i < egrids.length; i += 150) aus.push(...await frage(egrids.slice(i, i + 150)));
  return aus;
}

export function Arrondierung() {
  const [filter, setFilter] = useState<Filter>('potenzial');
  const nachbarn = useQuery({
    queryKey: ['nachbar-potenzial', PORTFOLIO],
    queryFn: async (): Promise<Nachbar[] | null> => {
      const { data, error } = await db.from('nachbar_potenzial')
        .select('position, haupt_egrid, haupt_adresse, nachbar_egrid, nummer, gemeinde, kanton, zone, flaeche, gebaeude, baujahr, wohnungen, az_heute, punkte, gruende')
        .eq('portfolio', PORTFOLIO).order('punkte', { ascending: false }).limit(2000);
      return error ? null : data ?? [];
    },
  });
  const egrids = useMemo(() => [...new Set((nachbarn.data ?? []).map(n => n.nachbar_egrid))], [nachbarn.data]);
  // Wem gehört nebenan: Eigentumsauskunft im Bestand (ZH, TG) und Fondsinventare.
  const eigentuemer = useQuery({
    queryKey: ['nachbar-eigentuemer', egrids.length],
    enabled: egrids.length > 0,
    queryFn: async () => {
      const [bestand, fonds] = await Promise.all([
        inStuecken(egrids, async t => (await db.from('properties').select('egrid, owner_name').in('egrid', t).not('owner_name', 'is', null)).data ?? []),
        inStuecken(egrids, async t => (await db.from('fonds_liegenschaft').select('egrid, gefaess').in('egrid', t)).data ?? []),
      ]);
      const m = new Map<string, string>();
      for (const b of bestand as { egrid: string; owner_name: string }[]) m.set(b.egrid, b.owner_name);
      for (const f of fonds as { egrid: string; gefaess: string }[]) m.set(f.egrid, `${f.gefaess} (Fonds)`);
      return m;
    },
  });

  const alle = useMemo(() => nachbarn.data ?? [], [nachbarn.data]);
  // Grenzt eine Parzelle an mehrere Liegenschaften des Kunden, verbindet
  // ihr Kauf sie zu einem Areal (Wattwil: drei Liegenschaften um eine
  // Parzelle). Das ist der wertvollste Zukauf überhaupt.
  const verbindet = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of alle) m.set(n.nachbar_egrid, (m.get(n.nachbar_egrid) ?? new Set()).add(n.haupt_egrid));
    return m;
  }, [alle]);
  const sicht = alle.filter(n => filter === 'alle' || (filter === 'potenzial' ? n.punkte >= 50 : !n.gebaeude && n.punkte > 0));
  const gruppen = useMemo(() => {
    const g = new Map<string, Nachbar[]>();
    for (const n of sicht) g.set(n.haupt_egrid, [...(g.get(n.haupt_egrid) ?? []), n]);
    const rang = (n: Nachbar) => n.punkte + ((verbindet.get(n.nachbar_egrid)?.size ?? 1) > 1 ? 20 : 0);
    return [...g.values()].map(l => l.sort((a, b) => rang(b) - rang(a))).sort((a, b) => rang(b[0]) - rang(a[0]));
  }, [sicht, verbindet]);
  const verbindende = [...verbindet.values()].filter(x => x.size > 1).length;
  const positionen = new Set(alle.map(n => n.haupt_egrid)).size;
  const mitPotenzial = alle.filter(n => n.punkte >= 50).length;
  const unbebaut = alle.filter(n => !n.gebaeude && n.punkte > 0).length;
  const flaecheFrei = alle.filter(n => n.punkte >= 50).reduce((s, n) => s + (n.flaeche ?? 0), 0);

  return (
    <Seite bild={BILD.gelegenheiten} ueber="Helvetica Swiss Living Fund" titel="Arrondieren"
      unter={<>Nachbarparzellen der {positionen || 'Kunden-'}Liegenschaften: wo ein Zukauf am meisten bringt. Davon {unbebaut} unbebaut in der Bauzone.</>}
      kennzahlen={[
        { titel: 'Nachbarparzellen', wert: String(alle.length) },
        { titel: 'Mit Potenzial', wert: String(mitPotenzial), marke: mitPotenzial ? <Marke art="heiss">50+ Punkte</Marke> : undefined },
        { titel: 'Verbinden Liegenschaften', wert: String(verbindende) },
        { titel: 'Fläche mit Potenzial', wert: `${Math.round(flaecheFrei).toLocaleString('de-CH')} m²` },
      ]}>
      <Reiter<Filter> wahl={filter} setWahl={setFilter} optionen={[
        { wert: 'potenzial', titel: 'Mit Potenzial', zahl: mitPotenzial },
        { wert: 'unbebaut', titel: 'Unbebaut', zahl: unbebaut },
        { wert: 'alle', titel: 'Alle', zahl: alle.length },
      ]} />
      {nachbarn.isLoading ? <Leer titel="Lädt …" />
        : nachbarn.data === null ? <Leer titel="Die Nachbarparzellen sind noch nicht gerechnet.">Ablauf «Migrationen» mit «einspielen» starten.</Leer>
        : !gruppen.length ? <Leer titel="Keine Nachbarparzelle in dieser Auswahl." />
        : gruppen.map(g => (
          <Abschnitt key={g[0].haupt_egrid} titel={g[0].haupt_adresse} zahl={g.length}
            hinweis={`Bester Nachbar: ${g[0].punkte} Punkte`}>
            <ul className={LISTE}>
              {g.map(n => {
                const wem = eigentuemer.data?.get(n.nachbar_egrid);
                return (
                  <li key={n.nachbar_egrid} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Parzelle {n.nummer ?? '?'}{n.gemeinde ? `, ${n.gemeinde}` : ''}</span>
                        {!n.gebaeude && n.punkte > 0 && <Marke art="gruen">unbebaut</Marke>}
                        {(verbindet.get(n.nachbar_egrid)?.size ?? 1) > 1 && <Marke art="heiss">verbindet {verbindet.get(n.nachbar_egrid)!.size} Liegenschaften</Marke>}
                        {n.zone && <Marke>{n.zone}</Marke>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[n.flaeche ? `${n.flaeche.toLocaleString('de-CH')} m²` : null,
                          n.gebaeude ? `${n.gebaeude} Gebäude${n.baujahr ? ` ab ${n.baujahr}` : ''}` : null,
                          n.wohnungen ? `${n.wohnungen} Wohnungen` : null,
                          n.az_heute != null && n.gebaeude ? `heute ${Number(n.az_heute).toFixed(2)} genutzt` : null].filter(Boolean).join(' · ')}
                      </div>
                      {n.gruende && <div className="text-sm">{n.gruende}</div>}
                      <div className="flex flex-wrap gap-x-4 text-sm">
                        <span className={wem ? '' : 'text-muted-foreground'}>{wem ?? 'Eigentümer nicht bekannt'}</span>
                        <a className="underline underline-offset-2" target={FENSTER.karte}
                           href={`https://map.geo.admin.ch/?swisssearch=${n.nachbar_egrid}&lang=de&bgLayer=ch.swisstopo.swissimage`}>Karte</a>
                      </div>
                    </div>
                    <Strichbalken anteil={n.punkte / 100} titel="Potenzial" farbe={n.punkte >= 50 ? 'heiss' : 'akzent'} />
                  </li>
                );
              })}
            </ul>
          </Abschnitt>
        ))}
    </Seite>
  );
}

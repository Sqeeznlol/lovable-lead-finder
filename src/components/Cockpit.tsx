import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Das Cockpit: was heute zu prüfen ist, an einem Ort.
 *
 * Julian fragte "wo steht das zur Überprüfung alles?" -- die Antwort
 * war: verteilt auf vier Bereiche, und die Baugesuche nirgends. Hier
 * steht jede Zahl, die eine Handlung auslöst, und ein Tipp führt
 * dorthin, wo man sie erledigt. Gezählt wird in der Datenbank, nicht
 * geschätzt.
 */
export type Ziel = 'baugesuche' | 'gelegenheiten' | 'auswertung' | 'karte' | 'uebersicht';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const tag = (minus: number) => new Date(Date.now() - minus * 864e5).toISOString().slice(0, 10);
const zeit = (s: string) => new Date(s).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function zaehlen(t: string, f?: (q: any) => any): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(t).select('*', { count: 'exact', head: true });
  if (f) q = f(q);
  const r = await q;
  return r.error ? null : r.count ?? null;
}

export function Cockpit({ onGehe }: { onGehe: (z: Ziel) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cockpit'],
    queryFn: async () => {
      const [bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, portfolios, letzte, zuletzt] = await Promise.all([
        zaehlen('baugesuch', q => q.neq('quelle', 'probe').gte('publiziert_am', tag(7))),
        zaehlen('baugesuch', q => q.neq('quelle', 'probe').gte('publiziert_am', tag(7)).not('parzelle_id', 'is', null)),
        zaehlen('gelegenheit', q => q.not('zustand', 'in', '(abgeschlossen,verworfen)')),
        zaehlen('gelegenheit', q => q.eq('zustand', 'erkannt')),
        zaehlen('anruf', q => q.lte('wiedervorlage_am', tag(0))),
        zaehlen('anfrage', q => q.eq('bearbeitet', false)),
        zaehlen('portfolio'),
        db().from('baugesuch').select('id, adresse, gemeinde, beschreibung, publiziert_am, parzelle_id')
          .neq('quelle', 'probe').order('publiziert_am', { ascending: false }).limit(5),
        db().from('baugesuch').select('erfasst_am').order('erfasst_am', { ascending: false }).limit(1),
      ]);
      return {
        bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, portfolios,
        letzte: (letzte.data ?? []) as { id: string; adresse: string | null; gemeinde: string | null; beschreibung: string | null; publiziert_am: string; parzelle_id: string | null }[],
        zuletzt: (zuletzt.data?.[0]?.erfasst_am as string | undefined) ?? null,
      };
    },
    staleTime: 60 * 1000,
  });

  const n = (x: number | null | undefined) => (x == null ? '–' : x.toLocaleString('de-CH'));
  const kacheln: { titel: string; wert: string; zeile: string; ziel: Ziel; wichtig: boolean }[] = data ? [
    { titel: 'Neue Baugesuche', wert: n(data.bgNeu), zeile: `letzte 7 Tage · ${n(data.bgBestand)} im Bestand`, ziel: 'baugesuche', wichtig: false },
    { titel: 'Gelegenheiten', wert: n(data.gelOffen), zeile: `offen · ${n(data.gelNeu)} noch nicht geprüft`, ziel: 'gelegenheiten', wichtig: (data.gelNeu ?? 0) > 0 },
    { titel: 'Wiedervorlagen', wert: n(data.faellig), zeile: 'heute fällig oder überfällig', ziel: 'auswertung', wichtig: (data.faellig ?? 0) > 0 },
    { titel: 'Anfragen', wert: n(data.anfragen), zeile: 'von den öffentlichen Seiten, offen', ziel: 'auswertung', wichtig: (data.anfragen ?? 0) > 0 },
    { titel: 'Portfolios', wert: n(data.portfolios), zeile: 'auf der Karte', ziel: 'karte', wichtig: false },
  ] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-3xl sm:text-4xl">Was heute zu prüfen ist</h1>
        {data?.zuletzt && <p className="text-muted-foreground">Baugesuche zuletzt geladen {zeit(data.zuletzt)}</p>}
      </header>

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gezählt …</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {kacheln.map((k, i) => (
          <button key={k.titel} type="button" onClick={() => onGehe(k.ziel)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={`group animate-fade-in rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-ceramic-hover sm:p-6 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <span className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">{k.titel}</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <span className={`mt-3 block text-4xl font-bold tabular-nums tracking-tight ${k.wichtig ? 'text-accent' : ''}`}>{k.wert}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{k.zeile}</span>
          </button>
        ))}
      </div>

      {data && data.letzte.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">Neueste Baugesuche</h2>
            <button type="button" onClick={() => onGehe('baugesuche')} className="text-sm font-semibold text-accent">Alle zeigen</button>
          </div>
          <ul className="divide-y rounded-2xl border bg-card">
            {data.letzte.map(g => (
              <li key={g.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-semibold">{g.adresse ?? 'Ohne Adresse'}{g.gemeinde ? `, ${g.gemeinde}` : ''}</span>
                  <span className="block truncate text-sm text-muted-foreground">{g.beschreibung}</span>
                </span>
                <span className="shrink-0 text-right text-sm text-muted-foreground">
                  {new Date(g.publiziert_am).toLocaleDateString('de-CH')}
                  {g.parzelle_id && <span className="block text-xs font-medium text-foreground">im Bestand</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

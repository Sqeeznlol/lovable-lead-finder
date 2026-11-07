import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { belege, type Gesuch } from '@/lib/baugesuch-belege';
import { Marke } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const datum = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Alle Baugesuche, die eine Parzelle betreffen -- auf ihr selbst und bei
 * ihren Nachbarn --, rückwirkend über alles, was geladen ist (seit
 * Januar 2026). Wer anruft, will wissen: baut hier jemand, oder nebenan?
 * Ein Bau nebenan ist der häufigste Anlass, über das eigene Grundstück
 * nachzudenken.
 *
 * Nachbar heisst: die EGRID dieser Parzelle steht in den Nachbarn, die
 * der Ablauf "Baugesuche" zum Gesuch beim Bund geholt hat.
 */
export function BaugesucheParzelle({ parzelleId, egrid }: { parzelleId: string; egrid: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['baugesuche', 'parzelle', parzelleId, egrid],
    queryFn: async () => {
      const bedingung = [`parzelle_id.eq.${parzelleId}`];
      // EGRID enthalten nur Buchstaben und Ziffern; geprüft, weil sie in
      // die Filterzeile eingesetzt wird.
      if (egrid && /^[A-Z0-9]+$/.test(egrid)) bedingung.push(`egrid.eq.${egrid}`, `nachbar_egrids.cs.{${egrid}}`);
      const r = await db().from('baugesuch')
        .select('id, publiziert_am, gemeinde, adresse, parzelle_nr, egrid, beschreibung, bauherrschaft, parzelle_id, nachbar_egrids, erfasst_am, quelle, publikation_nr, publikation_id, einsprache_bis, quelle_url')
        .or(bedingung.join(','))
        .order('publiziert_am', { ascending: false })
        .limit(50);
      if (r.error) throw r.error;
      return (r.data ?? []) as Gesuch[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const hier = (g: Gesuch) => g.parzelle_id === parzelleId || (!!egrid && g.egrid === egrid);
  const liste = data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg">Baugesuche hier und nebenan</h3>
        {liste.length > 0 && <span className="text-sm text-muted-foreground">{liste.length}</span>}
      </div>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gesucht …</p>}
      {!isLoading && liste.length === 0 && (
        <p className="text-sm text-muted-foreground">Seit Januar 2026 kein Baugesuch auf dieser Parzelle oder bei den Nachbarn.</p>
      )}
      {liste.length > 0 && (
        <ul className="divide-y rounded-[3px] border bg-card">
          {liste.map(g => {
            const b = belege(g);
            return (
              <li key={g.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {hier(g) ? <Marke art="heiss">Auf dieser Parzelle</Marke> : <Marke art="lila">Beim Nachbarn</Marke>}
                  <span className="text-muted-foreground">{datum(g.publiziert_am)}</span>
                  {g.einsprache_bis && <span className="text-muted-foreground">Einsprache bis {datum(g.einsprache_bis)}</span>}
                </div>
                <p className="font-medium">{[g.adresse, g.gemeinde].filter(Boolean).join(', ') || 'Ohne Adresse'}</p>
                {g.beschreibung && <p className="line-clamp-3 text-sm text-muted-foreground">{g.beschreibung}</p>}
                {b.length > 0 && (
                  <div className="flex flex-wrap gap-x-4">
                    {b.map(x => (
                      <a key={x.url} href={x.url} target={FENSTER.portal} className="inline-flex h-11 items-center gap-1 text-sm text-accent">
                        <ExternalLink className="h-3.5 w-3.5" /> {x.titel}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

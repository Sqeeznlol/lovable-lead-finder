import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Marke } from '@/components/rahmen';
import { PropertyDetailDialog } from '@/components/PropertyDetailDialog';
import type { Gesuch } from '@/lib/baugesuch-belege';

interface Parzelle {
  id: string; egrid: string | null; address: string; gemeinde: string | null; zone: string | null;
  area: number | null; kategorie: string | null; hnf_delta: number | null; marge_chf: number | null;
  owner_name: string | null; eigentuemer_name: string | null;
}

const n = (x: number) => Math.round(x).toLocaleString('de-CH');

/**
 * Welche Parzellen ein Baugesuch betrifft: das Baugrundstück und jeder
 * Nachbar, den der Ablauf "Baugesuche" beim Bund geholt hat. Julian
 * (1. November): "wenn ich auf Baugesuch klicke, muss auch kommen,
 * welche Parzellen noch betroffen sind." Ein Tipp öffnet die Parzelle.
 *
 * Gelesen über die EGRID -- dieselbe, mit der der Abgleich die Gesuche
 * zuordnet; Nachbarn ohne Eintrag im Bestand werden gezählt, nicht
 * verschwiegen.
 */
export function BetroffeneParzellen({ g }: { g: Gesuch }) {
  const [offen, setOffen] = useState<string | null>(null);
  // Nur echte EGRID (Buchstaben, Ziffern): sie stehen in der Filterzeile.
  const egrids = [...new Set([g.egrid, ...(g.nachbar_egrids ?? [])].filter((e): e is string => !!e && /^[A-Z0-9]+$/.test(e)))];
  const { data, isLoading } = useQuery({
    queryKey: ['baugesuch', g.id, 'parzellen', egrids.join(',')],
    enabled: egrids.length > 0 || !!g.parzelle_id,
    queryFn: async () => {
      let q = supabase.from('properties')
        .select('id, egrid, address, gemeinde, zone, area, kategorie, hnf_delta, marge_chf, owner_name, eigentuemer_name');
      q = egrids.length
        ? q.or([`egrid.in.(${egrids.join(',')})`, g.parzelle_id ? `id.eq.${g.parzelle_id}` : null].filter(Boolean).join(','))
        : q.eq('id', g.parzelle_id!);
      const r = await q.limit(60);
      if (r.error) throw r.error;
      return (r.data ?? []) as Parzelle[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const istBau = (p: Parzelle) => p.id === g.parzelle_id || (!!g.egrid && p.egrid === g.egrid);
  // Das Baugrundstück zuerst, dann die Nachbarn mit der grössten Marge.
  const liste = [...(data ?? [])].sort((a, b) => Number(istBau(b)) - Number(istBau(a)) || (b.marge_chf ?? 0) - (a.marge_chf ?? 0));
  const ohneEintrag = Math.max(0, egrids.length - (data ?? []).filter(p => p.egrid && egrids.includes(p.egrid)).length);

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Betroffene Parzellen</p>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gesucht …</p>}
      {!isLoading && liste.length === 0 && <p className="text-sm text-muted-foreground">Keine Parzelle im Bestand gefunden.</p>}
      {liste.length > 0 && (
        <ul className="divide-y rounded-[3px] border">
          {liste.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => setOffen(p.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary">
                <span className="min-w-0 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {istBau(p) ? <Marke art="heiss">Baugrundstück</Marke> : <Marke art="lila">Nachbar</Marke>}
                    <span className="font-medium">{p.address}</span>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {[p.gemeinde, p.zone, p.area ? `${n(p.area)} m²` : null, p.kategorie,
                      p.hnf_delta && p.hnf_delta > 0 ? `Reserve ${n(p.hnf_delta)} m²` : null,
                      (p.owner_name || p.eigentuemer_name) ? 'Eigentümer bekannt' : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm">
                  {p.marge_chf ? <span className="font-semibold text-violett">{(p.marge_chf / 1e6).toFixed(1)} Mio</span> : null}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ohneEintrag > 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">{ohneEintrag} {ohneEintrag === 1 ? 'Parzelle steht' : 'Parzellen stehen'} nicht im Bestand.</p>
      )}
      <PropertyDetailDialog id={offen} onClose={() => setOffen(null)} />
    </div>
  );
}

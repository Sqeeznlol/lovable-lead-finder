import { useQuery } from '@tanstack/react-query';
import { ObjektLink } from '@/components/ObjektLink';
import { supabase } from '@/integrations/supabase/client';

/**
 * "Gehört auch": die übrigen Parzellen desselben Eigentümers (Tims
 * Abschnitt 4, "one owner connects to all relevant properties"). Der
 * Eigentümer ist ein Akteur (Tabelle akteur, Beziehung eigentum); die
 * Funktion eigentuemer_verdichten füllt beides täglich aus dem Bestand.
 * Ohne Akteur oder ohne weitere Parzelle zeigt das Objektfenster nichts
 * -- kein leerer Kasten.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

interface Zeile { parzelle_id: string; adresse: string | null; gemeinde: string | null; egrid: string | null; area: number | null; quelle: string; geprueft: boolean }

export function WeitereParzellen({ parzelleId }: { parzelleId: string }) {
  const { data } = useQuery({
    queryKey: ['weitere-parzellen', parzelleId],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ name: string; art: string; zeilen: Zeile[] }[]> => {
      const e = await db().from('eigentum').select('akteur:akteur_id(id, name, art)').eq('parzelle_id', parzelleId).limit(5);
      if (e.error) return [];
      const akteure = ((e.data ?? []) as { akteur: { id: string; name: string; art: string } | null }[]).map(x => x.akteur).filter(Boolean) as { id: string; name: string; art: string }[];
      const aus = [];
      for (const a of akteure) {
        const r = await db().rpc('akteur_parzellen', { p_akteur: a.id });
        if (r.error) continue;
        const zeilen = ((r.data ?? []) as Zeile[]).filter(z => z.parzelle_id !== parzelleId);
        if (zeilen.length) aus.push({ name: a.name, art: a.art, zeilen });
      }
      return aus;
    },
  });
  if (!data?.length) return null;
  const m2 = (n: number | null) => (n ? `${Math.round(n).toLocaleString('de-CH')} m²` : null);
  return (
    <div className="space-y-2">
      {data.map(a => (
        <div key={a.name} className="space-y-1 rounded border bg-card p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.name} gehört auch · {a.zeilen.length} {a.zeilen.length === 1 ? 'Parzelle' : 'Parzellen'}</p>
          <ul className="divide-y">
            {a.zeilen.slice(0, 12).map(z => (
              <li key={z.parzelle_id} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
                <ObjektLink id={z.parzelle_id} className="truncate">{z.adresse ?? z.egrid ?? 'Parzelle'}{z.gemeinde ? ` · ${z.gemeinde}` : ''}</ObjektLink>
                <span className="shrink-0 text-xs text-muted-foreground">{[m2(z.area), z.geprueft ? 'geprüft' : z.quelle === 'bestand' ? 'aus dem Bestand' : z.quelle].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {a.zeilen.length > 12 && <li className="py-1.5 text-xs text-muted-foreground">und {a.zeilen.length - 12} weitere -- alle in der Eigentümersuche auf der Karte</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

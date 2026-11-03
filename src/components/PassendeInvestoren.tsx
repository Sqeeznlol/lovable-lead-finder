import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { lagenNorm, typenZuKategorien } from '@/lib/investor';

/**
 * Beide Seiten eines Geschäfts (Tims Abschnitt 6: "propose both sides
 * of a transaction from our own data"): zu einer verkaufsbereiten
 * Parzelle die Investoren, deren Suchprofil Lage und Objektart nennt.
 * Dieselben Regeln wie der Abgleich in der Datenbank (investor_lagen,
 * investor_kategorien), nur umgekehrt -- Profile sind wenige, das
 * rechnet der Browser.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

interface Profil { id: string; lagen: string[] | null; objekttypen: string[] | null; budget_max_chf: number | null; akteur: { name: string } | null }

const grund = (g: string | null) => (g ?? '').replace(/\s*\(?(ZH|TG)\)?$/, '').toLowerCase();

export function passtProfil(p: { lagen: string[] | null; objekttypen: string[] | null }, parzelle: { gemeinde: string | null; kategorie: string | null }): 'lage und art' | 'lage' | 'art' | null {
  const lagen = lagenNorm(p.lagen).map(grund);
  const kat = typenZuKategorien(p.objekttypen);
  const lage = lagen.length > 0 && !!parzelle.gemeinde && lagen.includes(grund(parzelle.gemeinde));
  const art = kat.length > 0 && !!parzelle.kategorie && kat.includes(parzelle.kategorie);
  if (lage && art) return 'lage und art';
  if (lage && kat.length === 0) return 'lage';
  if (art && lagen.length === 0) return 'art';
  return null;
}

export function PassendeInvestoren({ gemeinde, kategorie }: { gemeinde: string | null; kategorie: string | null }) {
  const { data } = useQuery({
    queryKey: ['investorprofile-aktiv'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Profil[]> => {
      const r = await db().from('investorprofil').select('id, lagen, objekttypen, budget_max_chf, akteur:akteur_id(name)').eq('aktiv', true).limit(500);
      return r.error ? [] : (r.data ?? []);
    },
  });
  const treffer = (data ?? []).map(p => ({ p, wie: passtProfil(p, { gemeinde, kategorie }) })).filter(x => x.wie);
  const chf = (n: number | null) => (n ? `bis ${(n / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 1 })} Mio.` : null);
  return (
    <div className="text-sm">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Passende Investoren</p>
      {!data ? <p className="text-muted-foreground">Suchprofile werden geladen …</p>
        : !treffer.length ? <p className="text-muted-foreground">{data.length ? 'Kein Suchprofil nennt diese Lage oder Objektart.' : 'Noch kein Investorprofil erfasst (Auswertung → Investoren).'}</p>
        : (
          <ul className="divide-y rounded border bg-card">
            {treffer.map(({ p, wie }) => (
              <li key={p.id} className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
                <span className="truncate font-medium">{p.akteur?.name ?? 'Investor'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{[wie === 'lage und art' ? 'Lage und Objektart' : wie === 'lage' ? 'Lage' : 'Objektart', chf(p.budget_max_chf)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

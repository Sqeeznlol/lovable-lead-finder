import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Analyse, Investor, Vorhaben } from '@/lib/vorhaben';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** Alle Vorhaben mit Kunde und Umfang -- eine Abfrage (Sicht vorhaben_liste). */
export function useVorhabenListe() {
  return useQuery({
    queryKey: ['vorhaben'],
    queryFn: async () => {
      const r = await db().from('vorhaben_liste').select('*').order('geaendert_am', { ascending: false }).limit(300);
      if (r.error) throw r.error;
      return (r.data ?? []) as Vorhaben[];
    },
    staleTime: 30 * 1000,
  });
}

/** Die Potenzialanalyse, in der Datenbank gerechnet (vorhaben_analyse). */
export function useAnalyse(id: string | null) {
  return useQuery({
    queryKey: ['vorhaben', id, 'analyse'],
    enabled: !!id,
    queryFn: async () => {
      const r = await db().rpc('vorhaben_analyse', { p_vorhaben: id });
      if (r.error) throw r.error;
      return r.data as Analyse;
    },
    staleTime: 60 * 1000,
  });
}

export interface Eintrag { id: string; am: string; von: string | null; art: 'notiz' | 'schritt'; text: string }

export function useVerlauf(id: string | null) {
  return useQuery({
    queryKey: ['vorhaben', id, 'verlauf'],
    enabled: !!id,
    queryFn: async () => {
      const r = await db().from('vorhaben_eintrag').select('id, am, von, art, text')
        .eq('vorhaben_id', id).order('am', { ascending: false }).limit(100);
      if (r.error) throw r.error;
      return (r.data ?? []) as Eintrag[];
    },
  });
}

/** Wie viele Adressen in welchem Zuordnungsstand -- für den ersten Schritt. */
export function useZuordnung(portfolioId: string | null) {
  return useQuery({
    queryKey: ['vorhaben', portfolioId, 'zuordnung'],
    enabled: !!portfolioId,
    queryFn: async () => {
      const zaehle = async (z: string) => {
        const r = await db().from('portfolio_position').select('id', { count: 'exact', head: true })
          .eq('portfolio_id', portfolioId).eq('zuordnung', z);
        return r.count ?? 0;
      };
      const [offen, zugeordnet, mehrdeutig, nicht] = await Promise.all(
        ['offen', 'zugeordnet', 'mehrdeutig', 'nicht gefunden'].map(zaehle));
      return { offen, zugeordnet, mehrdeutig, nicht };
    },
  });
}

export function useInvestoren(aktiv: boolean) {
  return useQuery({
    queryKey: ['investoren', 'profile'],
    enabled: aktiv,
    queryFn: async () => {
      const r = await db().from('investorprofil').select('id, lagen, objekttypen, budget_max_chf, akteur(name)').eq('aktiv', true).limit(500);
      if (r.error) throw r.error;
      return ((r.data ?? []) as (Omit<Investor, 'name'> & { akteur: { name: string } | null })[])
        .map(i => ({ ...i, name: i.akteur?.name ?? 'Ohne Namen' })) as Investor[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Die bekannten Kunden, als Vorschlag beim Erfassen. */
export function useKunden() {
  return useQuery({
    queryKey: ['kunden'],
    queryFn: async () => {
      const r = await db().from('mandant').select('akteur(name, art)').limit(500);
      if (r.error) throw r.error;
      const namen = ((r.data ?? []) as { akteur: { name: string; art: string } | null }[]).map(m => m.akteur).filter(Boolean);
      return [...new Map(namen.map(a => [a!.name, a!])).values()];
    },
    staleTime: 5 * 60 * 1000,
  });
}

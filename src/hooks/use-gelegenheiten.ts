import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Die Gelegenheiten mit Kunde und Parzellen -- für den Bereich
 * "Gelegenheiten" und für die Karte, die sie als Umrisse zeigt.
 */
export type Zustand = 'erkannt' | 'geprueft' | 'gemeldet' | 'in bearbeitung' | 'abgeschlossen' | 'verworfen';
export const ZUSTAENDE: [Zustand, string][] = [
  ['erkannt', 'Erkannt'], ['geprueft', 'Geprüft'], ['gemeldet', 'Dem Kunden gemeldet'],
  ['in bearbeitung', 'In Bearbeitung'], ['abgeschlossen', 'Abgeschlossen'], ['verworfen', 'Verworfen'],
];
export const ANLAESSE: Record<string, string> = {
  baugesuch: 'Baugesuch', arrondierung: 'Arrondierung', ausnuetzungsreserve: 'Ausnützungsreserve',
  zonenaenderung: 'Zonenänderung', investorentreffer: 'Investorentreffer', manuell: 'Manuell',
};

export interface Parz { id: string; address: string | null; owner_name: string | null; area: number | null; gemeinde: string | null; egrid: string | null }
export interface Gel {
  id: string; anlass: string; zustand: Zustand; titel: string; begruendung: string | null; zustaendig: string | null;
  erkannt_am: string; gemeldet_am: string | null; abgeschlossen_am: string | null; ergebnis: string | null;
  prioritaet: number | null; fremde_nachbarn: { egrid: string; nummer: string }[] | null;
  mandant: { id: string; akteur: { name: string } | null } | null;
  gelegenheit_parzelle: { rolle: string | null; parzelle: Parz | null }[];
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export function useGelegenheiten(aktiv = true) {
  return useQuery({
    queryKey: ['gelegenheiten'],
    enabled: aktiv,
    queryFn: async (): Promise<Gel[]> => {
      const r = await db().from('gelegenheit')
        .select('*, mandant:mandant_id(id, akteur:akteur_id(name)), '
          + 'gelegenheit_parzelle(rolle, parzelle:parzelle_id(id, address, owner_name, area, gemeinde, egrid))')
        .order('prioritaet', { ascending: false, nullsFirst: false })
        .order('erkannt_am', { ascending: false })
        .limit(500);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
}


/**
 * Offene Gelegenheiten in der Form, die die Karte für Portfolios schon
 * zeichnet: je Gelegenheit eine Gruppe mit ihren Parzellen. So zeigt
 * die Karte sie mit derselben Liste, demselben Aufklappen und demselben
 * Hinfliegen -- nur in einer anderen Farbe.
 */
export function alsKartengruppen(gel: Gel[]): import('@/hooks/use-portfolio').Portfolio[] {
  const ROLLE: Record<string, string> = { ausloeser: 'Auslöser', nachbar: 'Nachbar', 'im portfolio': 'Im Portfolio' };
  return gel
    .filter(g => g.zustand !== 'abgeschlossen' && g.zustand !== 'verworfen')
    .map(g => ({
      id: g.id,
      name: g.titel,
      eigner: g.mandant?.akteur?.name ?? null,
      manager: [ZUSTAENDE.find(z => z[0] === g.zustand)?.[1] ?? g.zustand],
      positionen: (g.gelegenheit_parzelle ?? [])
        .filter(x => x.parzelle)
        .map(x => ({
          id: `${g.id}:${x.parzelle!.id}`, parzelleId: x.parzelle!.id,
          adresse: x.parzelle!.address, egrid: x.parzelle!.egrid,
          parzelle: null, rolle: ROLLE[x.rolle ?? ''] ?? x.rolle, flaeche: x.parzelle!.area, zone: null,
        })),
    }))
    .filter(g => g.positionen.length > 0);
}

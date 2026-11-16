import { supabase } from '@/integrations/supabase/client';

/**
 * Stand und Umfang der grossen Tabellen, so wie die Datenbank sie
 * vorab gezählt hat (Funktion `daten_stand`, Ablage `daten_zaehlung`).
 *
 * Warum nicht bei jedem Öffnen zählen: am 16. November brachte allein
 * der Reiter «Auswertung» die Datenbank zum Stocken. Er zählte die
 * Parzellen mit Eigentümer und mit Telefon je zweimal, dazu Gebäude,
 * 1.2 Millionen Nachbarschaftspaare und eine halbe Million Punkte.
 * Diese Zahlen ändern sich nur, wenn Daten geladen werden; darum zählt
 * sie ein Ablauf (jede Nacht und nach jedem Laden), und die Seite
 * zeigt die Zahl samt dem Zeitpunkt der Zählung.
 */
export interface DatenStand {
  gezaehlt_am: string | null;
  parzellen: number | null;
  mit_eigentuemer: number | null;
  mit_telefon: number | null;
  mit_umriss: number | null;
  nachbarn_gerechnet: number | null;
  gebaeude: string | null;
  gebaeude_n: number | null;
  gebaeude_parzellen: number | null;
  baugesuch: string | null;
  baugesuch_n: number | null;
  nachbarschaft: string | null;
  nachbarschaft_n: number | null;
  punkte: string | null;
  punkte_n: number | null;
  potenzial_annahmen: string | null;
}

export async function datenStandLaden(): Promise<DatenStand | null> {
  const r = await supabase.rpc('daten_stand');
  return r.error ? null : (r.data as unknown as DatenStand);
}

/** Ein Schlüssel für alle, die den Stand brauchen: so fragt die Seite ihn einmal, nicht je Abschnitt. */
export const DATEN_STAND = { queryKey: ['daten-stand'], queryFn: datenStandLaden, staleTime: 5 * 60 * 1000 };

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Die Nachbarn einer Parzelle.
 *
 * Das ist die Frage, an der Arrondierung, Baugesuch-Meldungen und die
 * Nachbarschaftsanalyse gleichermassen hängen -- und bis heute war sie
 * nicht beantwortbar: gespeichert waren nur EGRID, Adresse und
 * Gemeindenummer. Aus zwei Adressen an derselben Strasse lässt sich
 * nicht ableiten, ob die Grundstücke aneinandergrenzen.
 *
 * Gerechnet wird nicht hier, sondern einmal in der Datenbank
 * (`nachbarschaft_rechnen`). ST_Touches über 396'271 Polygone ist
 * nichts für den Klick eines Benutzers; hier wird nur nachgeschlagen.
 *
 * Gelesen wird über die Fremdschlüssel-Beziehung statt über die Sicht
 * `nachbarn`: so bleibt es ein Weg in die Datenbank, und die
 * Zugriffsregeln der beiden Tabellen gelten unverändert.
 */
export interface Nachbar {
  id: string;
  address: string | null;
  parzelle: string | null;
  gemeinde: string | null;
  area: number | null;
  zone: string | null;
  owner_name: string | null;
  grenzlaenge_m: number | null;
}

interface Zeile {
  grenzlaenge_m: number | null;
  nachbar: {
    id: string;
    address: string | null;
    parzelle: string | null;
    gemeinde: string | null;
    area: number | null;
    zone: string | null;
    owner_name: string | null;
  } | null;
}

export function useNachbarn(parzelleId: string | null) {
  return useQuery({
    queryKey: ['nachbarn', parzelleId],
    enabled: !!parzelleId,
    queryFn: async (): Promise<Nachbar[]> => {
      // Die erzeugten Typen kennen die neuen Tabellen noch nicht --
      // dieselbe Lage wie bei `aktivitaet` in lib/protokoll.ts. Sie
      // werden mit dem nächsten Lauf der Typerzeugung nachgezogen.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from('nachbarschaft')
        .select(
          'grenzlaenge_m,' +
          'nachbar:properties!nachbarschaft_nachbar_id_fkey' +
          '(id,address,parzelle,gemeinde,area,zone,owner_name)',
        )
        .eq('parzelle_id', parzelleId as string)
        // Die längste gemeinsame Grenze zuerst: wer arrondieren will,
        // interessiert sich für den Nachbarn, mit dem man sich eine
        // halbe Parzellenbreite teilt, nicht für den, der die Ecke
        // berührt.
        .order('grenzlaenge_m', { ascending: false, nullsFirst: false })
        .limit(30);

      if (error) throw error;

      return ((data ?? []) as unknown as Zeile[])
        .filter(z => z.nachbar)
        .map(z => ({ ...z.nachbar!, grenzlaenge_m: z.grenzlaenge_m }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

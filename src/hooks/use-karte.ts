import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Die Parzellenumrisse für einen Kartenausschnitt.
 *
 * Geholt wird über eine Funktion in der Datenbank, nicht über die
 * Tabelle: PostgREST gibt eine Geometriespalte als WKB-Hex zurück,
 * und das im Browser zu zerlegen wäre Arbeit für nichts. Die
 * Funktion liefert fertiges GeoJSON.
 *
 * Nach Ausschnitt und nicht alles: im Thurgau stehen 137'214
 * Parzellen; sie alle zu schicken wären Dutzende Megabyte je
 * Kartenbewegung.
 */
export interface ParzelleEigenschaften {
  adresse: string | null;
  parzelle: string | null;
  gemeinde: string | null;
  flaeche: number | null;
  zone: string | null;
  marge: number | null;
  ausgeschlossen: boolean | null;
}

export interface Ausschnitt {
  west: number;
  sued: number;
  ost: number;
  nord: number;
}

/** Auf drei Nachkommastellen gerundet -- sonst eine Abfrage je Pixel. */
function grob(a: Ausschnitt) {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `${r(a.west)},${r(a.sued)},${r(a.ost)},${r(a.nord)}`;
}

export function useParzellenImAusschnitt(a: Ausschnitt | null, aktiv: boolean) {
  return useQuery({
    queryKey: ['karte', a ? grob(a) : null],
    enabled: aktiv && !!a,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Die erzeugten Typen kennen die neue Funktion noch nicht --
      // dieselbe Lage wie bei `aktivitaet` in lib/protokoll.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.rpc('parzellen_karte', {
        p_west: a!.west, p_sued: a!.sued,
        p_ost: a!.ost, p_nord: a!.nord,
        p_menge: 1200,
      });
      if (error) throw error;
      return data as GeoJSON.FeatureCollection<
        GeoJSON.Polygon | GeoJSON.MultiPolygon, ParzelleEigenschaften
      >;
    },
  });
}

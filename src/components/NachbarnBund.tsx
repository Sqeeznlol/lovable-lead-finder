import { useQuery } from '@tanstack/react-query';
import { Loader2, Map } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { esriRinge } from '@/lib/karte-ebenen';

/**
 * Die Nachbarn vom Bund, wenn der eigene Umriss fehlt.
 *
 * In Zürich ist kein Umriss eingelesen -- gemessen am 1. November:
 * 137'209 Parzellen mit Geometrie, alle im Thurgau. Ohne Umriss
 * rechnet die Datenbank keine Nachbarschaft, und das Objektfenster
 * sagte nur, dass der Kanton noch fehlt. Der Bund kennt die Grenzen
 * aber: `identify` mit dem Umriss als Polygon liefert jede Parzelle,
 * die ihn berührt -- gemessen: 23 Treffer für ein Quadrat von hundert
 * Metern in Zürich, mit `egris_egrid` und `number`.
 *
 * Das hier ist nicht so gut wie die eigene Rechnung: keine Grenzlänge,
 * keine Sortierung danach, und der Dienst muss antworten. Aber es ist
 * eine Antwort statt eines Hinweises. Was wir von den Nachbarn schon
 * wissen -- Adresse, Eigentümer -- kommt aus dem Bestand dazu.
 */
interface Nachbar {
  egrid: string;
  nummer: string;
  id?: string;
  adresse?: string | null;
  eigentuemer?: string | null;
}

export function NachbarnBund({ umriss, egrid, onOeffnen }: {
  /** In LV95, wie identify ihn liefert. */
  umriss: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  egrid?: string | null;
  onOeffnen?: (id: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['nachbarn-bund', egrid ?? JSON.stringify(umriss).slice(0, 300)],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Nachbar[]> => {
      const ringe = esriRinge(umriss);
      const punkte = ringe.flat();
      const xs = punkte.map(p => p[0]), ys = punkte.map(p => p[1]);
      // identify verlangt einen Kartenausschnitt; fünfzig Meter Rand reichen.
      const ausschnitt = [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50];
      const p = new URLSearchParams({
        geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon',
        sr: '2056', tolerance: '0', returnGeometry: 'false',
        layers: 'all:ch.kantone.cadastralwebmap-farbe',
        mapExtent: ausschnitt.join(','), imageDisplay: '600,600,96', lang: 'de',
      });
      const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?${p}`)).json();
      const treffer = ((j?.results ?? []) as { attributes?: Record<string, unknown> }[])
        .map(r => ({ egrid: String(r.attributes?.egris_egrid ?? ''), nummer: String(r.attributes?.number ?? '') }))
        // Die Parzelle selbst ist kein Nachbar; und eine Parzelle kann
        // aus mehreren Flächen bestehen, dann kommt sie doppelt.
        .filter(t => /^CH[0-9A-Z]{12}$/.test(t.egrid) && t.egrid !== egrid);
      const eindeutig = [...new Map(treffer.map(t => [t.egrid, t])).values()];
      if (eindeutig.length === 0) return [];

      const { data: eigene } = await supabase.from('properties')
        .select('id, egrid, address, owner_name')
        .in('egrid', eindeutig.map(t => t.egrid));
      const bekannt = new Map((eigene ?? []).map(z => [z.egrid ?? '', z]));
      return eindeutig
        .map(t => {
          const z = bekannt.get(t.egrid);
          return { ...t, id: z?.id, adresse: z?.address ?? null, eigentuemer: z?.owner_name ?? null };
        })
        // Was im Bestand ist, zuerst; dann nach Nummer.
        .sort((a, b) => Number(!a.id) - Number(!b.id) || a.nummer.localeCompare(b.nummer, 'de', { numeric: true }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Nachbarn beim Bund …
      </div>
    );
  }
  if (isError) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Der Bundesdienst antwortet nicht; die Nachbarn fehlen deshalb.
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Der Bund kennt hier keine angrenzende Parzelle.
      </p>
    );
  }
  const imBestand = data.filter(n => n.id).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Map className="h-3.5 w-3.5" />
        {data.length} angrenzende Parzellen laut Bund{imBestand ? `, ${imBestand} davon im Bestand` : ''}.
      </div>
      <div className="divide-y rounded-lg border">
        {data.map(n => (
          <button
            key={n.egrid}
            type="button"
            disabled={!n.id || !onOeffnen}
            onClick={() => n.id && onOeffnen?.(n.id)}
            className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm
                       enabled:hover:bg-muted/50 disabled:cursor-default"
          >
            <span className="min-w-0 flex-1 truncate">
              {n.adresse || `Parzelle ${n.nummer || '?'}`}
              {n.eigentuemer && <span className="text-muted-foreground"> · {n.eigentuemer}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {n.id ? 'im Bestand' : n.nummer}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Map as Karte2D } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUrlSetzen, useUrlWert } from '@/hooks/use-url-wert';
import { Karte3D } from '@/components/karte3d/Karte3D';
import { parzelleMitte } from '@/lib/karte3d';

// Ohne Objekt: Albisrieden, das Quartier aus dem Video von Spektrum.
const START = { lat: 47.3790, lon: 8.4880 };

/**
 * Die 3D-Karte als eigener Bereich (/karte3d). Mit ?objekt=<id> fliegt
 * sie zu dieser Parzelle, färbt ihre Häuser und zieht den Umriss nach.
 * Nicht "?parzelle": das öffnet überall die Objektansicht.
 */
export function Karte3DSeite({ onSchliessen }: { onSchliessen?: () => void }) {
  const navigate = useNavigate();
  const [objekt] = useUrlWert('objekt');
  const [latW] = useUrlWert('lat');
  const [lonW] = useUrlWert('lon');
  const setzen = useUrlSetzen();
  const { data: p } = useQuery({
    queryKey: ['karte3d-objekt', objekt],
    enabled: !!objekt,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).from('properties').select('id, egrid, address, gemeinde').eq('id', objekt).maybeSingle();
      if (r.error || !r.data) return null;
      const ort = r.data.egrid ? await parzelleMitte(r.data.egrid) : null;
      return { ...r.data, ort } as { id: string; egrid: string | null; address: string | null; gemeinde: string | null; ort: { lat: number; lon: number } | null };
    },
  });
  const ziel = useMemo(() => {
    if (p?.ort) return { ...p.ort, abstand: 380 };
    if (objekt) return null;
    const lat = Number(latW), lon = Number(lonW);
    // Nur Punkte in der Schweiz annehmen; sonst der Start.
    return lat > 45.7 && lat < 47.9 && lon > 5.9 && lon < 10.6 ? { lat, lon } : START;
  }, [p, objekt, latW, lonW]);
  const markiert = useMemo(() => (p?.egrid ? [{ egrid: p.egrid, farbe: '#3D45F5', titel: p.address ?? undefined }] : []), [p]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 pt-[env(safe-area-inset-top)] sm:px-4">
        <button type="button" onClick={() => (onSchliessen ? onSchliessen() : navigate(-1))} aria-label="Zurück"
                className="grid h-11 w-11 place-items-center rounded-[3px] hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold">{p?.address ?? (objekt ? 'Objekt wird gesucht …' : '3D-Karte')}</span>
          <span className="block truncate text-xs text-muted-foreground">{p?.gemeinde ?? 'Gebäude, Dächer und Zonen vom Bund und Kanton'}</span>
        </span>
        <button type="button" onClick={() => navigate('/karte')}
                className="inline-flex h-11 items-center gap-2 rounded-[3px] border bg-card px-3 text-sm hover:bg-secondary"><Karte2D className="h-4 w-4" /> 2D</button>
      </div>
      <div className="min-h-0 flex-1">
        {/* Ein gesuchter Ort kommt in die Adresse: Neu laden und Teilen zeigen dieselbe Stelle. */}
        <Karte3D ziel={ziel} markiert={markiert} start="modell"
          onOrt={o => setzen({ lat: o.lat.toFixed(6), lon: o.lon.toFixed(6), objekt: null })} />
      </div>
    </div>
  );
}

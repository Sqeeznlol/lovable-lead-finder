import { useEffect, useState } from 'react';
import { ExternalLink, ImageOff, Loader2 } from 'lucide-react';
import { geocode, luftbildTileUrl, swisstopoMapUrl, type GeoCoords } from '@/lib/swisstopo';

interface Props {
  address: string;
  plzOrt?: string | null;
  className?: string;
}

/**
 * Luftbild zur Adresse aus SWISSIMAGE (swisstopo). Kostenlos und ohne API-Key —
 * bewusst nicht Google Static Maps, das pro Abruf verrechnet wird.
 *
 * Zeigt 2×2 Kacheln um den Punkt, damit auch grössere Parzellen ganz sichtbar
 * sind, und verlinkt auf die interaktive Karte für den Detailblick.
 */
export function Luftbild({ address, plzOrt, className }: Props) {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [state, setState] = useState<'laden' | 'ok' | 'leer' | 'fehler'>('laden');

  useEffect(() => {
    const ctrl = new AbortController();
    const full = [address, plzOrt].filter(Boolean).join(', ');
    setState('laden');
    setCoords(null);

    geocode(full, ctrl.signal)
      .then(c => {
        if (ctrl.signal.aborted) return;
        setCoords(c);
        setState(c ? 'ok' : 'leer');
      })
      .catch(err => {
        if (ctrl.signal.aborted || err?.name === 'AbortError') return;
        setState('fehler');
      });

    return () => ctrl.abort();
  }, [address, plzOrt]);

  if (state === 'laden') {
    return (
      <div className={`grid min-h-[180px] place-items-center rounded-2xl bg-muted/40 ${className || ''}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state !== 'ok' || !coords) {
    return (
      <div className={`grid min-h-[180px] place-items-center gap-1 rounded-2xl bg-muted/40 text-center ${className || ''}`}>
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {state === 'fehler' ? 'Luftbild nicht erreichbar' : 'Adresse nicht gefunden'}
        </p>
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-muted/40 ${className || ''}`}>
      <img
        src={luftbildTileUrl(coords.lat, coords.lon)}
        alt={`Luftbild ${address}`}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setState('fehler')}
      />
      <a
        href={swisstopoMapUrl(coords.lat, coords.lon)}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium backdrop-blur transition-opacity"
      >
        swisstopo <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

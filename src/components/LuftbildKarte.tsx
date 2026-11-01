import { useEffect, useState } from 'react';
import { geocode, luftbildTileUrl } from '@/lib/swisstopo';
import { luftbildWgs } from '@/lib/luftbild';

/**
 * Das Luftbild einer Adresse als Bildfläche, für Objektkarten wie in der
 * Vorlage (ohne Rahmen und Link, anders als Luftbild.tsx).
 * Erst ein Ausschnitt (WMS); schlägt der fehl, die Kachel (WMTS); ohne
 * Ort eine ruhige graue Fläche -- kein Ersatzbild, das etwas vortäuscht.
 */
export function LuftbildKarte({ adresse, className = '' }: { adresse: string | null; className?: string }) {
  const [ort, setOrt] = useState<{ lat: number; lon: number } | null>(null);
  const [stufe, setStufe] = useState<'wms' | 'kachel' | 'keins'>('wms');

  useEffect(() => {
    if (!adresse) { setStufe('keins'); return; }
    const c = new AbortController();
    geocode(adresse, c.signal).then(g => (g ? setOrt(g) : setStufe('keins'))).catch(() => setStufe('keins'));
    return () => c.abort();
  }, [adresse]);

  const src = !ort || stufe === 'keins' ? null : stufe === 'wms' ? luftbildWgs(ort.lat, ort.lon) : luftbildTileUrl(ort.lat, ort.lon, 18);
  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      {src && (
        <img src={src} alt={`Luftbild ${adresse}`} loading="lazy" decoding="async"
             onError={() => setStufe(s => (s === 'wms' ? 'kachel' : 'keins'))}
             className="h-full w-full object-cover" />
      )}
      {src && <span className="absolute bottom-1 right-2 text-[10px] text-white/90 [text-shadow:0_0_3px_rgba(0,0,0,.6)]">© swisstopo</span>}
    </div>
  );
}

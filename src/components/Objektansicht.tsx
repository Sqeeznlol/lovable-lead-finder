import { useEffect, useState } from 'react';
import { ExternalLink, ImageOff, Loader2 } from 'lucide-react';
import {
  geocode,
  luftbildTileUrl,
  bauzonenTileUrl,
  ZONEN_ZOOM,
  swisstopoMapUrl,
  oerebUrl,
  oerebParzelleUrl,
  katasterUrl,
  streetViewLinkUrl,
  streetViewEmbedUrl,
  gemeindeBfsNr,
  type GeoCoords,
} from '@/lib/swisstopo';

type Modus = 'luft' | 'zone' | 'strasse';

const REITER: { wert: Modus; label: string }[] = [
  { wert: 'luft', label: 'Luftbild' },
  { wert: 'zone', label: 'Zone' },
  { wert: 'strasse', label: 'Strasse' },
];

interface Props {
  address: string;
  plzOrt?: string | null;
  /** Parzellennummer -- damit der Kataster die Parzelle auswählt statt nur die Stelle zu zeigen. */
  parzelle?: string | null;
  /** Gemeindenummer (BFS), grenzt die Suche nach der Parzelle ein. */
  bfsNr?: string | number | null;
  /** Gemeindename -- daraus wird die Nummer geholt, wenn sie fehlt. */
  gemeinde?: string | null;
  /** Kanton -- jeder führt seinen eigenen ÖREB-Kataster. */
  kanton?: string | null;
  className?: string;
}

/**
 * Drei Blicke auf dasselbe Grundstück, umschaltbar.
 *
 *   Luftbild  — wie es heute aussieht: Zuschnitt, Dachform, Nachbarschaft
 *   Zone      — dieselbe Stelle mit den Bauzonen darüber: wo endet die Zone
 *   Strasse   — wie es von unten aussieht
 *
 * Luftbild und Zonen kommen von swisstopo beziehungsweise vom Bund und sind
 * frei abrufbar. Die Strassenansicht liegt bei Google: einbetten geht nur
 * über die Maps Embed API, die einen Schlüssel verlangt. Das Einbetten selbst
 * kostet nichts, ohne Schlüssel bleibt aber nur der Link -- deshalb steht
 * dort eine Schaltfläche, solange VITE_GOOGLE_MAPS_KEY fehlt.
 */
export function Objektansicht({ address, plzOrt, parzelle, bfsNr, gemeinde, kanton, className }: Props) {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [stand, setStand] = useState<'laden' | 'ok' | 'leer' | 'fehler'>('laden');
  const [modus, setModus] = useState<Modus>('luft');
  // Die Zonenkachel deckt nicht jeden Ort ab. Schlägt sie fehl, bleibt das
  // Luftbild darunter sichtbar statt einer kaputten Grafik.
  const [zoneFehlt, setZoneFehlt] = useState(false);
  // In den importierten Daten fehlt die Gemeindenummer durchgehend. Ohne sie
  // findet der Kataster die Parzelle nicht -- sie wird deshalb einmal je
  // Gemeinde beim Bund nachgeschlagen.
  const [bfsGeholt, setBfsGeholt] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const voll = [address, plzOrt].filter(Boolean).join(', ');
    setStand('laden');
    setCoords(null);

    geocode(voll, ctrl.signal)
      .then(c => {
        if (ctrl.signal.aborted) return;
        setCoords(c);
        setStand(c ? 'ok' : 'leer');
      })
      .catch(err => {
        if (ctrl.signal.aborted || err?.name === 'AbortError') return;
        setStand('fehler');
      });

    return () => ctrl.abort();
  }, [address, plzOrt]);

  useEffect(() => {
    if (bfsNr != null && String(bfsNr).trim() !== '') return;
    if (!gemeinde || !parzelle) return;
    const ctrl = new AbortController();
    gemeindeBfsNr(gemeinde, ctrl.signal)
      .then(nr => { if (!ctrl.signal.aborted) setBfsGeholt(nr); })
      .catch(() => { /* Ohne Nummer bleibt der Link auf die Adresse. */ });
    return () => ctrl.abort();
  }, [gemeinde, parzelle, bfsNr]);

  const rahmen = `relative overflow-hidden rounded-2xl bg-muted/40 ${className || ''}`;

  if (stand === 'laden') {
    return (
      <div className={`grid place-items-center ${rahmen}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stand !== 'ok' || !coords) {
    return (
      <div className={`grid place-items-center gap-1 text-center ${rahmen}`}>
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <p className="px-2 text-xs text-muted-foreground">
          {stand === 'fehler' ? 'Karte nicht erreichbar' : 'Adresse nicht gefunden'}
        </p>
      </div>
    );
  }

  const { lat, lon } = coords;
  const bfs = bfsNr != null && String(bfsNr).trim() !== '' ? bfsNr : bfsGeholt;
  const parzellenLink = oerebParzelleUrl(parzelle, bfs);
  const kataster = katasterUrl(kanton, lat, lon, parzelle, bfs);
  const eigenerKanton = String(kanton ?? '').trim().toUpperCase() === 'TG';
  const einbettung = modus === 'strasse' ? streetViewEmbedUrl(lat, lon) : null;

  // Bisher zeigte die Kachel nur den Link zum gerade gewaehlten Reiter --
  // wer den Kataster wollte, musste erst auf "Zone" wechseln. Die drei
  // Ziele haengen aber nicht am Bild, sondern am Ort: sie stehen jetzt
  // alle drei nebeneinander da.
  const links = [
    { label: 'swisstopo', href: swisstopoMapUrl(lat, lon) },
    {
      label: eigenerKanton ? 'Kataster TG'
        : parzellenLink ? 'Parzelle im Kataster' : 'ÖREB-Kataster',
      href: kataster,
    },
    { label: 'Street View', href: streetViewLinkUrl(lat, lon) },
  ];

  return (
    <div className={rahmen}>
      {modus !== 'strasse' && (
        <>
          <img
            src={luftbildTileUrl(lat, lon, modus === 'zone' ? ZONEN_ZOOM : 19)}
            alt={`Luftbild ${address}`}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setStand('fehler')}
          />
          {/* Die Bauzonen liegen halbtransparent über dem Luftbild, damit
              Grundstücksgrenze und Zonengrenze zugleich sichtbar sind --
              genau daran entscheidet sich, wie viel bebaubar ist. */}
          {modus === 'zone' && !zoneFehlt && (
            <img
              src={bauzonenTileUrl(lat, lon)}
              alt={`Bauzonen ${address}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-multiply"
              onError={() => setZoneFehlt(true)}
            />
          )}
          {modus === 'zone' && zoneFehlt && (
            <div className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-center text-[11px] text-muted-foreground backdrop-blur">
              Keine Zonendaten an dieser Stelle
            </div>
          )}
        </>
      )}

      {modus === 'strasse' && (
        einbettung ? (
          <iframe
            src={einbettung}
            title={`Strassenansicht ${address}`}
            loading="lazy"
            className="h-full w-full border-0"
            allowFullScreen
          />
        ) : (
          <a
            href={streetViewLinkUrl(lat, lon)}
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-full w-full place-items-center gap-1 p-3 text-center transition-colors hover:bg-muted/60"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Street View öffnen
            </span>
          </a>
        )
      )}

      {/* Reiter unten, damit sie das Bild nicht verdecken */}
      <div className="absolute inset-x-0 top-0 flex gap-0.5 p-1">
        {REITER.map(r => (
          <button
            key={r.wert}
            type="button"
            onClick={e => { e.stopPropagation(); setModus(r.wert); }}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur transition-colors ${
              modus === r.wert
                ? 'bg-foreground text-background'
                : 'bg-background/70 text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="absolute inset-x-1 bottom-1 flex flex-wrap justify-end gap-1">
        {links.map(l => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur"
          >
            {l.label} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

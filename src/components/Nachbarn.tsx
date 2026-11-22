import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useNachbarn } from '@/hooks/use-nachbarn';

/**
 * Die angrenzenden Grundstücke zu einem Objekt.
 *
 * Erscheint nur, wenn es welche gibt. Solange die Umrisse eines
 * Kantons nicht eingelesen sind, steht hier nichts -- das ist
 * richtiger, als einen leeren Kasten mit der Überschrift "Nachbarn"
 * zu zeigen, der aussieht, als gäbe es keine.
 */
export function Nachbarn({
  parzelleId,
  onOeffnen,
  ohneUmriss,
}: {
  parzelleId: string;
  onOeffnen?: (id: string) => void;
  /** Was stattdessen steht, wenn kein Umriss eingelesen ist -- etwa die Nachbarn vom Bund. */
  ohneUmriss?: ReactNode;
}) {
  const { data, isLoading } = useNachbarn(parzelleId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Nachbarn …
      </div>
    );
  }
  if (!data) return null;

  const { umrissDa, nachbarn } = data;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">
          Angrenzende Grundstücke
          {umrissDa && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {nachbarn.length}
            </span>
          )}
        </h3>
      </div>

      {/* Drei Faelle, und sie sind nicht dasselbe: kein Umriss
          geladen, Umriss da aber ohne Nachbarn, oder Nachbarn.
          Frueher erschien in den ersten beiden Faellen gar nichts --
          dann sieht es aus, als gaebe es die Funktion nicht. */}
      {!umrissDa && (ohneUmriss ?? (
        // Eine Zeile statt eines gestrichelten Kastens: es ist ein Hinweis, keine Fläche zum Ausfüllen.
        <p className="text-sm text-muted-foreground">Erst mit der Vermessung des Kantons.</p>
      ))}
      {umrissDa && nachbarn.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine im Bestand; die Nachbarn liegen ausserhalb der geladenen Parzellen.</p>
      )}

      <div className={nachbarn.length ? 'divide-y rounded-lg border' : 'hidden'}>
        {nachbarn.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => onOeffnen?.(n.id)}
            disabled={!onOeffnen}
            className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm
                       enabled:hover:bg-muted/50 disabled:cursor-default"
          >
            <span className="min-w-0 flex-1 truncate">
              {n.address || `Parzelle ${n.parzelle ?? '?'}`}
              {n.gemeinde && (
                <span className="text-muted-foreground"> · {n.gemeinde}</span>
              )}
            </span>
            {n.area != null && (
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {Math.round(n.area).toLocaleString('de-CH')} m²
              </span>
            )}
            {n.grenzlaenge_m != null && (
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {Math.round(n.grenzlaenge_m)} m Grenze
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

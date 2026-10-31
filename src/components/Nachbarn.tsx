import { Loader2, Map } from 'lucide-react';
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
}: {
  parzelleId: string;
  onOeffnen?: (id: string) => void;
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
        <Map className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">
          Angrenzende Grundstücke
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {nachbarn.length}
          </span>
        </h3>
      </div>

      {/* Drei Faelle, und sie sind nicht dasselbe: kein Umriss
          geladen, Umriss da aber ohne Nachbarn, oder Nachbarn.
          Frueher erschien in den ersten beiden Faellen gar nichts --
          dann sieht es aus, als gaebe es die Funktion nicht. */}
      {!umrissDa && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Für dieses Grundstück ist noch kein Umriss eingelesen. Die
          Nachbarn stehen erst da, wenn die amtliche Vermessung des
          Kantons geladen ist.
        </p>
      )}
      {umrissDa && nachbarn.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Keine angrenzenden Grundstücke im Bestand — die Nachbarn
          liegen ausserhalb der geladenen Parzellen.
        </p>
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

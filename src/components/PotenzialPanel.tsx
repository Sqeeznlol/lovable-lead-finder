import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Info, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  calculatePotential,
  potentialScore,
  potentialTier,
  formatChf,
  formatM2,
  type PotentialInput,
  type PotentialConfig,
} from '@/lib/potential';

interface Props {
  property: PotentialInput;
  config?: PotentialConfig;
  /** Kompakte Darstellung für Listen/Karten. */
  compact?: boolean;
}

const TIER_STYLE: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  B: 'bg-primary/15 text-primary border-primary/30',
  C: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  D: 'bg-muted text-muted-foreground border-border',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  hoch: 'Verlässlich — AZ und Geschosse aus den Objektdaten',
  mittel: 'Mittel — AZ aus der Zonentabelle',
  tief: 'Grob — mehrere Annahmen nötig',
  keine: 'Nicht berechenbar — Grundstück oder Gebäudefläche fehlt',
};

/**
 * Zeigt das Ausbaupotenzial einer Liegenschaft: wie viel Geschossfläche die
 * Zone noch hergibt, was ein Ausbau kostet und was er einbringt. Macht dabei
 * transparent, worauf die Zahlen beruhen — inklusive Killer-Kriterien.
 */
export function PotenzialPanel({ property, config, compact }: Props) {
  const r = useMemo(() => calculatePotential(property, config), [property, config]);
  const score = useMemo(() => potentialScore(property, config, r), [property, config, r]);
  const tier = potentialTier(score);

  if (r.reserveGf === null) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Potenzial nicht berechenbar — {!property.area ? 'Grundstücksfläche' : 'Gebäudefläche'} fehlt.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${TIER_STYLE[tier]}`}>{tier}</span>
        <span className="text-xs font-semibold">{formatM2(r.reserveGf)}</span>
        <span className="text-xs text-muted-foreground">Reserve</span>
        {r.killer.length > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Ausbaupotenzial</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-help">{r.confidence}</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{CONFIDENCE_LABEL[r.confidence]}</TooltipContent>
          </Tooltip>
        </div>
        <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border-2 ${TIER_STYLE[tier]}`}>
          <span className="text-lg font-black leading-none">{score}</span>
          <span className="text-xs font-medium opacity-70">TIER {tier}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kennzahl
          label="HNF erreichbar"
          value={formatM2(r.hnfNeu)}
          hint={r.vollgeschosse ? `${r.anrechenbareGeschosse} anrechenbare Gesch.` : undefined}
          highlight
        />
        <Kennzahl label="HNF Bestand" value={formatM2(r.hnfBestand)} />
        <Kennzahl
          label="HNF zusätzlich"
          value={formatM2(r.hnfDelta)}
          hint={r.hnfBestand ? `+${Math.round((r.hnfDelta! / r.hnfBestand) * 100)}%` : undefined}
          highlight
        />
        <Kennzahl
          label="Reserve aGF"
          value={formatM2(r.reserveGf)}
          hint={r.az ? `AZ ${r.az.toFixed(2)}` : undefined}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 border-t pt-3">
        <Kennzahl label="Investition" value={formatChf(r.investition)} />
        <Kennzahl label="Erlös (Schätzung)" value={formatChf(r.erloes)} />
        <Kennzahl
          label="Marge"
          value={formatChf(r.marge)}
          hint={r.margeQuote != null ? `${Math.round(r.margeQuote * 100)}%` : undefined}
          highlight={(r.marge ?? 0) > 0}
        />
      </div>

      {r.killer.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          {r.killer.map(k => (
            <span key={k} className="text-xs font-medium text-amber-700 dark:text-amber-400">{k}</span>
          ))}
        </div>
      )}

      {r.assumptions.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Layers3 className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Annahmen: {r.assumptions.join(' · ')}. Grobabschätzung — massgebend ist die BZO der Gemeinde.</span>
        </p>
      )}
    </div>
  );
}

function Kennzahl({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-background/60 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

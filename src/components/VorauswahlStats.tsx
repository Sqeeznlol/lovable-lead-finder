import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Clock, CheckCircle2, XCircle, BarChart3, Layers, CalendarDays, Target } from 'lucide-react';

interface StatsData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  todayProcessed: number;
  weekProcessed: number;
  conversionRate: number;
  progressPercent: number;
}

interface VorauswahlStatsBarProps {
  stats: StatsData | undefined;
  filteredCount?: number;
  showFiltered?: boolean;
}

const statItems = [
  { key: 'total', label: 'Insgesamt', icon: Layers, colorClass: 'text-foreground' },
  { key: 'pending', label: 'Offen', icon: Clock, colorClass: 'text-amber-500' },
  { key: 'approved', label: 'Interessant', icon: CheckCircle2, colorClass: 'text-emerald-500' },
  { key: 'rejected', label: 'Nicht int.', icon: XCircle, colorClass: 'text-destructive' },
  { key: 'todayProcessed', label: 'Heute', icon: TrendingUp, colorClass: 'text-primary' },
] as const;

export function VorauswahlStatsBar({ stats, filteredCount, showFiltered }: VorauswahlStatsBarProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {statItems.map(s => {
          const value = stats?.[s.key] ?? 0;
          const Icon = s.icon;
          return (
            <div key={s.key} className="bg-card rounded-xl border px-3 py-2.5 text-center hover:shadow-md transition-shadow">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon className={`h-3.5 w-3.5 ${s.colorClass}`} />
              </div>
              <p className={`text-xl font-bold tabular-nums ${s.colorClass}`}>
                {value.toLocaleString('de-CH')}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
            </div>
          );
        })}
        <div className="bg-card rounded-xl border px-3 py-2.5 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xl font-bold tabular-nums text-primary">
            {(stats?.weekProcessed ?? 0).toLocaleString('de-CH')}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">7 Tage</p>
        </div>
        <div className="bg-card rounded-xl border px-3 py-2.5 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Target className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold tabular-nums text-emerald-500">
            {stats?.conversionRate ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conv.-Rate</p>
        </div>
        <div className="bg-card rounded-xl border px-3 py-2.5 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xl font-bold tabular-nums text-primary">
            {stats?.progressPercent ?? 0}%
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Fortschritt</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={stats?.progressPercent ?? 0} className="h-2 flex-1" />
        {showFiltered && filteredCount !== undefined && (
          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
            {filteredCount.toLocaleString('de-CH')} gefiltert
          </Badge>
        )}
      </div>
    </div>
  );
}

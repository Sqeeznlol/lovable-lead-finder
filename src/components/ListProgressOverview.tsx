import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CircleDot, Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { useLists, useListStatusBreakdown } from '@/hooks/use-lists';

interface ListProgressOverviewProps {
  listId: string | null;
}

export function ListProgressOverview({ listId }: ListProgressOverviewProps) {
  const { data: lists } = useLists();
  const { data: breakdown, isLoading } = useListStatusBreakdown(listId);

  const listName = useMemo(() => {
    if (!listId) return 'Alle Listen';
    return lists?.find(l => l.id === listId)?.name || 'Liste';
  }, [lists, listId]);

  if (isLoading || !breakdown) {
    return (
      <Card className="border-none shadow-sm bg-muted/30">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Live-Übersicht wird geladen…
        </CardContent>
      </Card>
    );
  }

  const { total, offen, inBearbeitung, exportiert, ausgeschlossen, byStatus } = breakdown;
  const ready = total - ausgeschlossen;
  const progressPct = ready > 0 ? Math.round((exportiert / ready) * 100) : 0;

  const statusOrder = [
    'Neu', 'Vorausgewählt', 'Eigentümer ermittelt',
    'Telefon gefunden', 'Post', 'Kontaktiert', 'Interesse', 'Interessant',
    'Exportiert', 'Geringe Chance', 'Ausgeblendet', 'Nicht interessant',
  ];
  const visibleStatuses = statusOrder.filter(s => (byStatus[s] || 0) > 0);

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Live-Status: {listName}</h3>
            <Badge variant="secondary" className="text-[10px]">{total.toLocaleString('de-CH')} gesamt</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Fortschritt: <span className="font-semibold text-foreground">{exportiert}/{ready}</span> in Pipedrive ({progressPct}%)
          </div>
        </div>

        <Progress value={progressPct} className="h-2" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatBox
            icon={<CircleDot className="h-3.5 w-3.5" />}
            label="Offen"
            value={offen}
            tone="muted"
            hint="Neu / Vorausgewählt"
          />
          <StatBox
            icon={<Loader2 className="h-3.5 w-3.5" />}
            label="In Bearbeitung"
            value={inBearbeitung}
            tone="info"
            hint="Eigentümer / Telefon / Post / Kontakt"
          />
          <StatBox
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Exportiert"
            value={exportiert}
            tone="success"
            hint="In Pipedrive"
          />
          <StatBox
            icon={<XCircle className="h-3.5 w-3.5" />}
            label="Ausgeschlossen"
            value={ausgeschlossen}
            tone="destructive"
            hint="Nicht interessant / Ausgeblendet"
          />
        </div>

        {visibleStatuses.length > 0 && (
          <div className="pt-1 border-t">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Detail nach Status</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleStatuses.map(s => (
                <Badge key={s} variant="outline" className="text-[10px] gap-1 font-normal">
                  <span>{s}</span>
                  <span className="font-semibold">{byStatus[s]}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon, label, value, tone, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'muted' | 'info' | 'success' | 'destructive';
  hint: string;
}) {
  const toneClass = {
    muted: 'bg-muted/50 text-foreground',
    info: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];

  return (
    <div className={`rounded-lg p-2.5 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold leading-tight mt-0.5">{value.toLocaleString('de-CH')}</div>
      <div className="text-[10px] opacity-60 truncate">{hint}</div>
    </div>
  );
}

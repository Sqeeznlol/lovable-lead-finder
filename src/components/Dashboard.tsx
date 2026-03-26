import { Building2, Users, Search, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePropertyStats } from '@/hooks/use-properties';

export function Dashboard() {
  const { data: stats } = usePropertyStats();

  const cards = [
    { label: 'Liegenschaften', value: stats?.total ?? 0, icon: Building2, color: 'text-primary' },
    { label: 'Eigentümer ermittelt', value: stats?.withOwner ?? 0, icon: Users, color: 'text-accent' },
    { label: 'Abgefragt', value: stats?.queried ?? 0, icon: Search, color: 'hsl(var(--warning))' },
    { label: 'Ausstehend', value: stats?.pending ?? 0, icon: Clock, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Überblick über deine Akquise-Pipeline</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="border-none shadow-md bg-card">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="rounded-xl bg-muted p-3">
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {stats?.statuses && Object.keys(stats.statuses).length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Status-Verteilung</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.statuses).map(([status, count]) => (
                <div key={status} className="bg-muted rounded-lg px-4 py-2">
                  <span className="font-medium">{status}</span>
                  <span className="ml-2 text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Building2, Users, Search, Send, Phone, AlertTriangle, TrendingUp, CheckCircle, Eye, CalendarClock, ChevronDown, ChevronUp, Sunrise } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { usePropertyStats } from '@/hooks/use-properties';
import { useVorauswahlStats } from '@/hooks/use-vorauswahl-stats';
import { usePhoneNumbers } from '@/hooks/use-phones';
import { useFollowUpStats, useDailyDigest } from '@/hooks/use-follow-ups';

export function Dashboard() {
  const { data: stats } = usePropertyStats();
  const { data: vaStats } = useVorauswahlStats();
  const { data: phones } = usePhoneNumbers();
  const { data: followUps } = useFollowUpStats();
  const { data: digest } = useDailyDigest();
  const [digestOpen, setDigestOpen] = useState(true);

  const totalCapacity = (phones || []).length * 5;
  const usedToday = (phones || []).reduce((acc, p) => acc + p.daily_queries_used, 0);

  const pipelineSteps = [
    { label: 'Importiert', value: stats?.total ?? 0, color: 'text-muted-foreground' },
    { label: 'Vorausgewählt', value: stats?.statuses?.['Vorausgewählt'] ?? 0, color: 'text-primary' },
    { label: 'Eigentümer ermittelt', value: stats?.statuses?.['Eigentümer ermittelt'] ?? 0, color: 'text-accent' },
    { label: 'Telefon gefunden', value: stats?.statuses?.['Telefon gefunden'] ?? 0, color: 'text-accent' },
    { label: 'Exportiert', value: stats?.statuses?.['Exportiert'] ?? 0, color: 'text-primary' },
  ];

  const conversionRate = (from: number, to: number) => from > 0 ? Math.round((to / from) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Überblick über deine Akquise-Pipeline</p>
        </div>
      </div>

      {/* Daily digest */}
      <Card className="border-none shadow-md bg-gradient-to-br from-accent/5 to-primary/5">
        <CardContent className="p-5">
          <button onClick={() => setDigestOpen(o => !o)} className="w-full flex items-center justify-between gap-2">
            <span className="font-semibold flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-primary" /> Heute
            </span>
            {digestOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {digestOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {[
                { label: 'Bearbeitet (gestern)', value: digest?.decisionsYesterday ?? 0 },
                { label: 'Pipedrive (gestern)', value: digest?.exportsYesterday ?? 0 },
                { label: 'Follow-ups heute', value: followUps?.dueToday ?? 0 },
                { label: 'Stagnierte Leads', value: followUps?.stagnant ?? 0 },
              ].map(s => (
                <div key={s.label} className="text-center bg-card/60 rounded-xl py-3">
                  <p className="text-2xl font-bold">{s.value.toLocaleString('de-CH')}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-ups */}
      {(followUps?.dueToday || followUps?.dueWeek || followUps?.stagnant) ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Follow-ups
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-warning/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-warning">{followUps?.dueToday ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fällig heute</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{followUps?.dueWeek ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Diese Woche</p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{followUps?.stagnant ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stagniert</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Vorauswahl stats - prominent */}
      <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Vorauswahl-Fortschritt
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Insgesamt', value: vaStats?.total ?? 0, color: 'text-foreground' },
              { label: 'Offen', value: vaStats?.pending ?? 0, color: 'text-warning' },
              { label: 'Interessant', value: vaStats?.approved ?? 0, color: 'text-accent' },
              { label: 'Nicht int.', value: vaStats?.rejected ?? 0, color: 'text-destructive' },
              { label: 'Heute bearb.', value: vaStats?.todayProcessed ?? 0, color: 'text-primary' },
              { label: 'Fortschritt', value: `${vaStats?.progressPercent ?? 0}%`, color: 'text-primary' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString('de-CH') : s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
          <Progress value={vaStats?.progressPercent ?? 0} className="h-1.5 mt-3" />
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Liegenschaften', value: stats?.total ?? 0, icon: Building2, color: 'text-primary' },
          { label: 'Eigentümer ermittelt', value: stats?.withOwner ?? 0, icon: Users, color: 'text-accent' },
          { label: 'Mit Telefon', value: stats?.statuses?.['Telefon gefunden'] ?? 0, icon: Phone, color: 'text-accent' },
          { label: 'Exportiert', value: stats?.statuses?.['Exportiert'] ?? 0, icon: Send, color: 'text-primary' },
        ].map(c => (
          <Card key={c.label} className="border-none shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="rounded-xl bg-muted p-2.5">
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{(c.value as number).toLocaleString('de-CH')}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline funnel */}
      <Card className="border-none shadow-md">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Pipeline-Funnel
          </h3>
          <div className="space-y-3">
            {pipelineSteps.map((step, i) => {
              const nextStep = pipelineSteps[i + 1];
              const width = stats?.total ? Math.max(5, ((step.value as number) / stats.total) * 100) : 5;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{(step.value as number).toLocaleString('de-CH')}</span>
                      {nextStep && (step.value as number) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          → {conversionRate(step.value as number, nextStep.value as number)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={width} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phone capacity + Action items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Telefon-Kapazität
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heute genutzt</span>
                <span className="font-bold">{usedToday} / {totalCapacity}</span>
              </div>
              <Progress value={totalCapacity > 0 ? (usedToday / totalCapacity) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground">{phones?.length || 0} Nummern aktiv</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Nächste Aktionen
            </h3>
            <div className="space-y-2 text-sm">
              {(vaStats?.pending ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-warning/5 rounded-lg px-3 py-2">
                  <Eye className="h-4 w-4 text-warning" />
                  <span>{vaStats?.pending?.toLocaleString('de-CH')} noch in Vorauswahl</span>
                </div>
              )}
              {(stats?.statuses?.['Vorausgewählt'] ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>{stats?.statuses?.['Vorausgewählt']} bereit für Akquise</span>
                </div>
              )}
              {(stats?.statuses?.['Eigentümer ermittelt'] ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-accent/5 rounded-lg px-3 py-2">
                  <Search className="h-4 w-4 text-accent" />
                  <span>{stats?.statuses?.['Eigentümer ermittelt']} für Telefon-Suche</span>
                </div>
              )}
              {(stats?.statuses?.['Telefon gefunden'] ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-accent/5 rounded-lg px-3 py-2">
                  <Send className="h-4 w-4 text-accent" />
                  <span>{stats?.statuses?.['Telefon gefunden']} exportbereit</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status distribution */}
      {stats?.statuses && Object.keys(stats.statuses).length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Status-Verteilung</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.statuses).map(([status, count]) => (
                <div key={status} className="bg-muted rounded-lg px-4 py-2">
                  <span className="font-medium">{status}</span>
                  <span className="ml-2 text-muted-foreground">{(count as number).toLocaleString('de-CH')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Gemeinden */}
      {stats?.gemeinden && Object.keys(stats.gemeinden).length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Top Gemeinden</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(stats.gemeinden)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .map(([name, count]) => (
                  <div key={name} className="bg-muted rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium truncate block">{name}</span>
                    <span className="text-muted-foreground">{(count as number).toLocaleString('de-CH')}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

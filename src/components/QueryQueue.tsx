import { useState } from 'react';
import { ExternalLink, Check, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUnqueriedProperties, useUpdateProperty } from '@/hooks/use-properties';
import { usePhoneNumbers, useIncrementPhoneQuery } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';

export function QueryQueue() {
  const { data: phones } = usePhoneNumbers();
  const totalSlots = (phones || []).reduce((acc, p) => acc + Math.max(0, 5 - p.daily_queries_used), 0);
  const { data: queue } = useUnqueriedProperties(totalSlots || 5);
  const updateProp = useUpdateProperty();
  const incrementPhone = useIncrementPhoneQuery();
  const { toast } = useToast();

  const [ownerData, setOwnerData] = useState<Record<string, { name: string; address: string }>>({});

  const handleMarkQueried = (propId: string, phoneNumber: string) => {
    const owner = ownerData[propId];
    updateProp.mutate({
      id: propId,
      is_queried: true,
      queried_at: new Date().toISOString(),
      queried_by_phone: phoneNumber,
      owner_name: owner?.name || null,
      owner_address: owner?.address || null,
      status: owner?.name ? 'Eigentümer ermittelt' : 'Neu',
    }, {
      onSuccess: () => toast({ title: 'Abfrage gespeichert' }),
    });
  };

  const availablePhones = (phones || []).filter(p => p.daily_queries_used < 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Abfrage-Warteschlange</h2>
        <p className="text-muted-foreground mt-1">
          {totalSlots} Abfragen verfügbar heute ({availablePhones.length} Nummern × 5)
        </p>
      </div>

      {availablePhones.length === 0 && (
        <Card className="border-none shadow-md bg-destructive/10">
          <CardContent className="p-6 text-center">
            <p className="font-medium text-destructive">Keine Abfragen mehr verfügbar heute.</p>
            <p className="text-sm text-muted-foreground mt-1">Füge mehr Telefonnummern hinzu oder warte bis morgen.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {(queue || []).map((prop, idx) => {
          const phoneIdx = Math.floor(idx / 5);
          const assignedPhone = availablePhones[phoneIdx];
          const portalUrl = prop.egrid
            ? `https://portal.objektwesen.zh.ch/aks/detail?egrid=${prop.egrid}&bfsNr=${prop.bfs_nr || '0'}`
            : null;

          return (
            <Card key={prop.id} className="border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                      {assignedPhone && (
                        <Badge variant="secondary" className="text-xs">
                          <Phone className="h-3 w-3 mr-1" />{assignedPhone.label || assignedPhone.number}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium truncate">{prop.address}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">EGRID: {prop.egrid || '–'}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end w-full lg:w-auto">
                    <div className="grid grid-cols-2 gap-2 flex-1 lg:flex-initial">
                      <div>
                        <Label className="text-xs">Eigentümer</Label>
                        <Input
                          placeholder="Name"
                          className="h-8 text-sm"
                          value={ownerData[prop.id]?.name || ''}
                          onChange={e => setOwnerData(d => ({ ...d, [prop.id]: { ...d[prop.id], name: e.target.value, address: d[prop.id]?.address || '' } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Adresse</Label>
                        <Input
                          placeholder="Adresse"
                          className="h-8 text-sm"
                          value={ownerData[prop.id]?.address || ''}
                          onChange={e => setOwnerData(d => ({ ...d, [prop.id]: { name: d[prop.id]?.name || '', address: e.target.value } }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {portalUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                            Portal <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          if (assignedPhone) {
                            incrementPhone.mutate(assignedPhone.id);
                          }
                          handleMarkQueried(prop.id, assignedPhone?.number || 'manual');
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" /> Erledigt
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(queue || []).length === 0 && (
          <Card className="border-none shadow-sm">
            <CardContent className="p-12 text-center text-muted-foreground">
              Alle Liegenschaften wurden abgefragt! 🎉
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

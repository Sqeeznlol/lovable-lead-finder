import { useState } from 'react';
import { ExternalLink, Check, Phone, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUnqueriedProperties, useUpdateProperty } from '@/hooks/use-properties';
import { usePhoneNumbers, useIncrementPhoneQuery } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';

export function QueryQueue() {
  const { data: phones } = usePhoneNumbers();
  const availablePhones = (phones || []).filter(p => p.daily_queries_used < 5);
  const totalSlots = availablePhones.reduce((acc, p) => acc + (5 - p.daily_queries_used), 0);
  const { data: queue, refetch } = useUnqueriedProperties(totalSlots || 5);
  const updateProp = useUpdateProperty();
  const incrementPhone = useIncrementPhoneQuery();
  const { toast } = useToast();

  const [ownerData, setOwnerData] = useState<Record<string, { name: string; address: string }>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const getPortalUrl = (prop: typeof queue extends (infer T)[] | undefined ? T : never) => {
    if (prop.parzelle && prop.bfs_nr) {
      return `https://maps.zh.ch/?locate=parz&locations=${prop.bfs_nr},${prop.parzelle}&topic=OerebKatasterZH`;
    }
    if (prop.egrid) {
      return `https://maps.zh.ch/?topic=OerebKatasterZH&search=${prop.egrid}`;
    }
    return null;
  };

  const handleMarkQueried = async (propId: string, phoneId: string, phoneNumber: string) => {
    setProcessing(propId);
    const owner = ownerData[propId];
    try {
      await incrementPhone.mutateAsync(phoneId);
      await updateProp.mutateAsync({
        id: propId,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: phoneNumber,
        owner_name: owner?.name || null,
        owner_address: owner?.address || null,
        status: owner?.name ? 'Eigentümer ermittelt' : 'Neu',
      });
      // Clear form data for this property
      setOwnerData(d => {
        const next = { ...d };
        delete next[propId];
        return next;
      });
      toast({ title: owner?.name ? '✅ Eigentümer gespeichert' : '✅ Als abgefragt markiert' });
    } catch {
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleSkip = async (propId: string) => {
    setProcessing(propId);
    try {
      await updateProp.mutateAsync({
        id: propId,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: 'skipped',
        status: 'Neu',
      });
      toast({ title: 'Übersprungen' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const items = queue || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Abfrage-Warteschlange</h2>
        <p className="text-muted-foreground mt-1">
          {totalSlots} Abfragen verfügbar · {availablePhones.length} Nummer{availablePhones.length !== 1 ? 'n' : ''} · Baujahr ≤ 1980 · Grösste HNF zuerst
        </p>
      </div>

      {availablePhones.length === 0 && (
        <Card className="border-none shadow-md bg-destructive/10">
          <CardContent className="p-6 text-center">
            <p className="font-medium text-destructive">Keine Abfragen mehr verfügbar heute.</p>
            <p className="text-sm text-muted-foreground mt-1">Füge mehr Telefonnummern hinzu oder setze die Zähler zurück.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((prop, idx) => {
          const phoneIdx = Math.floor(idx / 5);
          const assignedPhone = availablePhones[phoneIdx];
          const portalUrl = getPortalUrl(prop);
          const isProcessing = processing === prop.id;

          return (
            <Card key={prop.id} className={`border-none shadow-sm ${isProcessing ? 'opacity-50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-bold">#{idx + 1}</Badge>
                    {assignedPhone && (
                      <Badge variant="secondary" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />{assignedPhone.label || assignedPhone.number}
                      </Badge>
                    )}
                    {prop.zone && (
                      <Badge variant="outline" className="text-xs">{prop.zone}</Badge>
                    )}
                    {prop.gebaeudeflaeche && (
                      <Badge className="text-xs bg-primary/20 text-primary border-none">
                        HNF: {Math.round(Number(prop.gebaeudeflaeche))} m²
                      </Badge>
                    )}
                    {prop.area && (
                      <Badge variant="outline" className="text-xs">
                        Fläche: {Math.round(Number(prop.area))} m²
                      </Badge>
                    )}
                    {prop.baujahr && (
                      <Badge variant="outline" className="text-xs">
                        Bj. {prop.baujahr}
                      </Badge>
                    )}
                  </div>

                  {/* Address & details */}
                  <div>
                    <p className="font-medium">{prop.address}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      EGRID: {prop.egrid || '–'} · Parzelle: {prop.parzelle || '–'} · {prop.gemeinde || ''}
                    </p>
                  </div>

                  {/* Action row */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    {/* Portal link - prominent */}
                    {portalUrl && (
                      <Button size="sm" variant="outline" className="shrink-0" asChild>
                        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> Portal öffnen
                        </a>
                      </Button>
                    )}

                    {/* Owner input fields */}
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <div>
                        <Label className="text-xs">Eigentümer</Label>
                        <Input
                          placeholder="Name eingeben"
                          className="h-8 text-sm"
                          value={ownerData[prop.id]?.name || ''}
                          onChange={e => setOwnerData(d => ({
                            ...d,
                            [prop.id]: { ...d[prop.id], name: e.target.value, address: d[prop.id]?.address || '' }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Adresse</Label>
                        <Input
                          placeholder="Adresse eingeben"
                          className="h-8 text-sm"
                          value={ownerData[prop.id]?.address || ''}
                          onChange={e => setOwnerData(d => ({
                            ...d,
                            [prop.id]: { name: d[prop.id]?.name || '', address: e.target.value }
                          }))}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isProcessing}
                        onClick={() => handleSkip(prop.id)}
                        title="Überspringen"
                      >
                        <SkipForward className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        disabled={isProcessing || !assignedPhone}
                        onClick={() => {
                          if (assignedPhone) {
                            handleMarkQueried(prop.id, assignedPhone.id, assignedPhone.number);
                          }
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

        {items.length === 0 && availablePhones.length > 0 && (
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

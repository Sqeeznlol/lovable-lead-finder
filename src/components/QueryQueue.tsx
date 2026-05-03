import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Check, Phone, SkipForward, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUnqueriedProperties, useUpdateProperty } from '@/hooks/use-properties';
import { usePhoneNumbers, useIncrementPhoneQuery } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';
import { useListFilter } from '@/hooks/use-lists';
import { getOerebParzelleUrl } from '@/lib/oereb';

export function QueryQueue() {
  const { data: phones } = usePhoneNumbers();
  const availablePhones = (phones || []).filter(p => p.daily_queries_used < 5);
  const totalSlots = availablePhones.reduce((acc, p) => acc + (5 - p.daily_queries_used), 0);
  const { selectedListId } = useListFilter();
  const { data: queue, refetch } = useUnqueriedProperties(totalSlots || 5, selectedListId);
  const updateProp = useUpdateProperty();
  const incrementPhone = useIncrementPhoneQuery();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);

  const items = queue || [];
  const currentProp = items[currentIndex];

  // Figure out which phone is assigned to the current index
  const getAssignedPhone = useCallback((idx: number) => {
    let remaining = idx;
    for (const phone of availablePhones) {
      const slots = 5 - phone.daily_queries_used;
      if (remaining < slots) return phone;
      remaining -= slots;
    }
    return null;
  }, [availablePhones]);

  const assignedPhone = currentProp ? getAssignedPhone(currentIndex) : null;

  // Which query number within this phone (1-5)
  const getQueryNumberForPhone = useCallback((idx: number) => {
    let remaining = idx;
    for (const phone of availablePhones) {
      const slots = 5 - phone.daily_queries_used;
      if (remaining < slots) return phone.daily_queries_used + remaining + 1;
      remaining -= slots;
    }
    return 0;
  }, [availablePhones]);

  const queryNumber = getQueryNumberForPhone(currentIndex);

  const getPortalUrl = (prop: typeof currentProp) => {
    if (!prop) return null;
    return getOerebParzelleUrl(prop.parzelle, prop.bfs_nr);
  };

  const portalUrl = getPortalUrl(currentProp);

  // Reset form when moving to next property
  useEffect(() => {
    setOwnerName('');
    setOwnerAddress('');
    setPortalOpened(false);
  }, [currentIndex]);

  const openPortal = () => {
    if (portalUrl) {
      window.open(portalUrl, '_blank');
      setPortalOpened(true);
    }
  };

  const handleDone = async () => {
    if (!currentProp || !assignedPhone) return;
    setProcessing(true);
    try {
      await incrementPhone.mutateAsync(assignedPhone.id);
      await updateProp.mutateAsync({
        id: currentProp.id,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: assignedPhone.number,
        owner_name: ownerName || null,
        owner_address: ownerAddress || null,
        status: ownerName ? 'Eigentümer ermittelt' : 'Neu',
      });
      toast({ title: ownerName ? '✅ Eigentümer gespeichert' : '✅ Als abgefragt markiert' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!currentProp) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({
        id: currentProp.id,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: 'skipped',
        status: 'Neu',
      });
      toast({ title: 'Übersprungen' });
      moveToNext();
    } catch (err) {
      toast({ title: 'Speichern fehlgeschlagen', description: (err as Error)?.message || 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const moveToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
  };

  // Global progress
  const completedToday = (phones || []).reduce((acc, p) => acc + p.daily_queries_used, 0);
  const totalCapacity = (phones || []).length * 5;
  const progressPercent = totalCapacity > 0 ? (completedToday / totalCapacity) * 100 : 0;

  if (availablePhones.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Abfrage-Warteschlange</h2>
          <p className="text-muted-foreground mt-1">Alle Abfragen für heute aufgebraucht</p>
        </div>
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-2xl font-bold">🏁 Fertig für heute!</p>
            <p className="text-muted-foreground">
              {completedToday} von {totalCapacity} Abfragen erledigt.
              Füge mehr Telefonnummern hinzu oder setze die Zähler morgen zurück.
            </p>
            <Progress value={100} className="h-2 max-w-md mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentProp) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Abfrage-Warteschlange</h2>
        </div>
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center text-muted-foreground">
            Alle Liegenschaften wurden abgefragt! 🎉
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Abfrage-Warteschlange</h2>
          <p className="text-muted-foreground mt-1">
            {totalSlots} Abfragen verbleibend · {items.length} in Warteschlange
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 shadow-sm border">
          <Phone className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">{assignedPhone?.label || assignedPhone?.number}</span>
            <span className="text-muted-foreground ml-2">Abfrage {queryNumber}/5</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Heute erledigt: {completedToday}</span>
          <span>Kapazität: {totalCapacity}</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Current property - focused view */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          {/* Property header */}
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className="text-sm font-bold bg-primary text-primary-foreground">
                #{currentIndex + 1} von {items.length}
              </Badge>
              {currentProp.zone && (
                <Badge variant="outline">{currentProp.zone}</Badge>
              )}
              {currentProp.gebaeudeflaeche && (
                <Badge className="bg-primary/20 text-primary border-none">
                  HNF: {Math.round(Number(currentProp.gebaeudeflaeche))} m²
                </Badge>
              )}
              {currentProp.area && (
                <Badge variant="outline">
                  Fläche: {Math.round(Number(currentProp.area))} m²
                </Badge>
              )}
              {currentProp.baujahr && (
                <Badge variant="outline">Bj. {currentProp.baujahr}</Badge>
              )}
              {currentProp.geschosse && (
                <Badge variant="outline">{Number(currentProp.geschosse)} Geschosse</Badge>
              )}
              {currentProp.wohnungen && (
                <Badge variant="outline">{Number(currentProp.wohnungen)} Whg.</Badge>
              )}
            </div>
            <h3 className="text-xl font-bold">{currentProp.address}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {currentProp.plz_ort || currentProp.gemeinde || ''}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-2">
              EGRID: {currentProp.egrid || '–'} · Parzelle: {currentProp.parzelle || '–'} · BFS: {currentProp.bfs_nr || '–'}
            </p>
          </div>

          {/* Step 1: Open portal */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${portalOpened ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">Portal öffnen & Eigentümer nachschlagen</p>
                <p className="text-xs text-muted-foreground">Klicke Info → Öffentlicher Zugang → Mobilnummer eingeben</p>
              </div>
              <Button
                onClick={openPortal}
                disabled={!portalUrl}
                variant={portalOpened ? 'outline' : 'default'}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {portalOpened ? 'Nochmal öffnen' : 'Portal öffnen'}
              </Button>
            </div>
          </div>

          {/* Step 2: Enter owner data */}
          <div className="p-6 border-b">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${ownerName ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                2
              </div>
              <div className="flex-1 space-y-3">
                <p className="font-medium">Eigentümer-Daten eintragen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Eigentümer Name</Label>
                    <Input
                      placeholder="z.B. Hans Müller"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Eigentümer Adresse</Label>
                    <Input
                      placeholder="z.B. Bahnhofstrasse 1, 8001 Zürich"
                      value={ownerAddress}
                      onChange={e => setOwnerAddress(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Save & next */}
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-muted text-muted-foreground">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium">Speichern & weiter</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={processing}
                  onClick={handleSkip}
                >
                  <SkipForward className="h-4 w-4 mr-1" /> Überspringen
                </Button>
                <Button
                  disabled={processing || !assignedPhone}
                  onClick={handleDone}
                  size="lg"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {ownerName ? 'Speichern & weiter' : 'Erledigt & weiter'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming properties preview */}
      {items.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Nächste Liegenschaften</h3>
          <div className="grid gap-2">
            {items.slice(currentIndex + 1, currentIndex + 4).map((prop, i) => {
              const phone = getAssignedPhone(currentIndex + 1 + i);
              return (
                <div key={prop.id} className="flex items-center gap-3 bg-card rounded-lg px-4 py-2.5 shadow-sm border text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">#{currentIndex + 2 + i}</Badge>
                  <span className="truncate flex-1 font-medium">{prop.address}</span>
                  {prop.gebaeudeflaeche && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Math.round(Number(prop.gebaeudeflaeche))} m²
                    </span>
                  )}
                  {phone && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <Phone className="h-3 w-3 mr-1" />{phone.label || phone.number}
                    </Badge>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

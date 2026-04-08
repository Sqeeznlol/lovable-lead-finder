import { useState, useEffect, useCallback } from 'react';
import { Search, Phone, Check, ArrowRight, SkipForward, ExternalLink, AlertTriangle, Building2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useProperties, useUpdateProperty } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';
import { classifyOwner, ownerTypeLabel, ownerTypeColor, parseOwnerString, telSearchUrlParsed, opendiUrlParsed } from '@/lib/owner-utils';

export function TelefonSuche() {
  const { data: result, refetch } = useProperties({ statusFilter: 'Eigentümer ermittelt', pageSize: 200 });
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'person' | 'ag' | 'stadt'>('person');

  const allItems = (result?.data || []).filter(p => p.owner_name && !p.owner_phone);
  
  const items = allItems.filter(p => {
    if (filter === 'all') return true;
    const type = classifyOwner(p.owner_name || '');
    return type === filter;
  });

  const current = items[currentIndex];

  // Stats
  const personCount = allItems.filter(p => classifyOwner(p.owner_name || '') === 'person').length;
  const agCount = allItems.filter(p => classifyOwner(p.owner_name || '') === 'ag').length;
  const stadtCount = allItems.filter(p => classifyOwner(p.owner_name || '') === 'stadt').length;

  const moveToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
    setPhone1(''); setPhone2('');
  }, [currentIndex, items.length, refetch]);

  // Reset index on filter change
  useEffect(() => { setCurrentIndex(0); setPhone1(''); setPhone2(''); }, [filter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 's') { e.preventDefault(); moveToNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moveToNext]);

  const handleSave = async () => {
    if (!current) return;
    setProcessing(true);
    try {
      const updates: Record<string, unknown> = {
        id: current.id,
        owner_phone: phone1 || null,
        status: phone1 ? 'Telefon gefunden' : 'Eigentümer ermittelt',
      };
      if (phone2 && current.owner_name_2) {
        updates.owner_phone_2 = phone2;
      }
      await updateProp.mutateAsync(updates as any);
      toast({ title: phone1 ? '✅ Telefonnummer gespeichert' : '✅ Übersprungen' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkLowChance = async () => {
    if (!current) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({
        id: current.id,
        status: 'Geringe Chance',
        notes: (current.notes ? current.notes + '\n' : '') + `Eigentümer-Typ: ${ownerTypeLabel(classifyOwner(current.owner_name || ''))} – geringe Verkaufschance`,
      });
      toast({ title: '⚠️ Als geringe Chance markiert' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg max-w-md w-full">
          <CardContent className="p-12 text-center space-y-4">
            <Phone className="h-16 w-16 mx-auto text-accent" />
            <h3 className="text-xl font-bold">Keine offenen Nummern-Suchen</h3>
            <p className="text-muted-foreground">
              {filter !== 'all' ? `Keine ${ownerTypeLabel(filter as any)} ohne Telefonnummer.` : 'Alle ermittelten Eigentümer haben bereits eine Telefonnummer.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ownerType1 = classifyOwner(current.owner_name || '');
  const ownerType2 = current.owner_name_2 ? classifyOwner(current.owner_name_2) : null;
  const parsed1 = parseOwnerString(current.owner_name || '');
  const parsed2 = current.owner_name_2 ? parseOwnerString(current.owner_name_2) : null;
  const ort = current.plz_ort || current.gemeinde || '';
  const isLowChance = ownerType1 === 'ag' || ownerType1 === 'stadt';

  const OwnerTypeIcon = ownerType1 === 'ag' ? Building2 : ownerType1 === 'stadt' ? Landmark : Phone;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Telefonnummern-Suche</h2>
          <p className="text-muted-foreground text-sm">{allItems.length} Eigentümer ohne Telefonnummer</p>
        </div>
        <Badge variant="outline">{currentIndex + 1} / {items.length}</Badge>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filter === 'person' ? 'default' : 'outline'} onClick={() => setFilter('person')} className="gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Privatpersonen
          <Badge variant="secondary" className="text-xs ml-1">{personCount}</Badge>
        </Button>
        <Button size="sm" variant={filter === 'ag' ? 'default' : 'outline'} onClick={() => setFilter('ag')} className="gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Firmen/AG
          <Badge variant="secondary" className="text-xs ml-1">{agCount}</Badge>
        </Button>
        <Button size="sm" variant={filter === 'stadt' ? 'default' : 'outline'} onClick={() => setFilter('stadt')} className="gap-1.5">
          <Landmark className="h-3.5 w-3.5" /> Öffentlich
          <Badge variant="secondary" className="text-xs ml-1">{stadtCount}</Badge>
        </Button>
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
          Alle ({allItems.length})
        </Button>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Property info */}
          <div className="p-6 bg-gradient-to-br from-card to-muted/30 border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{current.address}</p>
                <p className="text-xs text-muted-foreground">{ort}</p>
              </div>
              <Badge className={`${ownerTypeColor(ownerType1)} text-xs shrink-0`}>
                <OwnerTypeIcon className="h-3 w-3 mr-1" />
                {ownerTypeLabel(ownerType1)}
              </Badge>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {current.zone && <Badge variant="outline" className="text-xs">{current.zone}</Badge>}
              {current.baujahr && <Badge variant="outline" className="text-xs">Bj. {current.baujahr}</Badge>}
            </div>

            {/* Low chance warning */}
            {isLowChance && (
              <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Geringe Verkaufschance</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ownerType1 === 'ag' ? 'Firmen/AGs verkaufen selten einzelne Liegenschaften.' : 'Öffentliche Eigentümer (Stadt/Gemeinde) verkaufen selten.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Owner 1 */}
          <div className="p-6 space-y-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Eigentümer 1</Label>
                <p className="text-lg font-bold mt-1">{current.owner_name}</p>
                {current.owner_address && <p className="text-sm text-muted-foreground">{current.owner_address}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Suche nach: <span className="font-medium text-foreground">{parsed1.searchName}</span>
                </p>
              </div>
            </div>
            {ownerType1 === 'person' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(telSearchUrlParsed(parsed1, ort), '_blank')}>
                  <Search className="h-3.5 w-3.5" /> tel.search.ch
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(opendiUrlParsed(parsed1), '_blank')}>
                  <Search className="h-3.5 w-3.5" /> Opendi
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
              <Input placeholder="+41 ..." value={phone1} onChange={e => setPhone1(e.target.value)} className="h-10" autoFocus />
            </div>
          </div>

          {/* Owner 2 if exists */}
          {current.owner_name_2 && parsed2 && (
            <div className="p-6 space-y-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Eigentümer 2</Label>
                    {ownerType2 && <Badge className={`${ownerTypeColor(ownerType2)} text-[10px]`}>{ownerTypeLabel(ownerType2)}</Badge>}
                  </div>
                  <p className="text-lg font-bold mt-1">{current.owner_name_2}</p>
                  {current.owner_address_2 && <p className="text-sm text-muted-foreground">{current.owner_address_2}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Suche nach: <span className="font-medium text-foreground">{parsed2.searchName}</span>
                  </p>
                </div>
              </div>
              {ownerType2 === 'person' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => window.open(telSearchUrlParsed(parsed2, ort), '_blank')}>
                    <Search className="h-3.5 w-3.5" /> tel.search.ch
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => window.open(opendiUrlParsed(parsed2), '_blank')}>
                    <Search className="h-3.5 w-3.5" /> Opendi
                  </Button>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
                <Input placeholder="+41 ..." value={phone2} onChange={e => setPhone2(e.target.value)} className="h-10" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-5 bg-muted/30 flex gap-3 flex-wrap">
            {isLowChance && (
              <Button variant="outline" onClick={handleMarkLowChance} disabled={processing} className="text-destructive border-destructive/30">
                <AlertTriangle className="h-4 w-4 mr-2" /> Geringe Chance
              </Button>
            )}
            <Button variant="outline" onClick={moveToNext} disabled={processing}>
              <SkipForward className="h-4 w-4 mr-2" /> Überspringen
            </Button>
            <Button onClick={handleSave} disabled={processing} className="ml-auto h-11 px-6" size="lg">
              <Check className="h-5 w-5 mr-2" />
              {phone1 ? 'Speichern & Nächstes' : 'Ohne Nummer weiter'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next items preview */}
      {items.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nächste</p>
          {items.slice(currentIndex + 1, currentIndex + 4).map(p => {
            const t = classifyOwner(p.owner_name || '');
            return (
              <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-2.5 shadow-sm border">
                <Badge className={`${ownerTypeColor(t)} text-[10px] shrink-0`}>{ownerTypeLabel(t)}</Badge>
                <span className="truncate flex-1 text-sm font-medium">{p.owner_name}</span>
                <span className="text-xs text-muted-foreground truncate">{p.address}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

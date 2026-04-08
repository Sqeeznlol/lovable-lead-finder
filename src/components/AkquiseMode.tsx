import { useState, useEffect } from 'react';
import { ExternalLink, Check, SkipForward, EyeOff, ArrowRight, Phone, Zap, MapPin, Calendar, Layers, Home, Ruler, Search, Plus, Minus, AlertTriangle, Building2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnqueriedProperties, useUpdateProperty, useZones } from '@/hooks/use-properties';
import { usePhoneNumbers, useIncrementPhoneQuery } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';
import { parseOwnerString, classifyOwner, ownerTypeLabel, ownerTypeColor, telSearchUrlParsed, opendiUrlParsed } from '@/lib/owner-utils';

export function AkquiseMode() {
  const { data: phones } = usePhoneNumbers();
  const allPhones = phones || [];
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const selectedPhone = allPhones.find(p => p.id === selectedPhoneId);
  const remaining = selectedPhone ? Math.max(0, 5 - selectedPhone.daily_queries_used) : 0;

  const [zoneFilter, setZoneFilter] = useState<string>('Alle');
  const { data: zones } = useZones();

  const { data: queue, refetch } = useUnqueriedProperties(100);
  const updateProp = useUpdateProperty();
  const incrementPhone = useIncrementPhoneQuery();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerName2, setOwnerName2] = useState('');
  const [ownerAddress2, setOwnerAddress2] = useState('');
  const [ownerPhone2, setOwnerPhone2] = useState('');
  const [showOwner2, setShowOwner2] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [gisOpened, setGisOpened] = useState(false);

  // Sort queue by deal score, apply zone filter
  const items = (queue || [])
    .filter(p => zoneFilter === 'Alle' || p.zone === zoneFilter)
    .map(p => ({ ...p, _score: calculateDealScore(p) }))
    .sort((a, b) => b._score - a._score);

  const current = items[currentIndex];
  const score = current?._score ?? 0;

  // Auto-select first phone
  useEffect(() => {
    if (!selectedPhoneId && allPhones.length > 0) {
      const available = allPhones.find(p => p.daily_queries_used < 5);
      if (available) setSelectedPhoneId(available.id);
    }
  }, [allPhones, selectedPhoneId]);

  // Reset form on property change
  useEffect(() => {
    setOwnerName(''); setOwnerAddress(''); setOwnerPhone('');
    setOwnerName2(''); setOwnerAddress2(''); setOwnerPhone2('');
    setShowOwner2(false); setGisOpened(false);
  }, [currentIndex]);

  // Reset index when zone filter changes
  useEffect(() => { setCurrentIndex(0); }, [zoneFilter]);

  // GIS URL — OerebKatasterZH (public, no login)
  const portalUrl = current?.egrid
    ? `https://maps.zh.ch/?locate=parz&locations=${current.egrid}&topic=EigAuskunftZH&scale=500`
    : current?.parzelle && current?.bfs_nr
      ? `https://maps.zh.ch/?locate=parz&locations=${current.bfs_nr},${current.parzelle}&topic=EigAuskunftZH&scale=500`
      : current?.address
        ? `https://maps.zh.ch/?topic=EigAuskunftZH&search=${encodeURIComponent(current.address + (current.plz_ort ? ' ' + current.plz_ort : ''))}&scale=500`
        : null;

  const googleMapsUrl = current?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.address + (current.plz_ort ? ', ' + current.plz_ort : ''))}`
    : null;

  // Smart name parsing for search links
  const parsed1 = parseOwnerString(ownerName);
  const parsed2 = parseOwnerString(ownerName2);
  const ownerOrt = current?.plz_ort || current?.gemeinde || '';

  const moveToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
  };

  const handleSave = async () => {
    if (!current || !selectedPhone) return;
    setProcessing(true);
    try {
      await incrementPhone.mutateAsync(selectedPhone.id);
      await updateProp.mutateAsync({
        id: current.id,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: selectedPhone.number,
        owner_name: ownerName || null,
        owner_address: ownerAddress || null,
        owner_phone: ownerPhone || null,
        owner_name_2: ownerName2 || null,
        owner_address_2: ownerAddress2 || null,
        owner_phone_2: ownerPhone2 || null,
        status: ownerName ? 'Eigentümer ermittelt' : 'Kein Ergebnis',
      });
      toast({ title: ownerName ? '✅ Eigentümer gespeichert' : '✅ Kein Ergebnis – weiter' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => moveToNext();

  const handleHide = async () => {
    if (!current) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Ausgeblendet' });
      toast({ title: 'Ausgeblendet' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const completedToday = allPhones.reduce((acc, p) => acc + p.daily_queries_used, 0);
  const totalCapacity = allPhones.length * 5;
  const progressPercent = totalCapacity > 0 ? (completedToday / totalCapacity) * 100 : 0;

  if (allPhones.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg max-w-md w-full">
          <CardContent className="p-12 text-center space-y-4">
            <Phone className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <h3 className="text-xl font-bold">Keine Telefonnummer</h3>
            <p className="text-muted-foreground">Füge zuerst eine Telefonnummer unter "Telefone" hinzu.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg max-w-md w-full">
          <CardContent className="p-12 text-center space-y-4">
            <Zap className="h-16 w-16 mx-auto text-accent" />
            <h3 className="text-xl font-bold">Alles abgearbeitet! 🎉</h3>
            <p className="text-muted-foreground">Keine weiteren Liegenschaften {zoneFilter !== 'Alle' ? `in Zone ${zoneFilter}` : 'in der Queue'}.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar: Phone + Zone filter + progress */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Telefon wählen" />
            </SelectTrigger>
            <SelectContent>
              {allPhones.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {p.label || p.number}
                    <Badge variant={p.daily_queries_used >= 5 ? 'destructive' : 'secondary'} className="text-xs ml-1">
                      {p.daily_queries_used}/5
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Alle">Alle Zonen</SelectItem>
              {(zones || []).map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedPhone && (
            <span className="text-sm text-muted-foreground">{remaining} übrig</span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {completedToday}/{totalCapacity} heute · {items.length} in Queue
        </div>
      </div>

      <Progress value={progressPercent} className="h-1.5" />

      {/* Main Card */}
      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Score + Address Header */}
          <div className="p-8 pb-6 bg-gradient-to-br from-card to-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="outline" className="text-xs">#{currentIndex + 1} / {items.length}</Badge>
                  {current.zone && <Badge className="bg-primary/10 text-primary border-primary/20">{current.zone}</Badge>}
                  {current.gwr_egid && <Badge variant="outline" className="text-xs font-mono">EGID: {current.gwr_egid}</Badge>}
                  {current.egrid && <Badge variant="outline" className="text-xs font-mono">EGRID: {current.egrid}</Badge>}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{current.address}</h2>
                <p className="text-muted-foreground mt-1">{current.plz_ort || current.gemeinde || ''}</p>
              </div>
              <div className={`flex-shrink-0 w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center ${scoreBg(score)}`}>
                <span className={`text-2xl font-black ${scoreColor(score)}`}>{score}</span>
                <span className="text-[10px] text-muted-foreground font-medium">SCORE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {current.gebaeudeflaeche && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Home className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">HNF</p>
                    <p className="font-semibold text-sm">{Math.round(Number(current.gebaeudeflaeche))} m²</p>
                  </div>
                </div>
              )}
              {current.area && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Ruler className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Grundstück</p>
                    <p className="font-semibold text-sm">{Math.round(Number(current.area))} m²</p>
                  </div>
                </div>
              )}
              {current.baujahr && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Baujahr</p>
                    <p className="font-semibold text-sm">{current.baujahr}</p>
                  </div>
                </div>
              )}
              {current.geschosse && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Layers className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Geschosse</p>
                    <p className="font-semibold text-sm">{Number(current.geschosse)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GIS Section */}
          <div className="px-8 py-5 border-t border-b space-y-3">
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Anleitung Eigentumsauskunft</p>
              <ol className="text-sm text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>Klicke auf die <span className="font-medium text-foreground">markierte Parzelle</span> in der Karte</li>
                <li>Wähle <span className="font-medium text-foreground">"Eigentumsauskunft bestellen"</span></li>
                <li>SMS-Code eingeben und Eigentümer ablesen</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (portalUrl) { window.open(portalUrl, '_blank'); setGisOpened(true); }
                }}
                disabled={!portalUrl}
                className="flex-1 h-12 text-base gap-2"
              >
                <MapPin className="h-5 w-5" />
                GIS Eigentumsauskunft
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                onClick={() => googleMapsUrl && window.open(googleMapsUrl, '_blank')}
                disabled={!googleMapsUrl}
                variant="outline"
                className="h-12 gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Google Maps
              </Button>
            </div>

            {gisOpened && (
              <p className="text-sm text-primary font-medium flex items-center gap-2">
                <Check className="h-4 w-4" />
                GIS geöffnet – Eigentumsauskunft abrufen
              </p>
            )}
          </div>

          {/* Owner input */}
          <div className="px-8 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Eigentümer 1</Label>
              {ownerName && (
                <div className="flex gap-2 items-center">
                  {classifyOwner(ownerName) !== 'person' && (
                    <Badge className={`${ownerTypeColor(classifyOwner(ownerName))} text-[10px]`}>{ownerTypeLabel(classifyOwner(ownerName))}</Badge>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => window.open(telSearchUrlParsed(parsed1, ownerOrt), '_blank')}>
                    <Search className="h-3 w-3" /> tel.search.ch
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => window.open(opendiUrlParsed(parsed1), '_blank')}>
                    <Search className="h-3 w-3" /> Opendi
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input placeholder="z.B. Hans Müller" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="h-10" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Adresse</Label>
                <Input placeholder="z.B. Bahnhofstr. 1, 8001 ZH" value={ownerAddress} onChange={e => setOwnerAddress(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefon</Label>
                <Input placeholder="+41 79 123 45 67" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="h-10" />
              </div>
            </div>

            {/* Owner 2 */}
            {!showOwner2 ? (
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground gap-1" onClick={() => setShowOwner2(true)}>
                <Plus className="h-3 w-3" /> 2. Eigentümer hinzufügen
              </Button>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Eigentümer 2</Label>
                  <div className="flex gap-2">
                    {ownerName2 && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => window.open(telSearchUrlParsed(parsed2, ownerOrt), '_blank')}>
                          <Search className="h-3 w-3" /> tel.search.ch
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => window.open(opendiUrlParsed(parsed2), '_blank')}>
                          <Search className="h-3 w-3" /> Opendi
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setShowOwner2(false); setOwnerName2(''); setOwnerAddress2(''); setOwnerPhone2(''); }}>
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input placeholder="2. Eigentümer" value={ownerName2} onChange={e => setOwnerName2(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Adresse</Label>
                    <Input placeholder="Adresse" value={ownerAddress2} onChange={e => setOwnerAddress2(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefon</Label>
                    <Input placeholder="+41..." value={ownerPhone2} onChange={e => setOwnerPhone2(e.target.value)} className="h-10" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-8 py-5 bg-muted/30 border-t flex flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={handleHide} disabled={processing} className="text-muted-foreground">
              <EyeOff className="h-4 w-4 mr-2" /> Ausblenden
            </Button>
            <Button variant="outline" onClick={handleSkip} disabled={processing}>
              <SkipForward className="h-4 w-4 mr-2" /> Überspringen
            </Button>
            <Button
              onClick={handleSave}
              disabled={processing || !selectedPhone || remaining <= 0}
              className="sm:ml-auto h-12 px-8 text-base"
              size="lg"
            >
              <Check className="h-5 w-5 mr-2" />
              {ownerName ? 'Speichern & Nächstes' : 'Kein Ergebnis & Nächstes'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next in queue */}
      {items.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nächste in der Queue</p>
          {items.slice(currentIndex + 1, currentIndex + 4).map(p => {
            const s = p._score;
            return (
              <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 shadow-sm border">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${scoreBg(s)}`}>
                  <span className={scoreColor(s)}>{s}</span>
                </div>
                <span className="truncate flex-1 text-sm font-medium">{p.address}</span>
                <span className="text-xs text-muted-foreground">{p.gemeinde}</span>
                {p.zone && <Badge variant="outline" className="text-xs">{p.zone}</Badge>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

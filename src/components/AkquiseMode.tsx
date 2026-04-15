import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Check, SkipForward, EyeOff, ArrowRight, Phone, Zap, MapPin, Calendar, Layers, Home, Ruler, Search, Plus, Trash2, AlertTriangle, Keyboard, Copy, Bot, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePreselectedProperties, useUpdateProperty, useZones } from '@/hooks/use-properties';
import { useListFilter } from '@/hooks/use-lists';
import { ListSelector } from '@/components/ListSelector';
import { usePhoneNumbers, useIncrementPhoneQuery } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';
import { parseOwnerString, parseMultipleOwners, classifyOwner, ownerTypeLabel, ownerTypeColor, telSearchUrlParsed, opendiUrlParsed, type ParsedOwner } from '@/lib/owner-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OwnerEntry {
  raw: string;
  parsed: ParsedOwner;
  phone: string;
}

function createEmptyOwner(): OwnerEntry {
  return { raw: '', parsed: parseOwnerString(''), phone: '' };
}

export function AkquiseMode() {
  const { data: phones } = usePhoneNumbers();
  const allPhones = phones || [];
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const selectedPhone = allPhones.find(p => p.id === selectedPhoneId);
  const remaining = selectedPhone ? Math.max(0, 5 - selectedPhone.daily_queries_used) : 0;

  const [zoneFilter, setZoneFilter] = useState<string>('Alle');
  const [baujahrBis, setBaujahrBis] = useState<string>('1980');
  const { data: zones } = useZones();
  const { selectedListId } = useListFilter();

  const { data: queue, refetch } = usePreselectedProperties(100, selectedListId);
  const updateProp = useUpdateProperty();
  const incrementPhone = useIncrementPhoneQuery();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [owners, setOwners] = useState<OwnerEntry[]>([createEmptyOwner()]);
  const [processing, setProcessing] = useState(false);
  const [gisOpened, setGisOpened] = useState(false);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const ownerInputRef = useRef<HTMLInputElement>(null);

  const updateOwnerRaw = useCallback((index: number, raw: string) => {
    setOwners(prev => {
      const next = [...prev];
      next[index] = { raw, parsed: parseOwnerString(raw), phone: next[index].phone };
      return next;
    });
  }, []);

  // Smart paste: detect multi-line paste and split into multiple owners
  const handlePaste = useCallback((index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    // Check if pasted text contains multiple owners (newlines or semicolons)
    const lines = pasted.split(/[\n;]/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      e.preventDefault();
      setOwners(prev => {
        const next = [...prev];
        // Fill current + add new entries for remaining lines
        lines.forEach((line, i) => {
          const targetIdx = index + i;
          if (targetIdx < next.length) {
            next[targetIdx] = { raw: line, parsed: parseOwnerString(line), phone: '' };
          } else if (next.length < 10) {
            next.push({ raw: line, parsed: parseOwnerString(line), phone: '' });
          }
        });
        return next;
      });
    }
  }, []);

  const updateOwnerPhone = useCallback((index: number, phone: string) => {
    setOwners(prev => {
      const next = [...prev];
      next[index] = { ...next[index], phone };
      return next;
    });
  }, []);

  const addOwner = useCallback(() => {
    setOwners(prev => prev.length >= 10 ? prev : [...prev, createEmptyOwner()]);
  }, []);

  const removeOwner = useCallback((index: number) => {
    setOwners(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  }, []);

  // Sort queue by deal score, apply zone filter
  const baujahrMax = baujahrBis ? parseInt(baujahrBis, 10) : null;
  const items = (queue || [])
    .filter(p => zoneFilter === 'Alle' || p.zone === zoneFilter)
    .filter(p => !baujahrMax || !p.baujahr || p.baujahr <= baujahrMax)
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
    setOwners([createEmptyOwner()]);
    setGisOpened(false);
    setTimeout(() => ownerInputRef.current?.focus(), 100);
  }, [currentIndex]);

  // Reset index when zone filter changes
  useEffect(() => { setCurrentIndex(0); }, [zoneFilter]);

  // Listen for owner data from Chrome Extension
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { propertyId, owners } = e.detail || {};
      if (!current || propertyId !== current.id) return;

      setAutoStatus(null);
      if (owners && owners.length > 0) {
        const newOwners = owners.map((o: { name: string; address: string }) => ({
          raw: [o.name, o.address].filter(Boolean).join(', '),
          parsed: parseOwnerString([o.name, o.address].filter(Boolean).join(', ')),
          phone: '',
        }));
        setOwners(newOwners);
        toast({ title: `✅ ${owners.length} Eigentümer automatisch übernommen!` });
      } else {
        toast({ title: 'Keine Eigentümer gefunden', variant: 'destructive' });
      }
    };
    window.addEventListener('akquise-owner-data', handler as EventListener);
    return () => window.removeEventListener('akquise-owner-data', handler as EventListener);
  }, [current, toast]);

  // Check if Chrome Extension is installed
  useEffect(() => {
    const check = () => {
      // Extension injects a marker element
      const marker = document.getElementById('akquise-extension-marker');
      setExtensionAvailable(!!marker);
    };
    check();
    // Re-check periodically
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'SELECT') return;

      // Akquise phase shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) {
        e.preventDefault();
        handleSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (portalUrl) { window.open(portalUrl, '_blank'); setGisOpened(true); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        handleHide();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // GIS URL - must go through maps.zh.ch (direct portal access is blocked)
  const portalUrl = current?.egrid
    ? `https://maps.zh.ch/?locate=parz&locations=${current.egrid}&topic=DLGOWfarbigZH&scale=500`
    : current?.parzelle && current?.bfs_nr
      ? `https://maps.zh.ch/?locate=parz&locations=${current.bfs_nr},${current.parzelle}&topic=DLGOWfarbigZH&scale=500`
      : current?.address
        ? `https://maps.zh.ch/?topic=DLGOWfarbigZH&search=${encodeURIComponent(current.address + (current.plz_ort ? ' ' + current.plz_ort : ''))}&scale=500`
        : null;

  const googleMapsUrl = current?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.address + (current.plz_ort ? ', ' + current.plz_ort : ''))}`
    : null;


  const ownerOrt = current?.plz_ort || current?.gemeinde || '';
  const firstOwnerName = owners[0]?.raw || '';
  const hasAnyOwner = owners.some(o => o.raw.trim());

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

      // Build owners JSON for all owners
      const ownersJson = owners
        .filter(o => o.raw.trim())
        .map(o => ({
          name: o.parsed.fullName || o.raw,
          address: o.parsed.address,
          phone: o.phone,
          ownershipType: o.parsed.ownershipType,
          type: o.parsed.type,
        }));

      // First 2 owners go to flat fields for backward compat
      const o1 = owners[0];
      const o2 = owners[1];

      await updateProp.mutateAsync({
        id: current.id,
        is_queried: true,
        queried_at: new Date().toISOString(),
        queried_by_phone: selectedPhone.number,
        owner_name: o1?.parsed.fullName || o1?.raw || null,
        owner_address: o1?.parsed.address || null,
        owner_phone: o1?.phone || null,
        owner_name_2: o2?.parsed.fullName || o2?.raw || null,
        owner_address_2: o2?.parsed.address || null,
        owner_phone_2: o2?.phone || null,
        status: hasAnyOwner ? 'Eigentümer ermittelt' : 'Kein Ergebnis',
        owners_json: ownersJson as any,
      });
      toast({ title: hasAnyOwner ? '✅ Eigentümer gespeichert' : '✅ Kein Ergebnis – weiter' });
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
      {/* Top bar */}
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
          <div className="flex items-center gap-1.5">
            <Label htmlFor="baujahr-bis" className="text-xs text-muted-foreground whitespace-nowrap">Bj. bis</Label>
            <Input
              id="baujahr-bis"
              type="number"
              value={baujahrBis}
              onChange={e => { setBaujahrBis(e.target.value); setCurrentIndex(0); }}
              placeholder="z.B. 1980"
              className="w-24 h-9"
            />
          </div>
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


            {/* ─── AKQUISE: GIS + Owner inputs ─── */}
            <>
              {/* GIS Section */}
              <div className="px-8 py-5 border-t border-b space-y-3">
                {/* Phone number hint */}
                {selectedPhone && (
                  <div className="rounded-lg bg-accent/10 border border-accent/20 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-accent-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nummer für SMS-Verifizierung</p>
                        <p className="text-sm font-bold font-mono tracking-wider">{selectedPhone.number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPhone.number);
                          toast({ title: '📋 Nummer kopiert' });
                        }}
                      >
                        <Copy className="h-3 w-3" /> Kopieren
                      </Button>
                      <Badge variant={remaining <= 1 ? 'destructive' : 'secondary'} className="text-xs">
                        {remaining} Abfragen übrig
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Auto-Recherche button (requires Chrome Extension) */}
                {current?.egrid && selectedPhone && (
                  <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-primary">Auto-Recherche</p>
                        {autoStatus && (
                          <Badge variant="outline" className="text-xs animate-pulse">{autoStatus}</Badge>
                        )}
                      </div>
                      {!extensionAvailable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => {
                            const downloadExtension = () => {
                              fetch('/akquise-extension.zip')
                                .then(res => { if (!res.ok) throw new Error('Download failed'); return res.blob(); })
                                .then(blob => {
                                  const a = document.createElement('a');
                                  a.href = URL.createObjectURL(blob);
                                  a.download = 'akquise-extension.zip';
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                })
                                .catch(() => toast({ title: 'Download fehlgeschlagen', variant: 'destructive' }));
                            };
                            downloadExtension();
                          }}
                        >
                          <Download className="h-3 w-3" /> Extension herunterladen
                        </Button>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        if (!current?.egrid || !selectedPhone) return;
                        setAutoStatus('Starte...');
                        // Send message to extension via custom event
                        window.dispatchEvent(new CustomEvent('akquise-start-lookup', {
                          detail: {
                            egrid: current.egrid,
                            bfsNr: current.bfs_nr || '',
                            phoneNumber: selectedPhone.number,
                            propertyId: current.id,
                            appOrigin: window.location.hostname,
                          }
                        }));
                        setGisOpened(true);
                        setAutoStatus('GIS wird geöffnet...');
                        // Timeout fallback
                        setTimeout(() => setAutoStatus(null), 120000);
                      }}
                      disabled={remaining <= 0 || !!autoStatus}
                      className="w-full h-12 text-base gap-2"
                    >
                      <Bot className="h-5 w-5" />
                      {autoStatus || 'Auto-Recherche starten'}
                    </Button>

                    {!extensionAvailable && (
                      <p className="text-[11px] text-muted-foreground">
                        Chrome Extension benötigt. Herunterladen → entpacken → <code className="bg-muted px-1 rounded">chrome://extensions</code> → Developer Mode → Load Unpacked
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manuell</p>
                  <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                    <li>GIS öffnen → Parzelle klicken → "öffentlicher Zugang"</li>
                    <li>Nummer eingeben → SMS-Code → Eigentümer kopieren</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      if (portalUrl) { window.open(portalUrl, '_blank'); setGisOpened(true); }
                    }}
                    disabled={!portalUrl || remaining <= 0}
                    className="flex-1 h-12 text-base gap-2"
                  >
                    <MapPin className="h-5 w-5" />
                    GIS Eigentumsauskunft
                    <ExternalLink className="h-4 w-4 ml-auto" />
                  </Button>
                  {googleMapsUrl ? (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-12 px-4 py-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Maps
                    </a>
                  ) : (
                    <Button variant="outline" className="h-12 gap-2" disabled>
                      <ExternalLink className="h-4 w-4" />
                      Maps
                    </Button>
                  )}
                </div>

                {gisOpened && (
                  <p className="text-sm text-primary font-medium flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Portal geöffnet – Eigentümer ablesen & hier einfügen
                  </p>
                )}
              </div>

              {/* Owner inputs — dynamic list */}
              <div className="px-8 py-6 space-y-4">
                {owners.map((owner, idx) => {
                  const ownerType = classifyOwner(owner.raw);
                  const isNonPerson = owner.raw.trim() && ownerType !== 'person';
                  return (
                    <div key={idx} className={`space-y-3 ${idx > 0 ? 'border-t pt-4' : ''}`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Eigentümer {idx + 1}</Label>
                        <div className="flex gap-2 items-center">
                          {owner.raw.trim() && (
                            <>
                              {isNonPerson && (
                                <Badge className={`${ownerTypeColor(ownerType)} text-[10px]`}>{ownerTypeLabel(ownerType)}</Badge>
                              )}
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => window.open(telSearchUrlParsed(owner.parsed, ownerOrt), '_blank')}>
                                <Search className="h-3 w-3" /> tel.search
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => window.open(opendiUrlParsed(owner.parsed), '_blank')}>
                                <Search className="h-3 w-3" /> Opendi
                              </Button>
                            </>
                          )}
                          {idx > 0 && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => removeOwner(idx)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Single paste field + parsed display */}
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Eigentümer einfügen (Name, Adresse, etc. – wird automatisch getrennt)
                          </Label>
                          <Input
                            ref={idx === 0 ? ownerInputRef : undefined}
                            placeholder="z.B. Meier, Michael, Habsburgstrasse 9, 8057 Zürich, Schweiz, Alleineigentum"
                            value={owner.raw}
                            onChange={e => updateOwnerRaw(idx, e.target.value)}
                            onPaste={e => handlePaste(idx, e)}
                            className="h-10 font-mono text-xs"
                            autoFocus={idx === 0}
                          />
                        </div>

                        {/* Show parsed result */}
                        {owner.raw.trim() && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-muted/50 rounded px-2 py-1.5">
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-medium">{owner.parsed.fullName || '–'}</span>
                            </div>
                            <div className="bg-muted/50 rounded px-2 py-1.5">
                              <span className="text-muted-foreground">Adresse: </span>
                              <span className="font-medium">{owner.parsed.address || '–'}</span>
                            </div>
                            <div className="bg-muted/50 rounded px-2 py-1.5">
                              <span className="text-muted-foreground">Eigentum: </span>
                              <span className="font-medium">{owner.parsed.ownershipType || '–'}</span>
                            </div>
                            <div className="bg-muted/50 rounded px-2 py-1.5">
                              <span className="text-muted-foreground">Suche: </span>
                              <span className="font-medium text-primary">{owner.parsed.searchName || '–'}</span>
                            </div>
                          </div>
                        )}

                        {/* Phone field */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Telefon</Label>
                          <Input
                            placeholder="+41 79 123 45 67"
                            value={owner.phone}
                            onChange={e => updateOwnerPhone(idx, e.target.value)}
                            className="h-10"
                          />
                        </div>
                      </div>

                      {/* AG/Stadt warning */}
                      {isNonPerson && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-3">
                          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-destructive">
                              {ownerType === 'stadt' ? 'Öffentlicher Eigentümer' : 'Firma / AG'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ownerType === 'stadt'
                                ? 'Stadt/Gemeinde/Kanton – verkauft praktisch nie.'
                                : 'Firmen/AGs verkaufen selten einzelne Liegenschaften.'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="shrink-0 gap-1 text-xs h-7"
                            disabled={processing}
                            onClick={async () => {
                              if (!current) return;
                              setProcessing(true);
                              try {
                                await updateProp.mutateAsync({
                                  id: current.id,
                                  is_queried: true,
                                  owner_name: owner.parsed.fullName || owner.raw || null,
                                  owner_address: owner.parsed.address || null,
                                  status: 'Ausgeblendet',
                                  notes: (current.notes ? current.notes + '\n' : '') + `Eigentümer-Typ: ${ownerTypeLabel(ownerType)} – nicht interessant`,
                                });
                                toast({ title: '⚠️ Ausgeblendet – weiter' });
                                moveToNext();
                              } catch {
                                toast({ title: 'Fehler', variant: 'destructive' });
                              } finally {
                                setProcessing(false);
                              }
                            }}
                          >
                            <EyeOff className="h-3 w-3" />
                            Ausblenden
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add owner button */}
                {owners.length < 10 && (
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground gap-1" onClick={addOwner}>
                    <Plus className="h-3 w-3" /> Weiteren Eigentümer hinzufügen ({owners.length}/10)
                  </Button>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-8 py-5 bg-muted/30 border-t space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" onClick={handleHide} disabled={processing} className="text-muted-foreground">
                          <EyeOff className="h-4 w-4 mr-2" /> Ausblenden
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><kbd className="font-mono text-xs">Ctrl+H</kbd></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={handleSkip} disabled={processing}>
                          <SkipForward className="h-4 w-4 mr-2" /> Überspringen
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><kbd className="font-mono text-xs">Ctrl+→</kbd></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSave}
                          disabled={processing || !selectedPhone || remaining <= 0}
                          className="sm:ml-auto h-12 px-8 text-base"
                          size="lg"
                        >
                          <Check className="h-5 w-5 mr-2" />
                          {hasAnyOwner ? 'Speichern & Nächstes' : 'Kein Ergebnis & Nächstes'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><kbd className="font-mono text-xs">Ctrl+Enter</kbd></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <Keyboard className="h-3 w-3" />
                  <span><kbd className="bg-muted px-1 rounded font-mono">Ctrl+Enter</kbd> Speichern</span>
                  <span><kbd className="bg-muted px-1 rounded font-mono">Ctrl+→</kbd> Skip</span>
                  <span><kbd className="bg-muted px-1 rounded font-mono">Ctrl+G</kbd> GIS</span>
                  <span><kbd className="bg-muted px-1 rounded font-mono">Ctrl+H</kbd> Ausblenden</span>
                </div>
              </div>
            </>

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

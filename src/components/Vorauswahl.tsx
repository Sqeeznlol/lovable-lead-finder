import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, SkipForward, EyeOff, Keyboard, MapPin, Calendar, Home, Ruler, Layers, ExternalLink, Sparkles, Filter, ChevronDown, ChevronUp, LayoutGrid, Table2, CheckCheck, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUnqueriedProperties, useUpdateProperty, useZones, useGemeinden } from '@/hooks/use-properties';
import { useVorauswahlStats } from '@/hooks/use-vorauswahl-stats';
import { VorauswahlStatsBar } from '@/components/VorauswahlStats';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';
import { useListFilter, useLists } from '@/hooks/use-lists';
import { ListSelector } from '@/components/ListSelector';

type ViewMode = 'card' | 'table';

export function Vorauswahl() {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [zoneFilter, setZoneFilter] = useState<string>('Alle');
  const [baujahrBis, setBaujahrBis] = useState<string>('1980');
  const [baujahrVon, setBaujahrVon] = useState<string>('');
  const [maxWhg, setMaxWhg] = useState<string>('');
  const [minWhg, setMinWhg] = useState<string>('');
  const [gemeindeFilter, setGemeindeFilter] = useState<string>('');
  const [bezirkFilter, setBezirkFilter] = useState<string>('');
  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: zones } = useZones();
  const { data: gemeinden } = useGemeinden();
  const { selectedListId } = useListFilter();
  const { data: lists } = useLists();
  const isPrioList = !!(selectedListId && lists?.find(l => l.id === selectedListId && l.priority < 0));
  const { data: queue, refetch } = useUnqueriedProperties(200, selectedListId, isPrioList);
  const { data: stats, refetch: refetchStats } = useVorauswahlStats();
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [sessionStats, setSessionStats] = useState({ interessant: 0, ausgeblendet: 0, skipped: 0 });

  const effectiveZoneFilter = isPrioList ? 'Alle' : zoneFilter;
  const effectiveBaujahrBis = isPrioList ? '' : baujahrBis;
  const baujahrMax = effectiveBaujahrBis ? parseInt(effectiveBaujahrBis, 10) : null;
  const baujahrMin = baujahrVon ? parseInt(baujahrVon, 10) : null;
  const maxWhgNum = maxWhg ? parseInt(maxWhg, 10) : null;
  const minWhgNum = minWhg ? parseInt(minWhg, 10) : null;

  const items = useMemo(() => (queue || [])
    .filter(p => p.status === 'Neu' || p.status === 'Offen')
    .filter(p => effectiveZoneFilter === 'Alle' || p.zone === effectiveZoneFilter)
    .filter(p => !baujahrMax || !p.baujahr || p.baujahr <= baujahrMax)
    .filter(p => !baujahrMin || !p.baujahr || p.baujahr >= baujahrMin)
    .filter(p => !maxWhgNum || !p.wohnungen || Number(p.wohnungen) <= maxWhgNum)
    .filter(p => !minWhgNum || (p.wohnungen && Number(p.wohnungen) >= minWhgNum))
    .filter(p => !gemeindeFilter || (p.gemeinde && p.gemeinde.toLowerCase().includes(gemeindeFilter.toLowerCase())))
    .filter(p => !bezirkFilter || (p.bezirk && p.bezirk.toLowerCase().includes(bezirkFilter.toLowerCase())))
    .filter(p => !kategorieFilter || kategorieFilter === 'Alle' || p.kategorie === kategorieFilter)
    .map(p => ({ ...p, _score: calculateDealScore(p) }))
    .sort((a, b) => b._score - a._score),
    [queue, effectiveZoneFilter, baujahrMax, baujahrMin, maxWhgNum, minWhgNum, gemeindeFilter, bezirkFilter, kategorieFilter]
  );

  const current = items[currentIndex];
  const score = current?._score ?? 0;
  const hasFilters = effectiveZoneFilter !== 'Alle' || baujahrVon || effectiveBaujahrBis !== '1980' || maxWhg || minWhg || gemeindeFilter || bezirkFilter || (kategorieFilter && kategorieFilter !== 'Alle');

  useEffect(() => { setCurrentIndex(0); }, [zoneFilter, baujahrBis, baujahrVon, maxWhg, minWhg, gemeindeFilter, bezirkFilter, kategorieFilter]);

  useEffect(() => {
    if (isPrioList && zoneFilter !== 'Alle') {
      setZoneFilter('Alle');
    }
  }, [isPrioList, zoneFilter]);

  const moveToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      refetchStats();
      setCurrentIndex(0);
    }
  }, [currentIndex, items.length, refetch, refetchStats]);

  const logDecision = useCallback(async (propertyId: string, decision: string, prop: typeof current) => {
    if (!user || !prop) return;
    await supabase.from('property_decisions').insert({
      property_id: propertyId,
      user_id: user.id,
      ai_score: prop.ai_score ? Number(prop.ai_score) : null,
      ai_recommendation: prop.ai_recommendation,
      ai_summary: prop.ai_summary,
      user_decision: decision,
      decision_matches_ai: prop.ai_recommendation
        ? (decision === 'interessant' && prop.ai_recommendation === 'interessant') ||
          (decision === 'nicht_interessant' && prop.ai_recommendation === 'eher nicht interessant')
        : null,
    });
  }, [user]);

  const handleInteressant = useCallback(async () => {
    if (!current || processing) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Vorausgewählt', review_status: 'approved', decided_by: user?.id, decided_at: new Date().toISOString() });
      await logDecision(current.id, 'interessant', current);
      setSessionStats(s => ({ ...s, interessant: s.interessant + 1 }));
      toast({ title: '👍 Vorausgewählt' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [current, processing, updateProp, moveToNext, toast, logDecision, user]);

  const handleNichtInteressant = useCallback(async () => {
    if (!current || processing) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Nicht interessant', review_status: 'rejected', decided_by: user?.id, decided_at: new Date().toISOString() });
      await logDecision(current.id, 'nicht_interessant', current);
      setSessionStats(s => ({ ...s, ausgeblendet: s.ausgeblendet + 1 }));
      toast({ title: '👎 Nicht interessant' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [current, processing, updateProp, moveToNext, toast, logDecision, user]);

  const handleSkip = useCallback(() => {
    setSessionStats(s => ({ ...s, skipped: s.skipped + 1 }));
    moveToNext();
  }, [moveToNext]);

  const handleHide = useCallback(async () => {
    if (!current || processing) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Ausgeblendet' });
      setSessionStats(s => ({ ...s, ausgeblendet: s.ausgeblendet + 1 }));
      toast({ title: 'Ausgeblendet' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [current, processing, updateProp, moveToNext, toast]);

  const handleAdoptAI = useCallback(async () => {
    if (!current || processing || !current.ai_recommendation) return;
    if (current.ai_recommendation === 'interessant') {
      await handleInteressant();
    } else {
      await handleNichtInteressant();
    }
  }, [current, processing, handleInteressant, handleNichtInteressant]);

  // Bulk actions
  const handleBulkAction = useCallback(async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    const status = action === 'approve' ? 'Vorausgewählt' : 'Nicht interessant';
    const reviewStatus = action === 'approve' ? 'approved' : 'rejected';
    const decision = action === 'approve' ? 'interessant' : 'nicht_interessant';
    let count = 0;
    for (const id of selectedIds) {
      const prop = items.find(p => p.id === id);
      try {
        await updateProp.mutateAsync({ id, status, review_status: reviewStatus, decided_by: user?.id, decided_at: new Date().toISOString() });
        if (prop) await logDecision(id, decision, prop);
        count++;
      } catch { /* skip */ }
    }
    setSelectedIds(new Set());
    toast({ title: `${count} Liegenschaften ${action === 'approve' ? 'vorausgewählt' : 'abgelehnt'}` });
    refetch();
    refetchStats();
    setProcessing(false);
  }, [selectedIds, items, updateProp, user, logDecision, toast, refetch, refetchStats]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(p => p.id)));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (viewMode !== 'card') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter' || e.key === 'j' || e.key === 'J') { e.preventDefault(); handleInteressant(); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleNichtInteressant(); return; }
      if (e.key === 'ArrowRight' || e.key === 's' || e.key === 'S') { e.preventDefault(); handleSkip(); return; }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); handleHide(); return; }
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); handleAdoptAI(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const mapsEmbedUrl = current?.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(current.address + (current.plz_ort ? ', ' + current.plz_ort : ''))}&t=k&z=18&output=embed`
    : null;

  const googleMapsUrl = current?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.address + (current.plz_ort ? ', ' + current.plz_ort : ''))}`
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Stats KPI bar */}
      <VorauswahlStatsBar
        stats={stats}
        filteredCount={items.length}
        showFiltered={!!hasFilters}
      />

      {/* Top bar with filters and view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold">Vorauswahl</h2>
          <ListSelector />
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 rounded-none" onClick={() => setViewMode('card')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 rounded-none" onClick={() => setViewMode('table')}>
              <Table2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Select value={effectiveZoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Alle">Alle Zonen</SelectItem>
              {(zones || []).map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">Bj.bis</Label>
            <Input type="number" value={effectiveBaujahrBis} onChange={e => setBaujahrBis(e.target.value)} className="w-20 h-8 text-xs" placeholder={isPrioList ? 'offen' : undefined} />
          </div>
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-muted-foreground">MaxWhg</Label>
            <Input type="number" value={maxWhg} onChange={e => setMaxWhg(e.target.value)} placeholder="∞" className="w-16 h-8 text-xs" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1 h-8 text-xs">
            <Filter className="h-3 w-3" />
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>✅ {sessionStats.interessant}</span>
          <span>❌ {sessionStats.ausgeblendet}</span>
          <span>⏭ {sessionStats.skipped}</span>
          <span className="font-medium text-foreground">#{currentIndex + 1}/{items.length}</span>
        </div>
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="bg-card rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Bj. von</Label>
            <Input type="number" value={baujahrVon} onChange={e => setBaujahrVon(e.target.value)} placeholder="1900" className="h-8 text-xs" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Min Whg.</Label>
            <Input type="number" value={minWhg} onChange={e => setMinWhg(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Gemeinde</Label>
            <Input value={gemeindeFilter} onChange={e => setGemeindeFilter(e.target.value)} placeholder="Suchen..." className="h-8 text-xs" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Bezirk</Label>
            <Input value={bezirkFilter} onChange={e => setBezirkFilter(e.target.value)} placeholder="Suchen..." className="h-8 text-xs" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Kategorie</Label>
            <Select value={kategorieFilter} onValueChange={setKategorieFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Alle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Alle">Alle</SelectItem>
                <SelectItem value="EFH">EFH</SelectItem>
                <SelectItem value="MFH">MFH</SelectItem>
                <SelectItem value="Gewerbe">Gewerbe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="space-y-2">
          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
              <CheckCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleBulkAction('approve')} disabled={processing}>
                  <ThumbsUp className="h-3 w-3" /> Alle interessant
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleBulkAction('reject')} disabled={processing}>
                  <ThumbsDown className="h-3 w-3" /> Alle ablehnen
                </Button>
              </div>
            </div>
          )}
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === items.length && items.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="text-xs">Score</TableHead>
                  <TableHead className="text-xs">Adresse</TableHead>
                  <TableHead className="text-xs">Zone</TableHead>
                  <TableHead className="text-xs">Bj.</TableHead>
                  <TableHead className="text-xs">Whg.</TableHead>
                  <TableHead className="text-xs">HNF</TableHead>
                  <TableHead className="text-xs">KI</TableHead>
                  <TableHead className="text-xs">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 50).map(p => {
                  const s = calculateDealScore(p);
                  return (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                      </TableCell>
                      <TableCell>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${scoreBg(s)}`}>
                          <span className={scoreColor(s)}>{s}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">{p.address}</p>
                          <p className="text-[10px] text-muted-foreground">{p.plz_ort || p.gemeinde || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{p.zone}</Badge></TableCell>
                      <TableCell className="text-xs">{p.baujahr || '–'}</TableCell>
                      <TableCell className="text-xs">{p.wohnungen ? Number(p.wohnungen) : '–'}</TableCell>
                      <TableCell className="text-xs">{p.gebaeudeflaeche ? `${Math.round(Number(p.gebaeudeflaeche))}m²` : '–'}</TableCell>
                      <TableCell>
                        {p.ai_recommendation ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={`text-[10px] gap-0.5 ${p.ai_recommendation === 'interessant' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : p.ai_recommendation === 'prüfen' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted text-muted-foreground'}`}>
                                <Sparkles className="h-2.5 w-2.5" /> {p.ai_recommendation}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p className="max-w-xs text-xs">{p.ai_summary || 'Keine Begründung'}</p></TooltipContent>
                          </Tooltip>
                        ) : <span className="text-xs text-muted-foreground">–</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => {
                            await updateProp.mutateAsync({ id: p.id, status: 'Vorausgewählt', review_status: 'approved', decided_by: user?.id, decided_at: new Date().toISOString() });
                            await logDecision(p.id, 'interessant', { ...p, _score: s });
                            refetch(); refetchStats();
                            toast({ title: '👍 Vorausgewählt' });
                          }}>
                            <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => {
                            await updateProp.mutateAsync({ id: p.id, status: 'Nicht interessant', review_status: 'rejected', decided_by: user?.id, decided_at: new Date().toISOString() });
                            await logDecision(p.id, 'nicht_interessant', { ...p, _score: s });
                            refetch(); refetchStats();
                            toast({ title: '👎 Nicht interessant' });
                          }}>
                            <ThumbsDown className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {items.length > 50 && (
            <p className="text-xs text-muted-foreground text-center">Zeige 50 von {items.length} — Filter verwenden für präzisere Ergebnisse</p>
          )}
        </div>
      )}

      {/* CARD VIEW */}
      {viewMode === 'card' && (
        <>
          <Progress value={items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0} className="h-1.5" />

          {!current ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Card className="border-none shadow-lg max-w-md w-full">
                <CardContent className="p-12 text-center space-y-4">
                  <ThumbsUp className="h-16 w-16 mx-auto text-accent" />
                  <h3 className="text-xl font-bold">Alle vorselektiert! 🎉</h3>
                  <p className="text-muted-foreground">
                    Keine weiteren Liegenschaften {zoneFilter !== 'Alle' ? `in Zone ${zoneFilter}` : ''} zum Vorselektieren.
                  </p>
                  <div className="flex gap-4 justify-center text-sm text-muted-foreground">
                    <span>✅ {sessionStats.interessant} interessant</span>
                    <span>❌ {sessionStats.ausgeblendet} ausgeblendet</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Main Card */}
              <Card className="border-none shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  {/* Property info header */}
                  <div className="p-5 pb-3 bg-gradient-to-br from-card to-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {current.zone && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{current.zone}</Badge>}
                          {current.gebaeudeart && <Badge variant="outline" className="text-[10px]">{current.gebaeudeart}</Badge>}
                          {current.kategorie && <Badge variant="outline" className="text-[10px]">{current.kategorie}</Badge>}
                          {current.wohnungen && <Badge variant="outline" className="text-[10px]">{current.wohnungen} Whg.</Badge>}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{current.address}</h2>
                        <p className="text-muted-foreground text-sm mt-0.5">{current.plz_ort || current.gemeinde || ''}</p>
                      </div>
                      <div className={`flex-shrink-0 w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center ${scoreBg(score)}`}>
                        <span className={`text-xl font-black ${scoreColor(score)}`}>{score}</span>
                        <span className="text-[8px] text-muted-foreground font-medium">SCORE</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {current.gebaeudeflaeche && (
                        <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                          <Home className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-[9px] text-muted-foreground">HNF</p>
                            <p className="font-semibold text-sm">{Math.round(Number(current.gebaeudeflaeche))} m²</p>
                          </div>
                        </div>
                      )}
                      {current.area && (
                        <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                          <Ruler className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-[9px] text-muted-foreground">Grundstück</p>
                            <p className="font-semibold text-sm">{Math.round(Number(current.area))} m²</p>
                          </div>
                        </div>
                      )}
                      {current.baujahr && (
                        <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-[9px] text-muted-foreground">Baujahr</p>
                            <p className="font-semibold text-sm">{current.baujahr}</p>
                          </div>
                        </div>
                      )}
                      {current.geschosse && (
                        <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-[9px] text-muted-foreground">Geschosse</p>
                            <p className="font-semibold text-sm">{Number(current.geschosse)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Recommendation box */}
                  {current.ai_recommendation && (
                    <div className="mx-5 mt-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-primary uppercase">KI-Empfehlung</span>
                          <Badge className={`text-[10px] ${current.ai_recommendation === 'interessant' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : current.ai_recommendation === 'prüfen' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted text-muted-foreground'}`}>
                            {current.ai_recommendation}
                          </Badge>
                          {current.ai_score && (
                            <span className="text-xs text-muted-foreground">Score: {Number(current.ai_score).toFixed(0)}</span>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleAdoptAI}>
                          <Wand2 className="h-3 w-3" /> Übernehmen
                        </Button>
                      </div>
                      {current.ai_summary && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{current.ai_summary}</p>
                      )}
                    </div>
                  )}

                  {/* Owner info */}
                  {current.owner_name && (
                    <div className="mx-5 mt-2 rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Eigentümer: <span className="text-foreground font-medium">{current.owner_name}</span></p>
                      {current.owner_name_2 && <p className="text-xs text-muted-foreground">Eigentümer 2: <span className="text-foreground font-medium">{current.owner_name_2}</span></p>}
                    </div>
                  )}

                  {/* Google Maps embed or fallback */}
                  <div className="border-t mt-3">
                    {mapsEmbedUrl ? (
                      <iframe
                        src={mapsEmbedUrl}
                        className="w-full h-[400px] sm:h-[500px]"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                        title="Google Maps Vorschau"
                      />
                    ) : (
                      <div className="w-full h-48 flex flex-col items-center justify-center bg-muted/30 gap-3">
                        <MapPin className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground text-sm">Keine Kartenvorschau verfügbar</p>
                        {current.google_maps_url && (
                          <a href={current.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> In Google Maps öffnen
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground">Du kannst trotzdem entscheiden ↓</p>
                      </div>
                    )}
                  </div>

                  {/* GIS ZH ÖREB Map */}
                  {current.egrid && current.bfs_nr && (
                    <div className="border-t">
                      <div className="flex items-center gap-2 px-5 py-1.5 bg-muted/30">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">GIS ZH – ÖREB / Parzelle</span>
                        <a
                          href={`https://maps.zh.ch/?topic=OeijRBKatZH&offlayers=bezirkslabels&scale=2000&x=2683000&y=1248000&egrid=${current.egrid}&bfsnr=${current.bfs_nr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Öffnen
                        </a>
                      </div>
                      <iframe
                        src={`https://maps.zh.ch/?topic=OeijRBKatZH&offlayers=bezirkslabels&scale=2000&x=2683000&y=1248000&egrid=${current.egrid}&bfsnr=${current.bfs_nr}`}
                        className="w-full h-[250px]"
                        style={{ border: 0 }}
                        loading="lazy"
                        title="GIS ZH ÖREB"
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="px-5 py-4 bg-muted/30 border-t space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="ghost" onClick={handleHide} disabled={processing} className="text-muted-foreground gap-1.5 h-9 text-sm">
                        <EyeOff className="h-3.5 w-3.5" /> Ausblenden
                      </Button>
                      <Button variant="outline" onClick={handleSkip} disabled={processing} className="gap-1.5 h-9 text-sm">
                        <SkipForward className="h-3.5 w-3.5" /> Überspringen
                      </Button>
                      <Button variant="destructive" onClick={handleNichtInteressant} disabled={processing} className="gap-1.5 h-9 text-sm">
                        <ThumbsDown className="h-3.5 w-3.5" /> Nicht interessant
                      </Button>
                      <Button onClick={handleInteressant} disabled={processing} className="sm:ml-auto h-11 px-8 text-base gap-2" size="lg">
                        <ThumbsUp className="h-5 w-5" /> Interessant
                      </Button>
                    </div>
                    {googleMapsUrl && (
                      <div className="flex justify-end">
                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Google Maps öffnen
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <Keyboard className="h-3 w-3" />
                      <span><kbd className="bg-muted px-1 rounded font-mono">Enter/J</kbd> Interessant</span>
                      <span><kbd className="bg-muted px-1 rounded font-mono">N</kbd> Nein</span>
                      <span><kbd className="bg-muted px-1 rounded font-mono">→/S</kbd> Skip</span>
                      <span><kbd className="bg-muted px-1 rounded font-mono">H</kbd> Ausblenden</span>
                      <span><kbd className="bg-muted px-1 rounded font-mono">A</kbd> KI übernehmen</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Next in queue */}
              {items.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nächste</p>
                  {items.slice(currentIndex + 1, currentIndex + 4).map(p => {
                    const s = calculateDealScore(p);
                    return (
                      <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-2 shadow-sm border">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${scoreBg(s)}`}>
                          <span className={scoreColor(s)}>{s}</span>
                        </div>
                        <span className="truncate flex-1 text-sm font-medium">{p.address}</span>
                        {p.zone && <Badge variant="outline" className="text-[10px]">{p.zone}</Badge>}
                        {p.gebaeudeflaeche && <span className="text-xs text-muted-foreground">{Math.round(Number(p.gebaeudeflaeche))}m²</span>}
                        {p.ai_recommendation && (
                          <Badge className={`text-[10px] ${p.ai_recommendation === 'interessant' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />{p.ai_recommendation}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, SkipForward, EyeOff, Keyboard, MapPin, Calendar, Home, Ruler, Layers, ExternalLink, Sparkles, BarChart3, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnqueriedProperties, useUpdateProperty, useZones, useGemeinden } from '@/hooks/use-properties';
import { useVorauswahlStats } from '@/hooks/use-vorauswahl-stats';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';

export function Vorauswahl() {
  const [zoneFilter, setZoneFilter] = useState<string>('Alle');
  const [baujahrBis, setBaujahrBis] = useState<string>('1980');
  const [baujahrVon, setBaujahrVon] = useState<string>('');
  const [maxWhg, setMaxWhg] = useState<string>('');
  const [minWhg, setMinWhg] = useState<string>('');
  const [gemeindeFilter, setGemeindeFilter] = useState<string>('');
  const [bezirkFilter, setBezirkFilter] = useState<string>('');
  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const { data: zones } = useZones();
  const { data: gemeinden } = useGemeinden();
  const { data: queue, refetch } = useUnqueriedProperties(200);
  const { data: stats, refetch: refetchStats } = useVorauswahlStats();
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [sessionStats, setSessionStats] = useState({ interessant: 0, ausgeblendet: 0, skipped: 0 });

  const baujahrMax = baujahrBis ? parseInt(baujahrBis, 10) : null;
  const baujahrMin = baujahrVon ? parseInt(baujahrVon, 10) : null;
  const maxWhgNum = maxWhg ? parseInt(maxWhg, 10) : null;
  const minWhgNum = minWhg ? parseInt(minWhg, 10) : null;

  const items = useMemo(() => (queue || [])
    .filter(p => p.status === 'Neu' || p.status === 'Offen')
    .filter(p => zoneFilter === 'Alle' || p.zone === zoneFilter)
    .filter(p => !baujahrMax || !p.baujahr || p.baujahr <= baujahrMax)
    .filter(p => !baujahrMin || !p.baujahr || p.baujahr >= baujahrMin)
    .filter(p => !maxWhgNum || !p.wohnungen || Number(p.wohnungen) <= maxWhgNum)
    .filter(p => !minWhgNum || (p.wohnungen && Number(p.wohnungen) >= minWhgNum))
    .filter(p => !gemeindeFilter || (p.gemeinde && p.gemeinde.toLowerCase().includes(gemeindeFilter.toLowerCase())))
    .filter(p => !bezirkFilter || (p.bezirk && p.bezirk.toLowerCase().includes(bezirkFilter.toLowerCase())))
    .filter(p => !kategorieFilter || kategorieFilter === 'Alle' || p.kategorie === kategorieFilter)
    .map(p => ({ ...p, _score: calculateDealScore(p) }))
    .sort((a, b) => b._score - a._score),
    [queue, zoneFilter, baujahrMax, baujahrMin, maxWhgNum, minWhgNum, gemeindeFilter, bezirkFilter, kategorieFilter]
  );

  const current = items[currentIndex];
  const score = current?._score ?? 0;

  useEffect(() => { setCurrentIndex(0); }, [zoneFilter, baujahrBis, baujahrVon, maxWhg, minWhg, gemeindeFilter, bezirkFilter, kategorieFilter]);

  const moveToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      refetchStats();
      setCurrentIndex(0);
    }
  }, [currentIndex, items.length, refetch, refetchStats]);

  const logDecision = useCallback(async (decision: string) => {
    if (!current || !user) return;
    await supabase.from('property_decisions').insert({
      property_id: current.id,
      user_id: user.id,
      ai_score: current.ai_score ? Number(current.ai_score) : null,
      ai_recommendation: current.ai_recommendation,
      user_decision: decision,
      decision_matches_ai: current.ai_recommendation
        ? (decision === 'interessant' && current.ai_recommendation === 'interessant') ||
          (decision === 'nicht_interessant' && current.ai_recommendation === 'eher nicht interessant')
        : null,
    });
  }, [current, user]);

  const handleInteressant = useCallback(async () => {
    if (!current || processing) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Vorausgewählt', review_status: 'approved', decided_by: user?.id, decided_at: new Date().toISOString() });
      await logDecision('interessant');
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
      await logDecision('nicht_interessant');
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter' || e.key === 'j' || e.key === 'J') { e.preventDefault(); handleInteressant(); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleNichtInteressant(); return; }
      if (e.key === 'ArrowRight' || e.key === 's' || e.key === 'S') { e.preventDefault(); handleSkip(); return; }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); handleHide(); return; }
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Stats bar - always visible */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'Insgesamt', value: stats?.total ?? 0, color: 'text-foreground' },
          { label: 'Offen', value: stats?.pending ?? 0, color: 'text-warning' },
          { label: 'Interessant', value: stats?.approved ?? 0, color: 'text-accent' },
          { label: 'Nicht int.', value: stats?.rejected ?? 0, color: 'text-destructive' },
          { label: 'Heute', value: stats?.todayProcessed ?? 0, color: 'text-primary' },
          { label: 'Fortschritt', value: `${stats?.progressPercent ?? 0}%`, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-lg border px-3 py-2 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value.toLocaleString('de-CH') : s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top bar with filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold">Vorauswahl</h2>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
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
            <Input type="number" value={baujahrBis} onChange={e => setBaujahrBis(e.target.value)} className="w-20 h-8 text-xs" />
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
                      {current.ai_recommendation && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className={`text-[10px] gap-1 ${current.ai_recommendation === 'interessant' ? 'bg-accent/10 text-accent border-accent/20' : current.ai_recommendation === 'prüfen' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground'}`}>
                              <Sparkles className="h-3 w-3" /> KI: {current.ai_recommendation}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent><p className="max-w-xs text-xs">{current.ai_summary || 'Keine Begründung'}</p></TooltipContent>
                        </Tooltip>
                      )}
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

              {/* Google Maps embed */}
              <div className="border-t">
                {mapsEmbedUrl ? (
                  <iframe
                    src={mapsEmbedUrl}
                    className="w-full h-64 sm:h-80"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title="Google Maps Vorschau"
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center bg-muted/30">
                    <p className="text-muted-foreground text-sm">Keine Kartenvorschau verfügbar</p>
                  </div>
                )}
              </div>

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
                      <Badge className={`text-[10px] ${p.ai_recommendation === 'interessant' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
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
    </div>
  );
}

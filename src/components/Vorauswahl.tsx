import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, SkipForward, EyeOff, Keyboard, MapPin, Calendar, Home, Ruler, Layers, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnqueriedProperties, useUpdateProperty, useZones } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';

export function Vorauswahl() {
  const [zoneFilter, setZoneFilter] = useState<string>('Alle');
  const [baujahrBis, setBaujahrBis] = useState<string>('1980');
  const [maxWhg, setMaxWhg] = useState<string>('');
  const [minWhg, setMinWhg] = useState<string>('');
  const [gemeindeFilter, setGemeindeFilter] = useState<string>('');
  const { data: zones } = useZones();
  const { data: queue, refetch } = useUnqueriedProperties(200);
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ interessant: 0, ausgeblendet: 0, skipped: 0 });

  const baujahrMax = baujahrBis ? parseInt(baujahrBis, 10) : null;
  const maxWhgNum = maxWhg ? parseInt(maxWhg, 10) : null;
  const minWhgNum = minWhg ? parseInt(minWhg, 10) : null;
  const items = (queue || [])
    .filter(p => p.status === 'Neu' || p.status === 'Offen')
    .filter(p => zoneFilter === 'Alle' || p.zone === zoneFilter)
    .filter(p => !baujahrMax || !p.baujahr || p.baujahr <= baujahrMax)
    .filter(p => !maxWhgNum || !p.wohnungen || Number(p.wohnungen) <= maxWhgNum)
    .filter(p => !minWhgNum || (p.wohnungen && Number(p.wohnungen) >= minWhgNum))
    .filter(p => !gemeindeFilter || (p.gemeinde && p.gemeinde.toLowerCase().includes(gemeindeFilter.toLowerCase())))
    .map(p => ({ ...p, _score: calculateDealScore(p) }))
    .sort((a, b) => b._score - a._score);

  const current = items[currentIndex];
  const score = current?._score ?? 0;

  useEffect(() => { setCurrentIndex(0); }, [zoneFilter, baujahrBis, maxWhg, minWhg, gemeindeFilter]);

  const moveToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      refetch();
      setCurrentIndex(0);
    }
  }, [currentIndex, items.length, refetch]);

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
      setStats(s => ({ ...s, interessant: s.interessant + 1 }));
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
      setStats(s => ({ ...s, ausgeblendet: s.ausgeblendet + 1 }));
      toast({ title: '👎 Nicht interessant' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [current, processing, updateProp, moveToNext, toast, logDecision, user]);

  const handleSkip = useCallback(() => {
    setStats(s => ({ ...s, skipped: s.skipped + 1 }));
    moveToNext();
  }, [moveToNext]);

  const handleHide = useCallback(async () => {
    if (!current || processing) return;
    setProcessing(true);
    try {
      await updateProp.mutateAsync({ id: current.id, status: 'Ausgeblendet' });
      setStats(s => ({ ...s, ausgeblendet: s.ausgeblendet + 1 }));
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

      if (e.key === 'Enter' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleInteressant();
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNichtInteressant();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSkip();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleHide();
        return;
      }
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

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg max-w-md w-full">
          <CardContent className="p-12 text-center space-y-4">
            <ThumbsUp className="h-16 w-16 mx-auto text-accent" />
            <h3 className="text-xl font-bold">Alle vorselektiert! 🎉</h3>
            <p className="text-muted-foreground">
              Keine weiteren Liegenschaften {zoneFilter !== 'Alle' ? `in Zone ${zoneFilter}` : ''} zum Vorselektieren.
            </p>
            <div className="flex gap-4 justify-center text-sm text-muted-foreground">
              <span>✅ {stats.interessant} interessant</span>
              <span>❌ {stats.ausgeblendet} ausgeblendet</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Vorauswahl</h2>
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
            <Label htmlFor="va-baujahr" className="text-xs text-muted-foreground whitespace-nowrap">Bj. bis</Label>
            <Input
              id="va-baujahr"
              type="number"
              value={baujahrBis}
              onChange={e => setBaujahrBis(e.target.value)}
              className="w-24 h-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="va-maxwhg" className="text-xs text-muted-foreground whitespace-nowrap">Max Whg.</Label>
            <Input
              id="va-maxwhg"
              type="number"
              value={maxWhg}
              onChange={e => setMaxWhg(e.target.value)}
              placeholder="∞"
              className="w-20 h-9"
            />
          </div>
        </div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>✅ {stats.interessant}</span>
          <span>❌ {stats.ausgeblendet}</span>
          <span>⏭ {stats.skipped}</span>
          <span className="font-medium text-foreground">#{currentIndex + 1}/{items.length}</span>
        </div>
      </div>

      <Progress value={items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0} className="h-1.5" />

      {/* Main Card */}
      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Property info header */}
          <div className="p-6 pb-4 bg-gradient-to-br from-card to-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {current.zone && <Badge className="bg-primary/10 text-primary border-primary/20">{current.zone}</Badge>}
                  {current.gebaeudeart && <Badge variant="outline" className="text-xs">{current.gebaeudeart}</Badge>}
                  {current.kategorie && <Badge variant="outline" className="text-xs">{current.kategorie}</Badge>}
                  {current.wohnungen && <Badge variant="outline" className="text-xs">{current.wohnungen} Whg.</Badge>}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{current.address}</h2>
                <p className="text-muted-foreground mt-1">{current.plz_ort || current.gemeinde || ''}</p>
              </div>
              <div className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center ${scoreBg(score)}`}>
                <span className={`text-xl font-black ${scoreColor(score)}`}>{score}</span>
                <span className="text-[9px] text-muted-foreground font-medium">SCORE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {current.gebaeudeflaeche && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Home className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">HNF</p>
                    <p className="font-semibold text-sm">{Math.round(Number(current.gebaeudeflaeche))} m²</p>
                  </div>
                </div>
              )}
              {current.area && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Ruler className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Grundstück</p>
                    <p className="font-semibold text-sm">{Math.round(Number(current.area))} m²</p>
                  </div>
                </div>
              )}
              {current.baujahr && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Baujahr</p>
                    <p className="font-semibold text-sm">{current.baujahr}</p>
                  </div>
                </div>
              )}
              {current.geschosse && (
                <div className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2">
                  <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Geschosse</p>
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
                className="w-full h-80 sm:h-96"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                title="Google Maps Vorschau"
              />
            ) : (
              <div className="w-full h-80 flex items-center justify-center bg-muted/30">
                <p className="text-muted-foreground text-sm">Keine Kartenvorschau verfügbar</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-6 py-5 bg-muted/30 border-t space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" onClick={handleHide} disabled={processing} className="text-muted-foreground gap-2">
                <EyeOff className="h-4 w-4" /> Ausblenden
              </Button>
              <Button variant="outline" onClick={handleSkip} disabled={processing} className="gap-2">
                <SkipForward className="h-4 w-4" /> Überspringen
              </Button>
              <Button
                variant="destructive"
                onClick={handleNichtInteressant}
                disabled={processing}
                className="gap-2"
              >
                <ThumbsDown className="h-4 w-4" /> Nicht interessant
              </Button>
              <Button
                onClick={handleInteressant}
                disabled={processing}
                className="sm:ml-auto h-12 px-8 text-base gap-2"
                size="lg"
              >
                <ThumbsUp className="h-5 w-5" />
                Interessant
              </Button>
            </div>
            {googleMapsUrl && (
              <div className="flex justify-end">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Google Maps öffnen
                </a>
              </div>
            )}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <Keyboard className="h-3 w-3" />
              <span><kbd className="bg-muted px-1 rounded font-mono">Enter</kbd> / <kbd className="bg-muted px-1 rounded font-mono">J</kbd> Interessant</span>
              <span><kbd className="bg-muted px-1 rounded font-mono">N</kbd> Nicht interessant</span>
              <span><kbd className="bg-muted px-1 rounded font-mono">→</kbd> / <kbd className="bg-muted px-1 rounded font-mono">S</kbd> Skip</span>
              <span><kbd className="bg-muted px-1 rounded font-mono">H</kbd> Ausblenden</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next in queue */}
      {items.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nächste</p>
          {items.slice(currentIndex + 1, currentIndex + 4).map(p => {
            const s = calculateDealScore(p);
            return (
              <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-2.5 shadow-sm border">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${scoreBg(s)}`}>
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

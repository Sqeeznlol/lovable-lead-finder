import { useState, useRef, useCallback, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Clock, MapPin, Calendar, Home, Ruler, Layers, Sparkles, LogOut, Wand2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUnqueriedProperties, useUpdateProperty } from '@/hooks/use-properties';
import { useListFilter } from '@/hooks/use-lists';
import { useVorauswahlStats } from '@/hooks/use-vorauswahl-stats';
import { useToast } from '@/hooks/use-toast';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

export function MobileSwipe() {
  const { selectedListId } = useListFilter();
  const { data: queue, refetch } = useUnqueriedProperties(50, selectedListId);
  const { data: stats, refetch: refetchStats } = useVorauswahlStats();
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [sessionStats, setSessionStats] = useState({ interessant: 0, nein: 0, spaeter: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentXRef = useRef(0);
  const isDragging = useRef(false);

  const items = (queue || [])
    .filter(p => p.status === 'Neu' || p.status === 'Offen')
    .map(p => ({ ...p, _score: calculateDealScore(p) }))
    .sort((a, b) => b._score - a._score);

  const current = items[currentIndex];
  const score = current?._score ?? 0;

  const moveToNext = useCallback(() => {
    setTimeout(() => {
      setSwipeDirection(null);
      if (currentIndex < items.length - 1) {
        setCurrentIndex(i => i + 1);
      } else {
        refetch();
        refetchStats();
        setCurrentIndex(0);
      }
    }, 300);
  }, [currentIndex, items.length, refetch, refetchStats]);

  const handleDecision = useCallback(async (decision: 'interessant' | 'nicht_interessant' | 'spaeter') => {
    if (!current || processing) return;
    setProcessing(true);

    if (decision === 'spaeter') {
      setSessionStats(s => ({ ...s, spaeter: s.spaeter + 1 }));
      moveToNext();
      setProcessing(false);
      return;
    }

    setSwipeDirection(decision === 'interessant' ? 'right' : 'left');

    try {
      const newStatus = decision === 'interessant' ? 'Vorausgewählt' : 'Nicht interessant';
      const newReview = decision === 'interessant' ? 'approved' : 'rejected';
      await updateProp.mutateAsync({
        id: current.id,
        status: newStatus,
        review_status: newReview,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
      });

      await supabase.from('property_decisions').insert({
        property_id: current.id,
        user_id: user?.id,
        ai_score: current.ai_score ? Number(current.ai_score) : null,
        ai_recommendation: current.ai_recommendation,
        ai_summary: current.ai_summary,
        user_decision: decision,
        decision_matches_ai: current.ai_recommendation
          ? (decision === 'interessant' && current.ai_recommendation === 'interessant') ||
            (decision === 'nicht_interessant' && current.ai_recommendation === 'eher nicht interessant')
          : null,
      });

      setSessionStats(s => ({
        ...s,
        interessant: s.interessant + (decision === 'interessant' ? 1 : 0),
        nein: s.nein + (decision === 'nicht_interessant' ? 1 : 0),
      }));
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
      setSwipeDirection(null);
    } finally {
      setProcessing(false);
    }
  }, [current, processing, updateProp, user, moveToNext, toast]);

  const handleAdoptAI = useCallback(() => {
    if (!current?.ai_recommendation) return;
    if (current.ai_recommendation === 'interessant') handleDecision('interessant');
    else handleDecision('nicht_interessant');
  }, [current, handleDecision]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    currentXRef.current = e.touches[0].clientX - startX.current;
    if (cardRef.current) {
      const rotate = currentXRef.current * 0.04;
      cardRef.current.style.transform = `translateX(${currentXRef.current}px) rotate(${rotate}deg)`;
      cardRef.current.style.opacity = String(1 - Math.abs(currentXRef.current) / 500);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (Math.abs(currentXRef.current) > 80) {
      handleDecision(currentXRef.current > 0 ? 'interessant' : 'nicht_interessant');
    }
    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.opacity = '1';
    }
    currentXRef.current = 0;
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleDecision('interessant');
      if (e.key === 'ArrowLeft') handleDecision('nicht_interessant');
      if (e.key === 'ArrowDown') handleDecision('spaeter');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDecision]);

  if (!current) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <ThumbsUp className="h-16 w-16 mx-auto text-accent" />
          <h2 className="text-2xl font-bold">Alles bewertet! 🎉</h2>
          <p className="text-muted-foreground">
            {sessionStats.interessant} interessant · {sessionStats.nein} abgelehnt · {sessionStats.spaeter} übersprungen
          </p>
          <Button onClick={() => { refetch(); refetchStats(); setCurrentIndex(0); }} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Neu laden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background select-none">
      {/* Compact header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card safe-area-top">
        <h1 className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Sqeeztraum
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span>✅{sessionStats.interessant}</span>
            <span>❌{sessionStats.nein}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut} className="h-7 w-7 p-0">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="px-4 py-1.5 border-b bg-muted/20">
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: 'Gesamt', value: stats?.total ?? 0 },
            { label: 'Offen', value: stats?.pending ?? 0 },
            { label: 'Ja', value: stats?.approved ?? 0 },
            { label: 'Nein', value: stats?.rejected ?? 0 },
            { label: 'Fortschritt', value: `${stats?.progressPercent ?? 0}%` },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs font-bold tabular-nums">{typeof s.value === 'number' ? s.value.toLocaleString('de-CH') : s.value}</p>
              <p className="text-[8px] text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
        </div>
        <Progress value={stats?.progressPercent ?? 0} className="h-0.5 mt-1" />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-3 overflow-hidden">
        <div
          ref={cardRef}
          className={`w-full max-w-sm bg-card rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 will-change-transform
            ${swipeDirection === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' : ''}
            ${swipeDirection === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' : ''}
          `}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] h-5">#{currentIndex + 1}/{items.length}</Badge>
              {current.zone && <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] h-5">{current.zone}</Badge>}
              {current.kategorie && <Badge variant="outline" className="text-[9px] h-5">{current.kategorie}</Badge>}
            </div>
            <div className={`w-10 h-10 rounded-xl border-2 flex flex-col items-center justify-center ${scoreBg(score)}`}>
              <span className={`text-sm font-black ${scoreColor(score)}`}>{score}</span>
            </div>
          </div>

          {/* Address */}
          <div className="px-4 py-2">
            <h2 className="text-base font-bold leading-tight">{current.address}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{current.plz_ort || current.gemeinde || ''}</p>
          </div>

          {/* Key data grid */}
          <div className="px-3 pb-2 grid grid-cols-3 gap-1">
            {current.wohnungen && (
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
                <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-muted-foreground">Whg.</p>
                  <p className="font-bold text-xs">{Number(current.wohnungen)}</p>
                </div>
              </div>
            )}
            {current.baujahr && (
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
                <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-muted-foreground">Bj.</p>
                  <p className="font-bold text-xs">{current.baujahr}</p>
                </div>
              </div>
            )}
            {current.gebaeudeflaeche && (
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
                <Home className="h-3 w-3 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-muted-foreground">HNF</p>
                  <p className="font-bold text-xs">{Math.round(Number(current.gebaeudeflaeche))}m²</p>
                </div>
              </div>
            )}
            {current.area && (
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
                <Ruler className="h-3 w-3 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-muted-foreground">GS</p>
                  <p className="font-bold text-xs">{Math.round(Number(current.area))}m²</p>
                </div>
              </div>
            )}
            {current.geschosse && (
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
                <Layers className="h-3 w-3 text-primary flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-muted-foreground">Gesch.</p>
                  <p className="font-bold text-xs">{Number(current.geschosse)}</p>
                </div>
              </div>
            )}
          </div>

          {/* AI recommendation */}
          {current.ai_recommendation && (
            <div className="mx-3 mb-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-bold text-primary uppercase">KI</span>
                  <Badge className={`text-[9px] h-4 ${current.ai_recommendation === 'interessant' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : current.ai_recommendation === 'prüfen' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted text-muted-foreground'}`}>
                    {current.ai_recommendation}
                  </Badge>
                  {current.ai_score && <span className="text-[9px] text-muted-foreground">{Number(current.ai_score).toFixed(0)}pts</span>}
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-[9px] gap-0.5 px-1.5" onClick={handleAdoptAI}>
                  <Wand2 className="h-2.5 w-2.5" /> Übernehmen
                </Button>
              </div>
              {current.ai_summary && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">{current.ai_summary}</p>
              )}
            </div>
          )}

          {/* Owner hint */}
          {current.owner_name && (
            <div className="px-3 pb-2">
              <p className="text-[10px] text-muted-foreground">Eigentümer: <span className="text-foreground font-medium">{current.owner_name}</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-3 pt-1 space-y-2 safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="destructive"
            size="lg"
            className="flex-1 h-14 text-base rounded-2xl gap-2 active:scale-95 transition-transform"
            onClick={() => handleDecision('nicht_interessant')}
            disabled={processing}
          >
            <ThumbsDown className="h-5 w-5" /> Nein
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 w-14 rounded-2xl p-0 active:scale-95 transition-transform"
            onClick={() => handleDecision('spaeter')}
            disabled={processing}
          >
            <Clock className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 text-base rounded-2xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 transition-transform"
            onClick={() => handleDecision('interessant')}
            disabled={processing}
          >
            <ThumbsUp className="h-5 w-5" /> Ja
          </Button>
        </div>
        <p className="text-center text-[9px] text-muted-foreground">
          ← Swipe links = Nein · ⏳ Später · Swipe rechts = Ja →
        </p>
      </div>
    </div>
  );
}

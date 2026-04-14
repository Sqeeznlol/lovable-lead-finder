import { useState, useRef, useCallback, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MapPin, Calendar, Home, Ruler, Layers, Sparkles, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUnqueriedProperties, useUpdateProperty } from '@/hooks/use-properties';
import { useVorauswahlStats } from '@/hooks/use-vorauswahl-stats';
import { useToast } from '@/hooks/use-toast';
import { calculateDealScore, scoreColor, scoreBg } from '@/lib/deal-score';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

export function MobileSwipe() {
  const { data: queue, refetch } = useUnqueriedProperties(50);
  const { data: stats, refetch: refetchStats } = useVorauswahlStats();
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [sessionStats, setSessionStats] = useState({ interessant: 0, nein: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
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

  const handleDecision = useCallback(async (decision: 'interessant' | 'nicht_interessant') => {
    if (!current || processing) return;
    setProcessing(true);
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
        user_decision: decision,
        decision_matches_ai: current.ai_recommendation
          ? (decision === 'interessant' && current.ai_recommendation === 'interessant') ||
            (decision === 'nicht_interessant' && current.ai_recommendation === 'eher nicht interessant')
          : null,
      });

      setSessionStats(s => ({
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

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    currentX.current = e.touches[0].clientX - startX.current;
    if (cardRef.current) {
      const rotate = currentX.current * 0.05;
      cardRef.current.style.transform = `translateX(${currentX.current}px) rotate(${rotate}deg)`;
      cardRef.current.style.opacity = String(1 - Math.abs(currentX.current) / 400);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (Math.abs(currentX.current) > 100) {
      handleDecision(currentX.current > 0 ? 'interessant' : 'nicht_interessant');
    }
    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.opacity = '1';
    }
    currentX.current = 0;
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleDecision('interessant');
      if (e.key === 'ArrowLeft') handleDecision('nicht_interessant');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDecision]);

  if (!current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <ThumbsUp className="h-16 w-16 mx-auto text-accent" />
          <h2 className="text-2xl font-bold">Alles bewertet! 🎉</h2>
          <p className="text-muted-foreground">
            {sessionStats.interessant} interessant · {sessionStats.nein} abgelehnt
          </p>
          <Button onClick={() => { refetch(); refetchStats(); setCurrentIndex(0); }}>Neu laden</Button>
        </div>
      </div>
    );
  }

  const totalProcessed = (stats?.approved ?? 0) + (stats?.rejected ?? 0);
  const progressPercent = stats?.total ? Math.round((totalProcessed / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Sqeeztraum
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            ✅ {sessionStats.interessant} · ❌ {sessionStats.nein}
          </span>
          <Button size="sm" variant="ghost" onClick={signOut} className="text-xs h-7 px-2">
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Offen: {stats?.pending?.toLocaleString('de-CH') ?? '...'}</span>
          <span>Interessant: {stats?.approved?.toLocaleString('de-CH') ?? '...'}</span>
          <span>Fortschritt: {progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          ref={cardRef}
          className={`w-full max-w-sm bg-card rounded-2xl shadow-xl border overflow-hidden transition-all duration-300
            ${swipeDirection === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' : ''}
            ${swipeDirection === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' : ''}
          `}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Score bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">#{currentIndex + 1}/{items.length}</Badge>
              {current.zone && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">{current.zone}</Badge>}
            </div>
            <div className={`w-11 h-11 rounded-xl border-2 flex flex-col items-center justify-center ${scoreBg(score)}`}>
              <span className={`text-base font-black ${scoreColor(score)}`}>{score}</span>
            </div>
          </div>

          {/* Address */}
          <div className="px-4 py-3">
            <h2 className="text-lg font-bold leading-tight">{current.address}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{current.plz_ort || current.gemeinde || ''}</p>
          </div>

          {/* Key data */}
          <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
            {current.gebaeudeflaeche && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Home className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">HNF</p>
                  <p className="font-semibold text-sm">{Math.round(Number(current.gebaeudeflaeche))} m²</p>
                </div>
              </div>
            )}
            {current.area && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Ruler className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Grundstück</p>
                  <p className="font-semibold text-sm">{Math.round(Number(current.area))} m²</p>
                </div>
              </div>
            )}
            {current.baujahr && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Baujahr</p>
                  <p className="font-semibold text-sm">{current.baujahr}</p>
                </div>
              </div>
            )}
            {current.geschosse && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Geschosse</p>
                  <p className="font-semibold text-sm">{Number(current.geschosse)}</p>
                </div>
              </div>
            )}
            {current.wohnungen && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Wohnungen</p>
                  <p className="font-semibold text-sm">{Number(current.wohnungen)}</p>
                </div>
              </div>
            )}
            {current.kategorie && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Kategorie</p>
                  <p className="font-semibold text-sm truncate">{current.kategorie}</p>
                </div>
              </div>
            )}
          </div>

          {/* AI recommendation */}
          {current.ai_recommendation && (
            <div className="mx-4 mb-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase">KI-Empfehlung</span>
              </div>
              <p className="text-sm font-medium capitalize">{current.ai_recommendation}</p>
              {current.ai_summary && (
                <p className="text-xs text-muted-foreground mt-0.5">{current.ai_summary}</p>
              )}
            </div>
          )}

          {/* Owner hint */}
          {current.owner_name && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">Eigentümer: <span className="text-foreground font-medium">{current.owner_name}</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-6 pt-2 flex gap-4">
        <Button
          variant="destructive"
          size="lg"
          className="flex-1 h-14 text-base rounded-2xl gap-2"
          onClick={() => handleDecision('nicht_interessant')}
          disabled={processing}
        >
          <ThumbsDown className="h-5 w-5" /> Nein
        </Button>
        <Button
          size="lg"
          className="flex-1 h-14 text-base rounded-2xl gap-2 bg-accent hover:bg-accent/90"
          onClick={() => handleDecision('interessant')}
          disabled={processing}
        >
          <ThumbsUp className="h-5 w-5" /> Ja
        </Button>
      </div>

      {/* Swipe hint */}
      <p className="text-center text-[10px] text-muted-foreground pb-3">
        ← Swipe links = Nein · Swipe rechts = Ja →
      </p>
    </div>
  );
}

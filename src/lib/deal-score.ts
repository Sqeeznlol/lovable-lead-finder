import type { Property } from '@/hooks/use-properties';

const ZONE_SCORES: Record<string, number> = {
  W7: 100, W6: 95, W5: 90, W4: 85, W4G: 83,
  W3: 70, W3G: 68, W2: 50, W2G: 48, W: 30,
  WG3: 65, WG2: 45, WG: 35,
};

export function calculateDealScore(p: Property): number {
  let score = 0;

  // Zone score (0-30 pts)
  const zoneScore = ZONE_SCORES[p.zone || ''] ?? 20;
  score += (zoneScore / 100) * 30;

  // Gebäudefläche (0-25 pts) - bigger = better, cap at 1000m²
  const flaeche = Number(p.gebaeudeflaeche) || 0;
  score += Math.min(flaeche / 1000, 1) * 25;

  // Grundstücksfläche (0-20 pts) - bigger = better, cap at 3000m²
  const area = Number(p.area) || 0;
  score += Math.min(area / 3000, 1) * 20;

  // Baujahr (0-15 pts) - older = better, best before 1950
  const baujahr = p.baujahr;
  if (baujahr) {
    if (baujahr <= 1920) score += 15;
    else if (baujahr <= 1950) score += 12;
    else if (baujahr <= 1960) score += 9;
    else if (baujahr <= 1970) score += 6;
    else score += 3;
  }

  // Geschosse bonus (0-10 pts)
  const geschosse = Number(p.geschosse) || 0;
  score += Math.min(geschosse / 5, 1) * 10;

  return Math.round(Math.min(score, 100));
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-accent';
  if (score >= 50) return 'text-primary';
  if (score >= 25) return 'text-warning';
  return 'text-muted-foreground';
}

export function scoreBg(score: number): string {
  if (score >= 75) return 'bg-accent/15 border-accent/30';
  if (score >= 50) return 'bg-primary/15 border-primary/30';
  if (score >= 25) return 'bg-warning/15 border-warning/30';
  return 'bg-muted border-border';
}

/**
 * /api/cron/rescore — rechnet den Deal Score für alle Liegenschaften neu.
 *
 * Läuft auf Vercel Cron (siehe vercel.json). Nutzt den Service-Role-Key,
 * der NUR als Vercel Environment Variable existiert (nie im Client-Bundle).
 *
 * Läuft inkrementell: nur Zeilen mit alter score_version oder verändertem
 * Input-Hash werden neu gerechnet → 184k Zeilen sind in wenigen Minuten durch,
 * danach nur noch Deltas.
 */

import { createClient } from '@supabase/supabase-js';
import { calculateDealScoreV2, SCORE_VERSION, type ScoreInput } from '../../src/lib/deal-score-v2';

export const config = { maxDuration: 300 };

const BATCH = 1000;

const SCORE_FIELDS = [
  'id', 'egrid', 'area', 'gebaeudeflaeche', 'hnf_schaetzung', 'wohnflaeche',
  'nutzflaeche', 'geschosse', 'wohnungen', 'baujahr', 'renovationsjahr',
  'zone', 'gemeinde', 'ausnuetzung', 'denkmalschutz', 'isos', 'geb_status',
  'kategorie', 'gebaeudeart', 'owner_name',
].join(',');

function inputHash(p: ScoreInput): string {
  const s = [
    p.area, p.gebaeudeflaeche, p.hnf_schaetzung, p.wohnflaeche, p.nutzflaeche,
    p.geschosse, p.wohnungen, p.baujahr, p.renovationsjahr, p.zone, p.gemeinde,
    p.ausnuetzung, p.denkmalschutz, p.isos, p.geb_status, p.owner_name,
  ].join('|');
  // FNV-1a, reicht völlig als Änderungserkennung
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export default async function handler(req: Request): Promise<Response> {
  // Vercel Cron schickt diesen Header; zusätzlich CRON_SECRET prüfen.
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const url = new URL(req.url);
  const full = url.searchParams.get('full') === '1';

  let from = 0;
  let scored = 0;
  let skipped = 0;
  const tierCount: Record<string, number> = {};

  for (;;) {
    let q = supabase
      .from('properties')
      .select(`${SCORE_FIELDS},score_version,score_input_hash`)
      .order('id')
      .range(from, from + BATCH - 1);

    if (!full) q = q.or(`score_version.is.null,score_version.neq.${SCORE_VERSION}`);

    const { data, error } = await q;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;

    const updates = [];
    for (const row of data as any[]) {
      const hash = inputHash(row);
      if (!full && row.score_version === SCORE_VERSION && row.score_input_hash === hash) {
        skipped++;
        continue;
      }
      const r = calculateDealScoreV2(row);
      tierCount[r.tier] = (tierCount[r.tier] || 0) + 1;
      updates.push({
        id: row.id,
        deal_score: r.score,
        score_tier: r.tier,
        hnf_neu: r.hnfNeu,
        hnf_bestand: r.hnfBestand,
        hnf_delta: r.hnfDelta,
        hnf_faktor: r.hnfFaktor,
        vollgeschosse: r.vg,
        reserve_gf: r.reserveGF,
        reserve_quote: Number(r.reserveQuote.toFixed(3)),
        score_reasons: r.reasons,
        score_killers: r.killers,
        data_quality: Number(r.dataQuality.toFixed(2)),
        score_version: SCORE_VERSION,
        score_input_hash: hash,
        scored_at: new Date().toISOString(),
      });
    }

    if (updates.length) {
      const { error: upErr } = await supabase
        .from('properties')
        .upsert(updates, { onConflict: 'id' });
      if (upErr) return Response.json({ error: upErr.message, scored }, { status: 500 });
      scored += updates.length;
    }

    if (data.length < BATCH) break;
    from += BATCH;
  }

  return Response.json({ ok: true, scored, skipped, tiers: tierCount, version: SCORE_VERSION });
}

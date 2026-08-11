/**
 * /api/cron/shortlist — baut jeden Morgen die Tagesliste.
 *
 * Das ist der Kern der Automatisierung: du hast pro Nummer 5 Abfragen/Tag.
 * Diese Funktion entscheidet, WELCHE Parzellen diese Slots bekommen.
 *
 * Regeln:
 *   1. Nur Parzellen, die noch NIE abgefragt wurden (parcel_lookups).
 *   2. Sortiert nach deal_score.
 *   3. Dedupliziert nach EGRID (eine Abfrage = eine Parzelle = alle Eigentümer).
 *   4. Diversifizierung: max. 2 Objekte pro Gemeinde pro Tag — sonst arbeitest
 *      du wochenlang eine Gemeinde ab und lernst nichts über den Rest.
 *   5. Mindest-Score-Schwelle: lieber weniger Abfragen als schlechte Abfragen.
 *   6. Slots = Summe der freien Kontingente aller aktiven Nummern.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const MIN_SCORE = Number(process.env.SHORTLIST_MIN_SCORE ?? 45);
const MAX_PRO_GEMEINDE = Number(process.env.SHORTLIST_MAX_PER_GEMEINDE ?? 2);

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const heute = new Date().toISOString().slice(0, 10);

  // ---- 1. Wie viele Slots haben wir heute? ----
  const { data: phones, error: phoneErr } = await supabase
    .from('phone_numbers')
    .select('id,number,label,daily_queries_used,daily_limit,last_query_date,active,cooldown_until')
    .eq('active', true);
  if (phoneErr) return Response.json({ error: phoneErr.message }, { status: 500 });

  const slots: string[] = [];
  for (const p of phones || []) {
    if (p.cooldown_until && p.cooldown_until >= heute) continue;
    const used = p.last_query_date === heute ? (p.daily_queries_used ?? 0) : 0;
    const frei = Math.max(0, (p.daily_limit ?? 5) - used);
    for (let i = 0; i < frei; i++) slots.push(p.number);
  }

  if (slots.length === 0) {
    return Response.json({ ok: true, date: heute, slots: 0, msg: 'Kein Kontingent frei' });
  }

  // ---- 2. Kandidaten holen (View macht Dedup + Ausschluss) ----
  const { data: kandidaten, error: kErr } = await supabase
    .from('v_lookup_candidates')
    .select('*')
    .gte('deal_score', MIN_SCORE)
    .order('deal_score', { ascending: false })
    .limit(slots.length * 30); // Puffer für die Gemeinde-Diversifizierung
  if (kErr) return Response.json({ error: kErr.message }, { status: 500 });

  // ---- 3. Auswahl mit Gemeinde-Quote ----
  const proGemeinde: Record<string, number> = {};
  const gesehen = new Set<string>();
  const auswahl: any[] = [];

  for (const k of kandidaten || []) {
    if (auswahl.length >= slots.length) break;
    if (!k.egrid || gesehen.has(k.egrid)) continue;
    const g = k.gemeinde || 'unbekannt';
    if ((proGemeinde[g] ?? 0) >= MAX_PRO_GEMEINDE) continue;
    gesehen.add(k.egrid);
    proGemeinde[g] = (proGemeinde[g] ?? 0) + 1;
    auswahl.push(k);
  }

  // Falls die Gemeindequote zu streng war und Slots frei bleiben → auffüllen
  if (auswahl.length < slots.length) {
    for (const k of kandidaten || []) {
      if (auswahl.length >= slots.length) break;
      if (!k.egrid || gesehen.has(k.egrid)) continue;
      gesehen.add(k.egrid);
      auswahl.push(k);
    }
  }

  // ---- 4. Schreiben ----
  await supabase.from('daily_shortlist').delete().eq('shortlist_date', heute).eq('status', 'offen');

  const rows = auswahl.map((k, i) => ({
    shortlist_date: heute,
    rank: i + 1,
    property_id: k.id,
    egrid: k.egrid,
    score: k.deal_score,
    score_tier: k.score_tier,
    reserve_gf: k.hnf_delta ?? k.reserve_gf,
    reasons: k.score_reasons,
    assigned_phone: slots[i],
    status: 'offen',
  }));

  if (rows.length) {
    const { error: insErr } = await supabase.from('daily_shortlist').insert(rows);
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    date: heute,
    slots: slots.length,
    ausgewaehlt: rows.length,
    minScore: MIN_SCORE,
    gemeinden: proGemeinde,
    top: rows.slice(0, 5).map((r) => ({ rank: r.rank, score: r.score, egrid: r.egrid })),
  });
}

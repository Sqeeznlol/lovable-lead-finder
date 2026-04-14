import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { property_ids, batch_mode } = await req.json() as {
      property_ids?: string[];
      batch_mode?: boolean;
    };

    // Fetch properties to analyze
    let query = supabase.from('properties').select('*');
    if (property_ids && property_ids.length > 0) {
      query = query.in('id', property_ids);
    } else if (batch_mode) {
      // Analyze un-analyzed properties
      query = query.is('ai_last_analyzed_at', null)
        .eq('geb_status', 'Bestehend')
        .like('zone', 'W%')
        .limit(20);
    } else {
      return new Response(JSON.stringify({ error: 'Provide property_ids or batch_mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: properties, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!properties || properties.length === 0) {
      return new Response(JSON.stringify({ analyzed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent decisions for learning context
    const { data: recentDecisions } = await supabase
      .from('property_decisions')
      .select('ai_recommendation, user_decision, decision_matches_ai')
      .order('created_at', { ascending: false })
      .limit(50);

    const decisionSummary = (recentDecisions || []).reduce((acc, d) => {
      acc.total++;
      if (d.decision_matches_ai) acc.matches++;
      return acc;
    }, { total: 0, matches: 0 });

    const results: { id: string; score: number; recommendation: string; summary: string }[] = [];

    // Process in small batches to avoid rate limits
    for (let i = 0; i < properties.length; i += 5) {
      const batch = properties.slice(i, i + 5);
      
      const prompt = `Du bist ein Immobilien-Akquise-Experte in der Schweiz (Kanton Zürich). Analysiere diese Liegenschaften für Akquise-Potenzial.

Kontext: Wir suchen Liegenschaften in Wohnzonen, ältere Gebäude, möglichst private Eigentümer, gute Lage.
${decisionSummary.total > 0 ? `Bisherige KI-Trefferquote: ${Math.round((decisionSummary.matches / decisionSummary.total) * 100)}% (${decisionSummary.total} Entscheidungen)` : ''}

Für JEDE Liegenschaft liefere:
- score (0-100): Akquise-Attraktivität
- recommendation: "interessant", "prüfen" oder "eher nicht interessant"
- summary: 1-2 Sätze Begründung

Bewertungskriterien:
- Hohe Wohnzone (W5-W7) = besser
- Grosse Gebäudefläche = besser
- Grosses Grundstück = besser  
- Ältere Gebäude (vor 1960) = besser (Sanierungspotenzial)
- Private Eigentümer = besser als institutionelle
- Mehrere Geschosse = besser
- Gute Gemeinde/Lage = Bonus

Liegenschaften:
${batch.map((p, idx) => `
[${idx}] ID: ${p.id}
Adresse: ${p.address}, ${p.plz_ort || p.gemeinde || ''}
Zone: ${p.zone || 'unbekannt'} | Baujahr: ${p.baujahr || 'unbekannt'} | HNF: ${p.gebaeudeflaeche || '?'}m² | Grundstück: ${p.area || '?'}m²
Geschosse: ${p.geschosse || '?'} | Wohnungen: ${p.wohnungen || '?'} | Kategorie: ${p.kategorie || '?'}
Eigentümer: ${p.owner_name || 'unbekannt'} | Status: ${p.geb_status || '?'}
`).join('\n')}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Du bist ein Schweizer Immobilien-Akquise-Analyst. Antworte ausschliesslich im geforderten JSON-Format.' },
            { role: 'user', content: prompt },
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'analyze_properties',
              description: 'Liefere Analyse-Ergebnisse für Liegenschaften',
              parameters: {
                type: 'object',
                properties: {
                  analyses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        score: { type: 'number' },
                        recommendation: { type: 'string', enum: ['interessant', 'prüfen', 'eher nicht interessant'] },
                        summary: { type: 'string' },
                      },
                      required: ['id', 'score', 'recommendation', 'summary'],
                    },
                  },
                },
                required: ['analyses'],
              },
            },
          }],
          tool_choice: { type: 'function', function: { name: 'analyze_properties' } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('Rate limited, waiting...');
          await new Promise(r => setTimeout(r, 5000));
          i -= 5; // retry this batch
          continue;
        }
        console.error('AI error:', response.status, await response.text());
        continue;
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) continue;

      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        const analyses = parsed.analyses || [];

        for (const analysis of analyses) {
          const prop = batch.find(p => p.id === analysis.id);
          if (!prop) continue;

          await supabase.from('properties').update({
            ai_score: analysis.score,
            ai_recommendation: analysis.recommendation,
            ai_summary: analysis.summary,
            ai_priority: analysis.score >= 70 ? 1 : analysis.score >= 40 ? 2 : 3,
            ai_last_analyzed_at: new Date().toISOString(),
          }).eq('id', analysis.id);

          results.push(analysis);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }

      // Rate limit safety
      if (i + 5 < properties.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return new Response(JSON.stringify({ analyzed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-analyze error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

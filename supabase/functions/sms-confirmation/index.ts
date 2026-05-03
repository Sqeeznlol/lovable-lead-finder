import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({
  to: z.string().min(5),
  address: z.string().min(1),
  ownerName: z.string().min(1),
  pipedriveDealUrl: z.string().url().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!TWILIO_API_KEY || !LOVABLE_API_KEY || !TWILIO_FROM) {
      // Feature flag: not configured → return a graceful no-op so caller doesn't fail.
      return new Response(JSON.stringify({
        skipped: true,
        reason: 'sms_not_configured',
        message: 'Twilio not connected. Connect Twilio and set TWILIO_FROM_NUMBER to enable SMS auto-confirmation.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const { to, address, ownerName, pipedriveDealUrl } = parsed.data;
    const text = `✅ Lead exportiert\n${ownerName}\n${address}${pipedriveDealUrl ? `\n${pipedriveDealUrl}` : ''}`;

    const res = await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: text }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'twilio_error', detail: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, sid: data?.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
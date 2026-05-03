import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Feature flag check
  const { data: settingRow } = await sb.from('app_settings').select('value').eq('key', 'automation').maybeSingle();
  const enabled = (settingRow?.value as { daily_digest?: boolean })?.daily_digest === true;

  const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0,0,0,0);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const [{ count: decisions }, { count: exports }, { count: dueToday }] = await Promise.all([
    sb.from('property_decisions').select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
    sb.from('export_logs').select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
    sb.from('properties').select('*', { count: 'exact', head: true })
      .not('follow_up_at', 'is', null).lte('follow_up_at', todayEnd.toISOString()),
  ]);

  const summary = {
    decisions_yesterday: decisions || 0,
    exports_yesterday: exports || 0,
    follow_ups_due_today: dueToday || 0,
    generated_at: new Date().toISOString(),
    delivered: false,
  };

  await sb.from('audit_logs').insert({
    action: 'daily_digest',
    target_table: 'properties',
    details: { ...summary, sent: enabled },
  });

  // SMS/email delivery is gated by the feature flag and requires Twilio config.
  // When enabled and configured, the existing sms-confirmation function can be invoked here.

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
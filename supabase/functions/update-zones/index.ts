import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { updates } = await req.json() as { updates: { egrid: string; zone: string }[] };

  let updated = 0;
  for (let i = 0; i < updates.length; i += 500) {
    const batch = updates.slice(i, i + 500);
    const zoneGroups: Record<string, string[]> = {};
    for (const u of batch) {
      if (!zoneGroups[u.zone]) zoneGroups[u.zone] = [];
      zoneGroups[u.zone].push(u.egrid);
    }
    for (const [zone, egrids] of Object.entries(zoneGroups)) {
      const { error, count } = await supabase
        .from("properties")
        .update({ zone })
        .in("egrid", egrids);
      if (error) console.error(error);
      updated += count || 0;
    }
  }

  return new Response(JSON.stringify({ updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

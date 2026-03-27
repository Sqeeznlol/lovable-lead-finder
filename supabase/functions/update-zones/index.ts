import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { updates, field } = await req.json() as { 
    updates: { egrid: string; value: string }[];
    field: string;
  };

  if (!["zone", "bfs_nr"].includes(field)) {
    return new Response(JSON.stringify({ error: "invalid field" }), { status: 400, headers: corsHeaders });
  }

  let totalUpdated = 0;
  
  // Group by value for efficient batch updates
  const groups: Record<string, string[]> = {};
  for (const u of updates) {
    if (!groups[u.value]) groups[u.value] = [];
    groups[u.value].push(u.egrid);
  }

  for (const [value, egrids] of Object.entries(groups)) {
    // Process in chunks of 500
    for (let i = 0; i < egrids.length; i += 500) {
      const batch = egrids.slice(i, i + 500);
      const updateObj: Record<string, string> = {};
      updateObj[field] = value;
      
      const { data, error } = await supabase
        .from("properties")
        .update(updateObj)
        .in("egrid", batch)
        .select("id");
      
      if (error) {
        console.error(`Error updating ${field}=${value}:`, error);
      } else {
        totalUpdated += (data?.length || 0);
      }
    }
  }

  return new Response(
    JSON.stringify({ updated: totalUpdated, field }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

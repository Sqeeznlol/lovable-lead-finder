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

  const users = [
    { email: "karin@sqeezn.local", password: "ImmoB1", name: "Karin", role: "mobile_swipe" },
    { email: "leander@sqeezn.local", password: "ImmoB1", name: "Leander", role: "mobile_swipe" },
    { email: "ricardo@sqeezn.local", password: "ImmoB1", name: "Ricardo", role: "mobile_swipe" },
    { email: "admin@sqeezn.local", password: "Equaz_12", name: "Sqeezn", role: "admin" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((x: any) => x.email === u.email);
    
    let userId: string;
    if (found) {
      userId = found.id;
      results.push({ email: u.email, status: "already_exists", userId });
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { display_name: u.name },
      });
      if (error) {
        results.push({ email: u.email, status: "error", error: error.message });
        continue;
      }
      userId = data.user.id;
      results.push({ email: u.email, status: "created", userId });
    }

    // Assign role
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });
    
    if (roleErr) {
      results.push({ email: u.email, roleError: roleErr.message });
    }

    // Also give office role to admin
    if (u.role === "admin") {
      await supabase.from("user_roles").upsert({ user_id: userId, role: "office" }, { onConflict: "user_id,role" });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

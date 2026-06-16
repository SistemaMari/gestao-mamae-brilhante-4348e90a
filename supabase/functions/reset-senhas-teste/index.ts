import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// One-shot helper to reset passwords for two specific test accounts.
// Hardcoded allow-list so this endpoint cannot be used to change any other user's password.
// Delete this function after use.
const ITEMS: Array<{ email: string; password: string }> = [
  { email: "roberto.costa@unesp.br", password: "bwX@FJP&4u8f$NCZ" },
  { email: "suportemari@novodmg.com.br", password: "nwm*UXihErP37N4f" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Array<Record<string, unknown>> = [];

  for (const { email, password } of ITEMS) {
    try {
      // Find user by email by paginating listUsers
      let userId: string | null = null;
      let page = 1;
      while (!userId) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
        if (found) userId = found.id;
        if (data.users.length < 200) break;
        page++;
      }

      if (!userId) {
        results.push({ email, status: "not_found" });
        continue;
      }

      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updErr) {
        results.push({ email, status: "error", message: updErr.message });
        continue;
      }
      results.push({ email, status: "ok", user_id: userId });
    } catch (e) {
      results.push({ email, status: "error", message: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

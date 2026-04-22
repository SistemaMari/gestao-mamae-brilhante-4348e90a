import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Public endpoint: validates an invite token and returns ONLY non-sensitive
 * information needed by the registration page (email + unidade name + status).
 * Replaces direct anon SELECT on the convites table.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";

    if (!token || token.length < 8 || token.length > 200) {
      return new Response(JSON.stringify({ status: "invalido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: convite } = await supabaseAdmin
      .from("convites")
      .select("id, email_convidado, unidade_id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!convite) {
      return new Response(JSON.stringify({ status: "invalido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (convite.status === "aceito") {
      return new Response(JSON.stringify({ status: "usado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(convite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ status: "expirado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: unidade } = await supabaseAdmin
      .from("unidades")
      .select("nome")
      .eq("id", convite.unidade_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        status: "valido",
        email_convidado: convite.email_convidado,
        unidade_nome: unidade?.nome ?? "Unidade",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[validar-convite] erro:", err);
    return new Response(JSON.stringify({ status: "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

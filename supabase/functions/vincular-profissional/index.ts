import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, profissional_id } = await req.json();

    if (!token || !profissional_id) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Campos obrigatórios faltando." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate token
    const { data: convite } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", token)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!convite) {
      return new Response(JSON.stringify({ status: "token_invalido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update profissional
    const { error: updateError } = await supabaseAdmin
      .from("profissionais")
      .update({
        unidade_id: convite.unidade_id,
        perfil_institucional: "profissional",
      })
      .eq("id", profissional_id);

    if (updateError) {
      return new Response(JSON.stringify({ status: "erro", mensagem: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Update invite
    await supabaseAdmin.from("convites").update({ status: "aceito" }).eq("id", convite.id);

    return new Response(JSON.stringify({ status: "sucesso" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "erro", mensagem: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

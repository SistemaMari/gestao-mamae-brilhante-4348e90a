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

    const { profissional_id, unidade_id, gestor_id } = await req.json();

    if (!profissional_id || !unidade_id || !gestor_id) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Campos obrigatórios faltando." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verify gestor
    const { data: gestor } = await supabaseAdmin
      .from("profissionais")
      .select("id")
      .eq("user_id", gestor_id)
      .eq("unidade_id", unidade_id)
      .eq("perfil_institucional", "gestor")
      .maybeSingle();

    if (!gestor) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Sem permissão." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify profissional belongs to unit
    const { data: prof } = await supabaseAdmin
      .from("profissionais")
      .select("id, nome")
      .eq("id", profissional_id)
      .eq("unidade_id", unidade_id)
      .maybeSingle();

    if (!prof) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Profissional não encontrado nesta unidade." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Remove from unit (set unidade_id and perfil_institucional to null)
    const { error: updateError } = await supabaseAdmin
      .from("profissionais")
      .update({ unidade_id: null, perfil_institucional: null })
      .eq("id", profissional_id);

    if (updateError) {
      return new Response(JSON.stringify({ status: "erro", mensagem: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log removal
    console.log(`[REMOVER] Profissional ${profissional_id} removido da unidade ${unidade_id} por gestor ${gestor_id}`);

    return new Response(JSON.stringify({
      status: "removido",
      mensagem: "Profissional removido da unidade. As fichas criadas por ele permanecem acessíveis.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "erro", mensagem: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

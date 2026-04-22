import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const callerUserId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const profissional_id = typeof body?.profissional_id === "string" ? body.profissional_id : "";
    const unidade_id = typeof body?.unidade_id === "string" ? body.unidade_id : "";

    if (!profissional_id || !unidade_id) {
      return json({ status: "erro", mensagem: "Campos obrigatórios faltando." }, 400);
    }

    // 2. Verify CALLER is gestor of this unit (identity from JWT)
    const { data: gestor } = await supabaseAdmin
      .from("profissionais")
      .select("id, unidade_id, perfil_institucional")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (!gestor || gestor.unidade_id !== unidade_id || gestor.perfil_institucional !== "gestor") {
      return json({ status: "erro", mensagem: "Sem permissão." }, 403);
    }

    // Prevent self-removal
    if (gestor.id === profissional_id) {
      return json({ status: "erro", mensagem: "Você não pode remover a si mesmo." }, 400);
    }

    // 3. Verify target profissional belongs to the unit
    const { data: prof } = await supabaseAdmin
      .from("profissionais")
      .select("id")
      .eq("id", profissional_id)
      .eq("unidade_id", unidade_id)
      .maybeSingle();

    if (!prof) {
      return json({ status: "erro", mensagem: "Profissional não encontrado nesta unidade." }, 404);
    }

    // 4. Remove from unit
    const { error: updateError } = await supabaseAdmin
      .from("profissionais")
      .update({ unidade_id: null, perfil_institucional: null })
      .eq("id", profissional_id);

    if (updateError) {
      console.error("[remover-profissional] update error:", updateError);
      return json({ status: "erro", mensagem: "Erro ao remover profissional." }, 500);
    }

    console.log(`[REMOVER] Profissional ${profissional_id} removido da unidade ${unidade_id} por user ${callerUserId}`);

    return json({
      status: "removido",
      mensagem: "Profissional removido da unidade. As fichas criadas por ele permanecem acessíveis.",
    });
  } catch (err) {
    console.error("[remover-profissional] unexpected error:", err);
    return json({ status: "erro", mensagem: "Erro interno. Tente novamente." }, 500);
  }
});

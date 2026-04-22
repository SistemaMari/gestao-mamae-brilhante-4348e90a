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

/**
 * Links the CURRENTLY AUTHENTICATED professional to the unit referenced by
 * an invite token. The professional id is derived from the JWT — never from
 * the request body — preventing identity spoofing.
 */
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
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(jwt);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const callerUserId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";

    if (!token) {
      return json({ status: "erro", mensagem: "Token obrigatório." }, 400);
    }

    // 2. Validate token
    const { data: convite } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", token)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!convite) {
      return json({ status: "token_invalido" });
    }

    // 3. Ensure the invite was sent to THIS user's email
    if (callerEmail && convite.email_convidado.toLowerCase() !== callerEmail) {
      return json({ status: "erro", mensagem: "Este convite não corresponde ao seu e-mail." }, 403);
    }

    // 4. Find the caller's professional record (derived from JWT)
    const { data: prof } = await supabaseAdmin
      .from("profissionais")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (!prof) {
      return json({ status: "erro", mensagem: "Perfil profissional não encontrado." }, 404);
    }

    // 5. Update profissional
    const { error: updateError } = await supabaseAdmin
      .from("profissionais")
      .update({
        unidade_id: convite.unidade_id,
        perfil_institucional: "profissional",
      })
      .eq("id", prof.id);

    if (updateError) {
      console.error("[vincular-profissional] update error:", updateError);
      return json({ status: "erro", mensagem: "Erro ao vincular profissional." }, 500);
    }

    // 6. Update invite
    await supabaseAdmin.from("convites").update({ status: "aceito" }).eq("id", convite.id);

    return json({ status: "sucesso" });
  } catch (err) {
    console.error("[vincular-profissional] unexpected error:", err);
    return json({ status: "erro", mensagem: "Erro interno. Tente novamente." }, 500);
  }
});

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
    // 1. Auth check — derive caller identity from JWT, never trust the body
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
    const unidade_id = typeof body?.unidade_id === "string" ? body.unidade_id : "";
    const email_raw = typeof body?.email_convidado === "string" ? body.email_convidado.trim() : "";

    if (!unidade_id || !email_raw) {
      return json({ status: "erro", mensagem: "Campos obrigatórios faltando." }, 400);
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_raw) || email_raw.length > 254) {
      return json({ status: "erro", mensagem: "E-mail inválido." }, 400);
    }
    const email_convidado = email_raw.toLowerCase();

    // 2. Verify caller is a gestor of THIS unit
    const { data: gestor } = await supabaseAdmin
      .from("profissionais")
      .select("id, unidade_id, perfil_institucional")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (!gestor || gestor.unidade_id !== unidade_id || gestor.perfil_institucional !== "gestor") {
      return json({ status: "erro", mensagem: "Sem permissão." }, 403);
    }

    // 3. Check if email is already linked to this unit
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email_convidado);

    if (authUser) {
      const { data: prof } = await supabaseAdmin
        .from("profissionais")
        .select("id, unidade_id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (prof && prof.unidade_id === unidade_id) {
        return json({ status: "ja_vinculado" });
      }
    }

    // 4. Check pending invite
    const { data: pendingInvite } = await supabaseAdmin
      .from("convites")
      .select("id")
      .eq("unidade_id", unidade_id)
      .eq("email_convidado", email_convidado)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      return json({ status: "convite_pendente" });
    }

    // 5. Generate token + insert
    const token_invite = crypto.randomUUID() + "-" + crypto.randomUUID();

    const { error: insertError } = await supabaseAdmin.from("convites").insert({
      unidade_id,
      email_convidado,
      token: token_invite,
      status: "pendente",
      convidado_por: callerUserId, // derived from JWT, NOT from body
    });

    if (insertError) {
      console.error("[enviar-convite] insert error:", insertError);
      return json({ status: "erro", mensagem: "Erro ao criar convite." }, 500);
    }

    const { data: unidade } = await supabaseAdmin
      .from("unidades")
      .select("nome")
      .eq("id", unidade_id)
      .single();

    console.log(`[CONVITE] Email would be sent to ${email_convidado} for unit ${unidade?.nome}`);

    return json({ status: "enviado" });
  } catch (err) {
    console.error("[enviar-convite] unexpected error:", err);
    return json({ status: "erro", mensagem: "Erro interno. Tente novamente." }, 500);
  }
});

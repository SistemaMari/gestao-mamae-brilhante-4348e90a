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
 * Public endpoint (no JWT required — invitee has no account yet).
 * Validates the invite token, creates the auth user and the profissional row.
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
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";
    const crm_coren = typeof body?.crm_coren === "string" ? body.crm_coren.trim() : "";
    const especialidade = typeof body?.especialidade === "string" ? body.especialidade.trim() : "";
    const idioma_preferido =
      typeof body?.idioma_preferido === "string" ? body.idioma_preferido : "pt-BR";

    if (!token || !nome || !senha || !crm_coren || !especialidade) {
      return json({ status: "erro", mensagem: "Campos obrigatórios faltando." }, 400);
    }
    if (senha.length < 6 || senha.length > 200) {
      return json({ status: "erro", mensagem: "Senha inválida." }, 400);
    }
    if (nome.length > 200 || crm_coren.length > 50 || especialidade.length > 100) {
      return json({ status: "erro", mensagem: "Campos excedem o tamanho máximo." }, 400);
    }

    // 1. Validate token
    const { data: convite } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!convite) {
      return json({ status: "token_invalido" });
    }
    if (convite.status !== "pendente") {
      return json({ status: "token_usado" });
    }
    if (new Date(convite.expires_at) < new Date()) {
      return json({ status: "token_expirado" });
    }

    // 2. Check if email already exists in Auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = authUsers?.users?.find(
      u => u.email?.toLowerCase() === convite.email_convidado.toLowerCase()
    );

    if (existingUser) {
      return json({ status: "email_existente" });
    }

    // 3. Create user in Auth
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: convite.email_convidado,
      password: senha,
      email_confirm: true,
    });

    if (authError || !newUser.user) {
      console.error("[aceitar-convite] auth create error:", authError);
      return json({ status: "erro", mensagem: "Erro ao criar conta." }, 500);
    }

    // 4. Insert into profissionais
    const { error: profError } = await supabaseAdmin.from("profissionais").insert({
      user_id: newUser.user.id,
      nome,
      crm: crm_coren,
      especialidade,
      idioma: idioma_preferido,
      unidade_id: convite.unidade_id,
      perfil_institucional: "profissional",
      plano: "institucional",
      plano_status: "ativo",
    });

    if (profError) {
      console.error("[aceitar-convite] profissional insert error:", profError);
      return json({ status: "erro", mensagem: "Erro ao criar perfil profissional." }, 500);
    }

    // 5. Update invite status
    await supabaseAdmin.from("convites").update({ status: "aceito" }).eq("id", convite.id);

    return json({ status: "sucesso" });
  } catch (err) {
    console.error("[aceitar-convite] unexpected error:", err);
    return json({ status: "erro", mensagem: "Erro interno. Tente novamente." }, 500);
  }
});

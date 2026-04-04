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

    const { token, nome, senha, crm_coren, especialidade, idioma_preferido } = await req.json();

    if (!token || !nome || !senha || !crm_coren || !especialidade) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Campos obrigatórios faltando." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate token
    const { data: convite, error: conviteError } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!convite || conviteError) {
      return new Response(JSON.stringify({ status: "token_invalido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (convite.status !== "pendente") {
      return new Response(JSON.stringify({ status: "token_usado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(convite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ status: "token_expirado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if email already exists in Auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = authUsers?.users?.find(
      u => u.email?.toLowerCase() === convite.email_convidado.toLowerCase()
    );

    if (existingUser) {
      return new Response(JSON.stringify({ status: "email_existente", user_id: existingUser.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Create user in Auth
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: convite.email_convidado,
      password: senha,
      email_confirm: true,
    });

    if (authError || !newUser.user) {
      return new Response(JSON.stringify({ status: "erro", mensagem: authError?.message || "Erro ao criar conta." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Insert into profissionais
    const { error: profError } = await supabaseAdmin.from("profissionais").insert({
      user_id: newUser.user.id,
      nome,
      crm: crm_coren,
      especialidade,
      idioma: idioma_preferido || "pt-BR",
      unidade_id: convite.unidade_id,
      perfil_institucional: "profissional",
      plano: "institucional",
      plano_status: "ativo",
    });

    if (profError) {
      return new Response(JSON.stringify({ status: "erro", mensagem: profError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update invite status
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

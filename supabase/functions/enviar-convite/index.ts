// enviar-convite v3 — auto-limpeza de auth users órfãos
// Status retornados:
//   - enviado            (com fluxo: 'criacao' | 'vinculacao')
//   - ja_vinculado
//   - convite_pendente
//   - email_em_uso_admin
//   - email_em_uso_gestor_unidade
//   - email_em_uso_gestor_geral
//   - email_em_uso_outra_unidade
//   - email_em_uso_consultorio
//   - erro

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

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const callerUserId = userData.user.id;

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_raw) || email_raw.length > 254) {
      return json({ status: "erro", mensagem: "E-mail inválido." }, 400);
    }
    const email_convidado = email_raw.toLowerCase();

    // 2. Verify caller is gestor of THIS unit
    const { data: gestor } = await supabaseAdmin
      .from("profissionais")
      .select("id, unidade_id, perfil_institucional")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (!gestor || gestor.unidade_id !== unidade_id || gestor.perfil_institucional !== "gestor") {
      return json({ status: "erro", mensagem: "Sem permissão." }, 403);
    }

    // 3. Locate auth user by email (if any)
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email_convidado
    );

    

    if (authUser) {
      // 3a. Already an admin?
      const { data: adminRow } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (adminRow) return json({ status: "email_em_uso_admin" });

      // 3b. Already a gestor geral?
      const { data: ggRow } = await supabaseAdmin
        .from("gestores_gerais")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (ggRow) return json({ status: "email_em_uso_gestor_geral" });

      // 3c. Already a profissional? Check unidade + perfil
      const { data: prof } = await supabaseAdmin
        .from("profissionais")
        .select("id, unidade_id, perfil_institucional")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (prof) {
        if (prof.unidade_id === unidade_id) {
          return json({ status: "ja_vinculado" });
        }
        // Different unit
        if (prof.unidade_id) {
          if (prof.perfil_institucional === "gestor") {
            return json({ status: "email_em_uso_gestor_unidade" });
          }
          return json({ status: "email_em_uso_outra_unidade" });
        }
        // Has account but no unidade => conta consultório.
        // Regra atual: 1 e-mail = 1 modelo (consultório OU institucional).
        // Vinculação cruzada está descontinuada.
        return json({ status: "email_em_uso_consultorio" });
      } else {
        // Auth user exists but has no role (no profissional, admin, or gestor_geral).
        // This is an orphaned auth account (e.g. created directly via dashboard).
        // Safe to delete so the invite can proceed.
        const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        if (deleteErr) {
          console.error("[enviar-convite] failed to delete orphaned auth user:", deleteErr);
          return json({ status: "erro", mensagem: "Não foi possível limpar o usuário órfão. Contate o suporte." }, 500);
        }
        console.log(`[enviar-convite] deleted orphaned auth user ${authUser.id} (${email_convidado})`);
        // Fall through to create the invite normally.
      }
    }

    // 4. Pending invite (same unit)
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
      convidado_por: callerUserId,
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

    const conviteUrl = `https://maridmg.com.br/cadastro-convite/${token_invite}`;
    const nomeUnidade = unidade?.nome ?? "sua unidade";

    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background:#fff; color:#1e293b; padding:32px;">
  <h2 style="color:#9b87f5;">MARI | Inteligência Clínica</h2>
  <h3>Você foi convidado(a) para ${nomeUnidade}</h3>
  <p>Clique no botão abaixo para aceitar o convite e criar sua conta de acesso.</p>
  <a href="${conviteUrl}"
     style="display:inline-block;background:#9b87f5;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">
    Aceitar convite
  </a>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
    Se você não estava esperando este convite, pode ignorar este e-mail.
    O link expira em 7 dias.
  </p>
</body>
</html>`;

    const textBody = `Você foi convidado(a) para ${nomeUnidade} no MARI | Inteligência Clínica.\n\nAcesse o link abaixo para criar sua conta:\n${conviteUrl}\n\nO link expira em 7 dias.`;

    const messageId = crypto.randomUUID();

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "convite_unidade",
      recipient_email: email_convidado,
      status: "pending",
    });

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "auth_emails",
      payload: {
        message_id: messageId,
        to: email_convidado,
        from: `Mari's Health Companion <noreply@maridmg.com.br>`,
        sender_domain: "maridmg.com.br",
        subject: `Convite para ${nomeUnidade} — MARI`,
        html: htmlBody,
        text: textBody,
        purpose: "transactional",
        label: "convite_unidade",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("[enviar-convite] falha ao enfileirar email:", enqueueError);
      // Convite foi criado — retorna sucesso parcial; o email pode ser reenviado.
    } else {
      console.log(`[enviar-convite] email enfileirado para ${email_convidado}`);
    }

    return json({ status: "enviado" });
  } catch (err) {
    console.error("[enviar-convite] unexpected error:", err);
    return json({ status: "erro", mensagem: "Erro interno. Tente novamente." }, 500);
  }
});

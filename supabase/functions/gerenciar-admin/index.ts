// Edge Function: gerenciar-admin
// Ações: criar | listar | remover
// - Verifica se quem chama é admin (via tabela `admins`)
// - criar: checa unicidade de e-mail em todos os perfis, cria no Auth,
//   insere em `admins`, gera magic link e envia e-mail (invite),
//   grava em `admin_audit_log`
// - listar: retorna admins com e-mail (vindo de auth.users)
// - remover: bloqueia auto-remoção e remoção do último admin,
//   apaga de `admins`, desativa no Auth (ban_duration), grava auditoria

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function senhaTemporaria(): string {
  // 32 chars alfanumérica + símbolos
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const arr = new Uint32Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

interface BodyCriar {
  acao: "criar";
  nome: string;
  email: string;
}
interface BodyListar {
  acao: "listar";
}
interface BodyRemover {
  acao: "remover";
  admin_id: string;
}
type Body = BodyCriar | BodyListar | BodyRemover;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    // Identifica usuário chamador
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }
    const callerUserId = userData.user.id;
    const callerEmail = userData.user.email ?? "";

    // Service role para queries privilegiadas e mutações
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Confere se é admin
    const { data: callerAdminRow } = await admin
      .from("admins")
      .select("id, user_id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!callerAdminRow) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    // Body
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const acao = (body as any)?.acao;
    if (!["criar", "listar", "remover"].includes(acao)) {
      return jsonResponse(
        { error: "Ação deve ser: criar, listar ou remover." },
        400,
      );
    }

    // ------------- LISTAR -------------
    if (acao === "listar") {
      const { data: rows, error: errList } = await admin
        .from("admins")
        .select("id, user_id, nome, created_at")
        .order("created_at", { ascending: false });
      if (errList) {
        return jsonResponse({ error: "Erro ao listar admins." }, 500);
      }

      // Pega e-mails do Auth para cada user_id
      const ids = (rows ?? []).map((r) => r.user_id).filter(Boolean);
      const emailMap = new Map<string, string | null>();
      if (ids.length > 0) {
        // Lista usuários do Auth e cruza por id
        const { data: usersData } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        for (const u of usersData?.users ?? []) {
          emailMap.set(u.id, u.email ?? null);
        }
      }

      const out = (rows ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        nome: r.nome,
        email: emailMap.get(r.user_id) ?? null,
        created_at: r.created_at,
      }));
      return jsonResponse({ status: "ok", admins: out });
    }

    // ------------- CRIAR -------------
    if (acao === "criar") {
      const nome = ((body as BodyCriar).nome ?? "").trim();
      const email = ((body as BodyCriar).email ?? "").trim().toLowerCase();
      if (!nome || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return jsonResponse(
          { error: "Nome e e-mail válidos são obrigatórios." },
          400,
        );
      }

      // Localiza usuário no Auth pelo e-mail (se já existir)
      const { data: existingByEmail } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        // listUsers ainda não filtra por email diretamente; usamos workaround
      } as any);
      // Busca explícita varrendo páginas (e-mails únicos no Auth)
      let existingUserId: string | null = null;
      {
        const all = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of all.data?.users ?? []) {
          if ((u.email ?? "").toLowerCase() === email) {
            existingUserId = u.id;
            break;
          }
        }
      }

      // Conflito: já é admin?
      if (existingUserId) {
        const { data: jaAdmin } = await admin
          .from("admins")
          .select("id")
          .eq("user_id", existingUserId)
          .maybeSingle();
        if (jaAdmin) {
          return jsonResponse(
            {
              codigo: "email_existente",
              mensagem: "Este e-mail já é administrador.",
            },
            400,
          );
        }

        // Conflito: profissional (consultório/institucional/gestor unidade)
        const { data: prof } = await admin
          .from("profissionais")
          .select("id, perfil_institucional, unidade_id")
          .eq("user_id", existingUserId)
          .maybeSingle();
        if (prof) {
          if (prof.perfil_institucional === "gestor" && prof.unidade_id) {
            return jsonResponse(
              {
                codigo: "email_em_uso_gestor_unidade",
                mensagem:
                  "Este e-mail já está cadastrado como gestor de unidade. Cada e-mail só pode ter um perfil.",
              },
              400,
            );
          }
          return jsonResponse(
            {
              codigo: "email_em_uso_profissional",
              mensagem:
                "Este e-mail já está cadastrado no sistema como profissional. Cada e-mail só pode ter um perfil.",
            },
            400,
          );
        }

        // Conflito: gestor geral
        const { data: gg } = await admin
          .from("gestores_gerais")
          .select("id")
          .eq("user_id", existingUserId)
          .maybeSingle();
        if (gg) {
          return jsonResponse(
            {
              codigo: "email_em_uso_gestor_geral",
              mensagem:
                "Este e-mail já está cadastrado como gestor geral. Cada e-mail só pode ter um perfil.",
            },
            400,
          );
        }

        // E-mail no Auth, mas sem perfil correspondente
        return jsonResponse(
          {
            codigo: "email_em_uso_outro",
            mensagem:
              "Este e-mail já está em uso no sistema. Use outro e-mail.",
          },
          400,
        );
      }

      // Cria no Auth + envia magic link via inviteUserByEmail
      // (envia e-mail oficial do Supabase com o template "Invite user")
      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { nome, perfil: "admin" },
        });
      if (invErr || !invited?.user) {
        // fallback: createUser com senha temporária + generateLink
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password: senhaTemporaria(),
            email_confirm: false,
            user_metadata: { nome, perfil: "admin" },
          });
        if (createErr || !created?.user) {
          console.error("Erro criar usuário Auth:", createErr ?? invErr);
          return jsonResponse({ error: "Erro ao criar usuário." }, 500);
        }
        // tenta gerar magic link de recovery (não falha o fluxo se der ruim)
        await admin.auth.admin.generateLink({ type: "invite", email });
        invited.user = created.user;
      }

      const newUserId = invited.user.id;

      // Insere em admins
      const { data: adminRow, error: insErr } = await admin
        .from("admins")
        .insert({ user_id: newUserId, nome })
        .select("id")
        .single();
      if (insErr) {
        // rollback do Auth para manter consistência
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        console.error("Erro insert admins:", insErr);
        return jsonResponse({ error: "Erro ao criar usuário." }, 500);
      }

      // Auditoria
      await admin.from("admin_audit_log").insert({
        acao: "criar_admin",
        executado_por: callerUserId,
        executado_por_email: callerEmail,
        alvo_admin_id: adminRow.id,
        alvo_email: email,
        alvo_nome: nome,
        metadata: {
          ip: req.headers.get("x-forwarded-for") ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
        },
      });

      return jsonResponse({
        status: "criado",
        admin_id: adminRow.id,
        email,
      });
    }

    // ------------- REMOVER -------------
    if (acao === "remover") {
      const alvoAdminId = (body as BodyRemover).admin_id;
      if (!alvoAdminId) {
        return jsonResponse({ error: "admin_id é obrigatório." }, 400);
      }

      const { data: alvo } = await admin
        .from("admins")
        .select("id, user_id, nome")
        .eq("id", alvoAdminId)
        .maybeSingle();
      if (!alvo) {
        return jsonResponse({ error: "Administrador não encontrado." }, 404);
      }

      if (alvo.user_id === callerUserId) {
        return jsonResponse(
          { codigo: "auto_remocao", mensagem: "Você não pode remover a si mesmo." },
          400,
        );
      }

      const { count } = await admin
        .from("admins")
        .select("id", { count: "exact", head: true });
      if ((count ?? 0) <= 1) {
        return jsonResponse(
          {
            codigo: "ultimo_admin",
            mensagem: "Não é possível remover o último administrador.",
          },
          400,
        );
      }

      // Snapshot e-mail
      let alvoEmail = "";
      try {
        const { data: u } = await admin.auth.admin.getUserById(alvo.user_id);
        alvoEmail = u?.user?.email ?? "";
      } catch {
        /* ignore */
      }

      // Apaga registro de admin
      const { error: delErr } = await admin
        .from("admins")
        .delete()
        .eq("id", alvoAdminId);
      if (delErr) {
        console.error("Erro delete admins:", delErr);
        return jsonResponse({ error: "Erro ao remover admin." }, 500);
      }

      // Desativa no Auth (ban permanente, sem deletar — preserva histórico)
      try {
        await admin.auth.admin.updateUserById(alvo.user_id, {
          ban_duration: "876000h", // ~100 anos
        } as any);
      } catch (e) {
        console.error("Falha ao desativar usuário Auth:", e);
        // não reverte: registro já foi removido de admins
      }

      // Auditoria
      await admin.from("admin_audit_log").insert({
        acao: "remover_admin",
        executado_por: callerUserId,
        executado_por_email: callerEmail,
        alvo_admin_id: alvoAdminId,
        alvo_email: alvoEmail,
        alvo_nome: alvo.nome ?? null,
        metadata: {
          ip: req.headers.get("x-forwarded-for") ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
        },
      });

      return jsonResponse({ status: "removido", admin_id: alvoAdminId });
    }

    return jsonResponse({ error: "Ação não suportada." }, 400);
  } catch (e) {
    console.error("Falha inesperada:", e);
    return jsonResponse({ error: "Erro inesperado." }, 500);
  }
});

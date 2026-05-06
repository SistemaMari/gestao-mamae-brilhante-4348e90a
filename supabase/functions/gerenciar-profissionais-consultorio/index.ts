// Edge Function: gerenciar-profissionais-consultorio
// Ações admin: listar, cadastrar, editar, mudar_plano, revogar_acesso
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const erro = (codigo: string, mensagem: string, status = 400) =>
  json({ status: "erro", codigo, mensagem }, status);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return erro("nao_autenticado", "Não autenticado.", 401);
    }
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(jwt);
    if (claimsErr || !claimsData?.claims?.sub) {
      return erro("nao_autenticado", "Não autenticado.", 401);
    }
    const callerUserId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Gate is_admin
    const { data: adminRow } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!adminRow) return erro("forbidden", "Apenas administradores.", 403);

    const body = await req.json().catch(() => ({}));
    const acao = body?.acao as string | undefined;
    if (!acao) return erro("acao_invalida", "Ação obrigatória.");

    // Helper: lista todos os auth users (paginado, MVP — débito técnico para 1000+)
    async function listAuthUsers() {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        all.push(...(data?.users ?? []));
        if (!data?.users || data.users.length < 1000) break;
        page++;
        if (page > 10) break; // hard cap
      }
      return all;
    }

    // ============ LISTAR ============
    if (acao === "listar_profissionais_consultorio") {
      const { data: profs, error: profErr } = await supabaseAdmin
        .from("profissionais")
        .select(
          `id, nome, crm, especialidade, telefone, plano_id, plano_status,
           plano_expira_em, laudos_limite, laudos_usados, asaas_subscription_id,
           acesso_revogado, created_at, user_id,
           planos:plano_id ( nome, preco_mensal, laudos_por_mes )`
        )
        .is("unidade_id", null)
        .is("perfil_institucional", null)
        .order("created_at", { ascending: false });
      if (profErr) {
        console.error("[listar] prof err:", profErr);
        return erro("erro_interno", "Erro ao listar profissionais.", 500);
      }

      const userIds = (profs ?? []).map((p: any) => p.user_id).filter(Boolean);
      const authUsers = await listAuthUsers();
      const authMap = new Map(authUsers.map((u: any) => [u.id, u]));

      // Laudos últimos 30d e último laudo
      const profIds = (profs ?? []).map((p: any) => p.id);
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: laudosRecentes } = await supabaseAdmin
        .from("laudos")
        .select("profissional_id, created_at")
        .in("profissional_id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false });

      const laudos30 = new Map<string, number>();
      const ultimoLaudo = new Map<string, string>();
      for (const l of laudosRecentes ?? []) {
        if (!ultimoLaudo.has(l.profissional_id)) {
          ultimoLaudo.set(l.profissional_id, l.created_at);
        }
        if (l.created_at >= since) {
          laudos30.set(l.profissional_id, (laudos30.get(l.profissional_id) ?? 0) + 1);
        }
      }

      const profissionais = (profs ?? []).map((p: any) => {
        const u = authMap.get(p.user_id);
        return {
          id: p.id,
          nome: p.nome,
          email: u?.email ?? null,
          crm: p.crm,
          especialidade: p.especialidade,
          telefone: p.telefone,
          plano_id: p.plano_id,
          plano_nome: p.planos?.nome ?? null,
          plano_preco: p.planos?.preco_mensal ?? null,
          plano_status: p.plano_status,
          plano_expira_em: p.plano_expira_em,
          laudos_limite: p.laudos_limite,
          laudos_usados: p.laudos_usados,
          asaas_subscription_id: p.asaas_subscription_id,
          acesso_revogado: p.acesso_revogado,
          convite_pendente: u ? !u.email_confirmed_at : false,
          ultimo_login: u?.last_sign_in_at ?? null,
          ultimo_laudo: ultimoLaudo.get(p.id) ?? null,
          laudos_ultimos_30d: laudos30.get(p.id) ?? 0,
          created_at: p.created_at,
        };
      });

      return json({ status: "ok", profissionais });
    }

    // ============ CADASTRAR ============
    if (acao === "cadastrar_profissional_consultorio") {
      const Schema = z.object({
        nome: z.string().min(3).max(200),
        email: z.string().email(),
        crm: z.string().optional().nullable(),
        especialidade: z.string().optional().nullable(),
        telefone: z.string().optional().nullable(),
        plano_id: z.string().uuid(),
      });
      const parsed = Schema.safeParse(body);
      if (!parsed.success) {
        return erro("validacao", "Dados inválidos.", 400);
      }
      const input = parsed.data;
      const emailLower = input.email.toLowerCase();

      // Plano existe e ativo
      const { data: plano } = await supabaseAdmin
        .from("planos")
        .select("id, ativo, laudos_por_mes")
        .eq("id", input.plano_id)
        .maybeSingle();
      if (!plano) return erro("plano_inexistente", "Plano não encontrado.");
      if (!plano.ativo) return erro("plano_inativo", "Plano selecionado não está mais ativo.");

      // Email único
      const authUsers = await listAuthUsers();
      const exists = authUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
      if (exists) return erro("email_ja_cadastrado", "Já existe um usuário cadastrado com este e-mail.");

      // Convite
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        input.email,
        { data: { nome: input.nome } }
      );
      if (inviteErr || !invited?.user) {
        console.error("[cadastrar] invite err:", inviteErr);
        return erro("erro_invite", "Erro ao enviar convite.", 500);
      }

      const { data: novo, error: insErr } = await supabaseAdmin
        .from("profissionais")
        .insert({
          user_id: invited.user.id,
          nome: input.nome,
          crm: input.crm ?? null,
          especialidade: input.especialidade ?? null,
          telefone: input.telefone ?? null,
          unidade_id: null,
          perfil_institucional: null,
          plano_id: input.plano_id,
          plano_status: "ativo",
          laudos_limite: plano.laudos_por_mes,
          laudos_usados: 0,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("[cadastrar] insert err:", insErr);
        return erro("erro_interno", "Erro ao cadastrar profissional.", 500);
      }

      return json({ status: "cadastrado", profissional_id: novo.id });
    }

    // ============ EDITAR ============
    if (acao === "editar_profissional_consultorio") {
      const Schema = z.object({
        profissional_id: z.string().uuid(),
        nome: z.string().min(3).max(200).optional(),
        crm: z.string().optional().nullable(),
        especialidade: z.string().optional().nullable(),
        telefone: z.string().optional().nullable(),
      });
      const parsed = Schema.safeParse(body);
      if (!parsed.success) return erro("validacao", "Dados inválidos.");
      const { profissional_id, ...rest } = parsed.data;

      // CRM imutável: se já tiver valor, ignorar tentativa de alterar
      const { data: atual } = await supabaseAdmin
        .from("profissionais")
        .select("crm")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!atual) return erro("profissional_inexistente", "Profissional não encontrado.", 404);

      const update: Record<string, unknown> = {};
      if (rest.nome !== undefined) update.nome = rest.nome;
      if (rest.especialidade !== undefined) update.especialidade = rest.especialidade;
      if (rest.telefone !== undefined) update.telefone = rest.telefone;
      // CRM só pode ser preenchido se ainda for null
      if (rest.crm !== undefined && !atual.crm) update.crm = rest.crm;

      if (Object.keys(update).length === 0) {
        return json({ status: "sem_alteracao" });
      }

      const { error: upErr } = await supabaseAdmin
        .from("profissionais")
        .update(update)
        .eq("id", profissional_id);
      if (upErr) {
        console.error("[editar] err:", upErr);
        return erro("erro_interno", "Erro ao editar.", 500);
      }
      return json({ status: "editado" });
    }

    // ============ MUDAR PLANO ============
    if (acao === "mudar_plano") {
      const Schema = z.object({
        profissional_id: z.string().uuid(),
        plano_id: z.string().uuid(),
        motivo: z.string(),
      });
      const parsed = Schema.safeParse(body);
      if (!parsed.success) return erro("validacao", "Dados inválidos.");
      const { profissional_id, plano_id, motivo } = parsed.data;

      if (motivo.trim().length < 10) {
        return erro("motivo_curto_mudanca", "Motivo da mudança deve ter no mínimo 10 caracteres.");
      }

      const { data: prof } = await supabaseAdmin
        .from("profissionais")
        .select("id, plano_id")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return erro("profissional_inexistente", "Profissional não encontrado.", 404);
      if (prof.plano_id === plano_id) {
        return erro("plano_igual_atual", "O profissional já está neste plano.");
      }

      const { data: plano } = await supabaseAdmin
        .from("planos")
        .select("id, ativo, laudos_por_mes")
        .eq("id", plano_id)
        .maybeSingle();
      if (!plano) return erro("plano_inexistente", "Plano não encontrado.");
      if (!plano.ativo) return erro("plano_inativo", "Plano selecionado não está mais ativo.");

      const { error: upErr } = await supabaseAdmin
        .from("profissionais")
        .update({ plano_id, laudos_limite: plano.laudos_por_mes })
        .eq("id", profissional_id);
      if (upErr) {
        console.error("[mudar_plano] upd err:", upErr);
        return erro("erro_interno", "Erro ao mudar plano.", 500);
      }

      await supabaseAdmin.from("log_mudanca_plano").insert({
        profissional_id,
        plano_anterior_id: prof.plano_id,
        plano_novo_id: plano_id,
        motivo,
        alterado_por: callerUserId,
      });

      return json({ status: "alterado" });
    }

    // ============ REVOGAR ACESSO ============
    if (acao === "revogar_acesso_consultorio") {
      const Schema = z.object({
        profissional_id: z.string().uuid(),
        motivo: z.string(),
      });
      const parsed = Schema.safeParse(body);
      if (!parsed.success) return erro("validacao", "Dados inválidos.");
      const { profissional_id, motivo } = parsed.data;
      if (motivo.trim().length < 20) {
        return erro("motivo_curto_revogacao", "Motivo da revogação deve ter no mínimo 20 caracteres.");
      }

      const { data: prof } = await supabaseAdmin
        .from("profissionais")
        .select("id, user_id, acesso_revogado")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return erro("profissional_inexistente", "Profissional não encontrado.", 404);
      if (prof.acesso_revogado) {
        return erro("ja_revogado", "Este profissional já está com acesso revogado.");
      }

      const { error: upErr } = await supabaseAdmin
        .from("profissionais")
        .update({
          acesso_revogado: true,
          acesso_revogado_em: new Date().toISOString(),
          acesso_revogado_por: null,
          motivo_revogacao: motivo,
        })
        .eq("id", profissional_id);
      if (upErr) {
        console.error("[revogar] err:", upErr);
        return erro("erro_interno", "Erro ao revogar.", 500);
      }

      // Force global signOut
      try {
        if (prof.user_id) {
          await supabaseAdmin.auth.admin.signOut(prof.user_id, "global");
        }
      } catch (e) {
        console.error("[revogar] signOut err:", e);
      }

      return json({
        status: "revogado",
        aviso_asaas:
          "Lembre-se de cancelar a assinatura no painel Asaas se ela existir.",
      });
    }

    return erro("acao_invalida", "Ação desconhecida.");
  } catch (err) {
    console.error("[gerenciar-profissionais-consultorio] erro:", err);
    return erro("erro_interno", "Erro inesperado.", 500);
  }
});

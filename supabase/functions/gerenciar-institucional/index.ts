// Edge Function: gerenciar-institucional (v3)
// 9 ações para gestão de contas institucionais e gestores gerais.
// Toda operação exige admin (auth.uid() em `admins`). Auditoria em `admin_audit_log`.
//
// Notas de schema:
// - Gestor de unidade = profissionais com perfil_institucional='gestor' e unidade_id=X.
//   Identificado por profissionais.user_id (não há coluna gestor_id em unidades).
// - profissionais.plano_id é NOT NULL → usamos plano slug 'inicial' como default
//   (institucional não passa por billing).
// - gestores_gerais não armazena email/cargo/instituicao no schema atual: e-mail
//   vem do auth.users; cargo e instituição ficam no user_metadata.
// - "manter_como_profissional" mapeia para perfil_institucional='institucional'
//   (compatível com trigger sync_profissional_role).

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

// URL de produção / preview onde o usuário define a senha
const APP_URL =
  Deno.env.get("APP_PUBLIC_URL") ?? "https://gestao-mamae-brilhante.lovable.app";

const PLANO_INSTITUCIONAL_SLUG = "inicial"; // default; ajustável

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Admin = ReturnType<typeof createClient>;

// ----------------- Helpers -----------------

async function findAuthUserByEmail(
  admin: Admin,
  email: string,
): Promise<{ id: string; email: string | null; last_sign_in_at: string | null } | null> {
  const lower = email.toLowerCase();
  // Listagem com paginação — Auth.admin.listUsers não filtra por email
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error || !data) return null;
    for (const u of data.users) {
      if ((u.email ?? "").toLowerCase() === lower) {
        return {
          id: u.id,
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      }
    }
    if (data.users.length < 1000) return null;
    page++;
    if (page > 10) return null; // safety
  }
}

async function getEmailMap(
  admin: Admin,
  ids: string[],
): Promise<Map<string, { email: string | null; last_sign_in_at: string | null; user_metadata: any }>> {
  const map = new Map<
    string,
    { email: string | null; last_sign_in_at: string | null; user_metadata: any }
  >();
  if (ids.length === 0) return map;
  // Busca um a um (mais leve que listar tudo)
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user) {
          map.set(id, {
            email: data.user.email ?? null,
            last_sign_in_at: data.user.last_sign_in_at ?? null,
            user_metadata: data.user.user_metadata ?? {},
          });
        }
      } catch {
        /* ignore */
      }
    }),
  );
  return map;
}

interface EmailEmUso {
  em_uso: boolean;
  perfil?: "admin" | "gestor_unidade" | "profissional" | "gestor_geral" | "outro";
  user_id?: string;
}

async function verificarEmailEmUso(
  admin: Admin,
  email: string,
): Promise<EmailEmUso> {
  const authUser = await findAuthUserByEmail(admin, email);
  if (!authUser) return { em_uso: false };
  const userId = authUser.id;

  const { data: adm } = await admin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adm) return { em_uso: true, perfil: "admin", user_id: userId };

  const { data: prof } = await admin
    .from("profissionais")
    .select("id, perfil_institucional")
    .eq("user_id", userId)
    .maybeSingle();
  if (prof) {
    if (prof.perfil_institucional === "gestor") {
      return { em_uso: true, perfil: "gestor_unidade", user_id: userId };
    }
    return { em_uso: true, perfil: "profissional", user_id: userId };
  }

  const { data: gg } = await admin
    .from("gestores_gerais")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (gg) return { em_uso: true, perfil: "gestor_geral", user_id: userId };

  return { em_uso: true, perfil: "outro", user_id: userId };
}

function erroEmailParaResposta(perfil: EmailEmUso["perfil"]) {
  switch (perfil) {
    case "admin":
      return {
        codigo: "email_em_uso_admin",
        mensagem:
          "Este e-mail já está cadastrado como administrador. Cada e-mail só pode ter um perfil.",
      };
    case "gestor_unidade":
      return {
        codigo: "email_em_uso_gestor_unidade",
        mensagem:
          "Este e-mail já está cadastrado como gestor de unidade. Cada e-mail só pode ter um perfil.",
      };
    case "profissional":
      return {
        codigo: "email_em_uso_profissional",
        mensagem:
          "Este e-mail já está cadastrado como profissional. Cada e-mail só pode ter um perfil.",
      };
    case "gestor_geral":
      return {
        codigo: "email_em_uso_gestor_geral",
        mensagem:
          "Este e-mail já está cadastrado como gestor geral. Cada e-mail só pode ter um perfil.",
      };
    default:
      return {
        codigo: "email_em_uso_outro",
        mensagem: "Este e-mail já está em uso no sistema. Use outro e-mail.",
      };
  }
}

async function getPlanoIdInstitucional(admin: Admin): Promise<string | null> {
  const { data } = await admin
    .from("planos")
    .select("id")
    .eq("slug", PLANO_INSTITUCIONAL_SLUG)
    .maybeSingle();
  return data?.id ?? null;
}

async function inserirAuditoria(
  admin: Admin,
  callerUserId: string,
  callerEmail: string,
  acao: string,
  alvoEmail: string,
  alvoNome: string | null,
  alvoAdminId: string | null,
  metadata: Record<string, unknown>,
) {
  await admin.from("admin_audit_log").insert({
    acao,
    executado_por: callerUserId,
    executado_por_email: callerEmail,
    alvo_admin_id: alvoAdminId,
    alvo_email: alvoEmail,
    alvo_nome: alvoNome,
    metadata,
  });
}

// ----------------- Handler -----------------

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
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }
    const callerUserId = userData.user.id;
    const callerEmail = userData.user.email ?? "";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: callerAdmin } = await admin
      .from("admins")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!callerAdmin) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }
    const acao = body?.acao;

    // ============= criar_unidade =============
    if (acao === "criar_unidade") {
      const nome = String(body.nome ?? "").trim();
      const tipo = body.tipo ?? null;
      const cnes = body.cnes ?? null;
      const pais = body.pais ?? "BR";
      const estado = body.estado ?? null;
      const cidade = body.cidade ?? null;
      const planoCategoria = body.plano ?? "clinica"; // só categoria
      const gestorModo = String(body.gestor_modo ?? "novo");

      // [28.3b] contratante_id é obrigatório. Workaround MARI Sandbox removido.
      const contratante_id = String(body.contratante_id ?? "").trim();
      if (!contratante_id) {
        return jsonResponse({ codigo: "contratante_obrigatorio", mensagem: "O contratante é obrigatório para criar uma unidade." }, 400);
      }
      {
        const { data: cont } = await admin
          .from("contratantes")
          .select("id, status")
          .eq("id", contratante_id)
          .maybeSingle();
        if (!cont) {
          return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
        }
        if (cont.status !== "ativo") {
          return jsonResponse({ codigo: "contratante_encerrado", mensagem: "Contratante está encerrado e não pode receber novas unidades." }, 400);
        }
      }

      const planoId = await getPlanoIdInstitucional(admin);
      if (!planoId) {
        return jsonResponse({ error: "Plano padrão não encontrado." }, 500);
      }

      // ----- modo "em_aberto" (sem gestor) -----
      if (gestorModo === "em_aberto") {
        if (!nome) {
          return jsonResponse({ error: "Nome da unidade obrigatório." }, 400);
        }
        const { data: unidade, error: errUni } = await admin
          .from("unidades")
          .insert({ nome, tipo, cnes, pais, estado, cidade, ativa: true, contratante_id })
          .select("id, nome")
          .single();
        if (errUni || !unidade) {
          console.error("Erro criar unidade em aberto:", errUni);
          return jsonResponse({ error: "Erro ao processar operação. Nenhum dado foi alterado." }, 500);
        }
        await inserirAuditoria(
          admin, callerUserId, callerEmail, "criar_unidade",
          "", "", null,
          {
            unidade_id: unidade.id,
            unidade_nome: unidade.nome,
            gestor_modo: "em_aberto",
            plano_categoria: planoCategoria,
          },
        );
        return jsonResponse({
          status: "criada_em_aberto",
          unidade_id: unidade.id,
        });
      }

      if (gestorModo === "existente") {
        const gestorIdSel = String(body.gestor_id ?? "").trim();
        if (!nome || !gestorIdSel) {
          return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
        }
        const { data: profSel } = await admin
          .from("profissionais")
          .select("id, nome, user_id, unidade_id, perfil_institucional, acesso_revogado")
          .eq("id", gestorIdSel)
          .maybeSingle();
        if (!profSel) return jsonResponse({ error: "Gestor não encontrado." }, 404);
        if (profSel.perfil_institucional !== "gestor") {
          return jsonResponse({ error: "Profissional selecionado não é gestor." }, 400);
        }
        if (profSel.unidade_id) {
          return jsonResponse({
            codigo: "gestor_ja_vinculado",
            mensagem: "Este gestor já está vinculado a uma unidade.",
          }, 400);
        }
        if (profSel.acesso_revogado) {
          return jsonResponse({
            codigo: "gestor_revogado",
            mensagem: "Este gestor está com acesso revogado. Reative-o antes de vincular a uma unidade.",
          }, 400);
        }

        const { data: unidade, error: errUni } = await admin
          .from("unidades")
          .insert({ nome, tipo, cnes, pais, estado, cidade, ativa: true, contratante_id })
          .select("id, nome")
          .single();
        if (errUni || !unidade) {
          console.error("Erro criar unidade:", errUni);
          return jsonResponse({ error: "Erro ao processar operação. Nenhum dado foi alterado." }, 500);
        }

        const { error: errVinc } = await admin
          .from("profissionais")
          .update({ unidade_id: unidade.id })
          .eq("id", profSel.id);
        if (errVinc) {
          console.error("Erro vincular gestor existente:", errVinc);
          await admin.from("unidades").delete().eq("id", unidade.id);
          return jsonResponse({ error: "Erro ao processar operação. Nenhum dado foi alterado." }, 500);
        }

        const emailMap = await getEmailMap(admin, [profSel.user_id]);
        const gestorEmailExistente = emailMap.get(profSel.user_id)?.email ?? "";
        await inserirAuditoria(
          admin, callerUserId, callerEmail, "criar_unidade",
          gestorEmailExistente, profSel.nome, null,
          {
            unidade_id: unidade.id,
            unidade_nome: unidade.nome,
            gestor_modo: "existente",
            gestor_id: profSel.id,
            plano_categoria: planoCategoria,
          },
        );

        return jsonResponse({
          status: "criado",
          unidade_id: unidade.id,
          gestor_id: profSel.id,
        });
      }

      // ----- modo "novo" (legado, default) -----
      const gestorNome = String(body.gestor_nome ?? "").trim();
      const gestorEmail = String(body.gestor_email ?? "").trim().toLowerCase();
      if (!nome || !gestorNome || !gestorEmail) {
        return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
      }

      const conflito = await verificarEmailEmUso(admin, gestorEmail);
      if (conflito.em_uso) {
        return jsonResponse(erroEmailParaResposta(conflito.perfil), 400);
      }

      // 1) Cria unidade
      const { data: unidade, error: errUni } = await admin
        .from("unidades")
        .insert({
          nome,
          tipo,
          cnes,
          pais,
          estado,
          cidade,
          ativa: true,
          contratante_id,
        })
        .select("id, nome")
        .single();
      if (errUni || !unidade) {
        console.error("Erro criar unidade:", errUni);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      // 2) Convida gestor
      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(gestorEmail, {
          data: {
            nome: gestorNome,
            perfil: "gestor_unidade",
            unidade_nome: unidade.nome,
          },
          redirectTo: `${APP_URL}/nova-senha?destino=/gestao`,
        });
      if (invErr || !invited?.user) {
        console.error("Erro invite gestor:", invErr);
        await admin.from("unidades").delete().eq("id", unidade.id);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }
      const newUserId = invited.user.id;

      // 3) Insere profissional gestor
      const { data: prof, error: errProf } = await admin
        .from("profissionais")
        .insert({
          user_id: newUserId,
          nome: gestorNome,
          unidade_id: unidade.id,
          perfil_institucional: "gestor",
          plano_id: planoId,
          plano_status: "ativo",
        })
        .select("id")
        .single();
      if (errProf) {
        console.error("Erro insert profissional:", errProf);
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        await admin.from("unidades").delete().eq("id", unidade.id);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      await inserirAuditoria(
        admin,
        callerUserId,
        callerEmail,
        "criar_unidade",
        gestorEmail,
        gestorNome,
        null,
        {
          unidade_id: unidade.id,
          unidade_nome: unidade.nome,
          gestor_email: gestorEmail,
          gestor_nome: gestorNome,
          gestor_modo: "novo",
          plano_categoria: planoCategoria,
        },
      );

      return jsonResponse({
        status: "criado",
        unidade_id: unidade.id,
        gestor_id: prof.id,
      });
    }

    // ============= editar_unidade =============
    if (acao === "editar_unidade") {
      const unidadeId = body.unidade_id;
      if (!unidadeId) {
        return jsonResponse({ error: "unidade_id é obrigatório." }, 400);
      }
      const camposPermitidos = [
        "nome",
        "tipo",
        "cnes",
        "pais",
        "estado",
        "cidade",
      ];
      const update: Record<string, unknown> = {};
      const alterados: string[] = [];
      for (const c of camposPermitidos) {
        if (body[c] !== undefined) {
          update[c] = body[c];
          alterados.push(c);
        }
      }
      if (alterados.length === 0) {
        return jsonResponse({ error: "Nenhum campo enviado." }, 400);
      }

      const { data: existing } = await admin
        .from("unidades")
        .select("id")
        .eq("id", unidadeId)
        .maybeSingle();
      if (!existing) {
        return jsonResponse(
          {
            codigo: "unidade_nao_encontrada",
            mensagem: "Uma ou mais unidades não existem.",
          },
          400,
        );
      }

      const { error: errUpd } = await admin
        .from("unidades")
        .update(update)
        .eq("id", unidadeId);
      if (errUpd) {
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      await inserirAuditoria(
        admin,
        callerUserId,
        callerEmail,
        "editar_unidade",
        callerEmail,
        null,
        null,
        { unidade_id: unidadeId, campos_alterados: alterados },
      );

      return jsonResponse({
        status: "atualizado",
        unidade_id: unidadeId,
        campos_alterados: alterados,
      });
    }

    // ============= trocar_gestor_unidade =============
    if (acao === "trocar_gestor_unidade") {
      const unidadeId = body.unidade_id;
      const novoNome = String(body.novo_gestor_nome ?? "").trim();
      const novoEmail = String(body.novo_gestor_email ?? "").trim().toLowerCase();
      const destino = body.destino_gestor_atual; // 'remover' | 'manter_como_profissional'
      if (!unidadeId || !novoNome || !novoEmail || !destino) {
        return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
      }

      const { data: unidade } = await admin
        .from("unidades")
        .select("id, nome")
        .eq("id", unidadeId)
        .maybeSingle();
      if (!unidade) {
        return jsonResponse(
          {
            codigo: "unidade_nao_encontrada",
            mensagem: "Uma ou mais unidades não existem.",
          },
          400,
        );
      }

      const conflito = await verificarEmailEmUso(admin, novoEmail);
      if (conflito.em_uso) {
        return jsonResponse(erroEmailParaResposta(conflito.perfil), 400);
      }

      // gestor atual
      const { data: gestorAtual } = await admin
        .from("profissionais")
        .select("id, user_id, nome")
        .eq("unidade_id", unidadeId)
        .eq("perfil_institucional", "gestor")
        .maybeSingle();
      const gestorAtualEmail = gestorAtual?.user_id
        ? (await admin.auth.admin.getUserById(gestorAtual.user_id)).data?.user
            ?.email ?? null
        : null;

      // Tratar gestor atual
      if (gestorAtual) {
        if (destino === "remover") {
          await admin
            .from("profissionais")
            .update({ unidade_id: null, perfil_institucional: null })
            .eq("id", gestorAtual.id);
          await admin.auth.admin.deleteUser(gestorAtual.user_id).catch(() => {});
        } else if (destino === "manter_como_profissional") {
          await admin
            .from("profissionais")
            .update({ perfil_institucional: "institucional" })
            .eq("id", gestorAtual.id);
        } else {
          return jsonResponse({ error: "destino_gestor_atual inválido." }, 400);
        }
      }

      // Convidar novo gestor
      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(novoEmail, {
          data: {
            nome: novoNome,
            perfil: "gestor_unidade",
            unidade_nome: unidade.nome,
          },
          redirectTo: `${APP_URL}/nova-senha?destino=/gestao`,
        });
      if (invErr || !invited?.user) {
        console.error("Erro invite novo gestor:", invErr);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }
      const newUserId = invited.user.id;

      const planoId = await getPlanoIdInstitucional(admin);
      const { data: novoProf, error: errProf } = await admin
        .from("profissionais")
        .insert({
          user_id: newUserId,
          nome: novoNome,
          unidade_id: unidadeId,
          perfil_institucional: "gestor",
          plano_id: planoId!,
          plano_status: "ativo",
        })
        .select("id")
        .single();
      if (errProf) {
        console.error("Erro insert profissional novo gestor:", errProf);
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      await inserirAuditoria(
        admin,
        callerUserId,
        callerEmail,
        "trocar_gestor_unidade",
        novoEmail,
        novoNome,
        null,
        {
          unidade_id: unidadeId,
          gestor_anterior_email: gestorAtualEmail,
          gestor_anterior_destino: destino,
          novo_gestor_email: novoEmail,
          novo_gestor_nome: novoNome,
        },
      );

      return jsonResponse({
        status: "trocado",
        unidade_id: unidadeId,
        novo_gestor_id: novoProf.id,
      });
    }

    // ============= listar_unidades =============
    if (acao === "listar_unidades") {
      const filtroContratante = body.contratante_id ?? null;
      let q = admin
        .from("unidades")
        .select("id, nome, tipo, cnes, pais, estado, cidade, contratante_id, created_at, contratantes(id, nome, status)")
        .order("created_at", { ascending: false });
      if (filtroContratante) q = q.eq("contratante_id", filtroContratante);
      const { data: unidades } = await q;

      const { data: gestores } = await admin
        .from("profissionais")
        .select("id, user_id, nome, unidade_id")
        .eq("perfil_institucional", "gestor");

      const userIds = (gestores ?? []).map((g) => g.user_id).filter(Boolean);
      const emailMap = await getEmailMap(admin, userIds);
      const gestorByUnidade = new Map<string, any>();
      for (const g of gestores ?? []) {
        if (g.unidade_id) {
          const info = emailMap.get(g.user_id);
          gestorByUnidade.set(g.unidade_id, {
            gestor_id: g.id,
            gestor_user_id: g.user_id,
            gestor_nome: g.nome,
            gestor_email: info?.email ?? null,
            convite_pendente: info ? info.last_sign_in_at == null : true,
          });
        }
      }

      const { data: profCounts } = await admin
        .from("profissionais")
        .select("unidade_id");
      const { data: pacCounts } = await admin
        .from("pacientes")
        .select("unidade_id");
      const profMap = new Map<string, number>();
      for (const p of profCounts ?? []) {
        if (p.unidade_id)
          profMap.set(p.unidade_id, (profMap.get(p.unidade_id) ?? 0) + 1);
      }
      const pacMap = new Map<string, number>();
      for (const p of pacCounts ?? []) {
        if (p.unidade_id)
          pacMap.set(p.unidade_id, (pacMap.get(p.unidade_id) ?? 0) + 1);
      }

      const out = (unidades ?? []).map((u: any) => {
        const g = gestorByUnidade.get(u.id) ?? {};
        return {
          id: u.id,
          nome: u.nome,
          tipo: u.tipo,
          cnes: u.cnes,
          pais: u.pais,
          estado: u.estado,
          cidade: u.cidade,
          contratante_id: u.contratante_id,
          contratante_nome: u.contratantes?.nome ?? null,
          contratante_status: u.contratantes?.status ?? null,
          gestor_id: g.gestor_id ?? null,
          gestor_user_id: g.gestor_user_id ?? null,
          gestor_nome: g.gestor_nome ?? null,
          gestor_email: g.gestor_email ?? null,
          convite_pendente: g.convite_pendente ?? null,
          profissionais_count: profMap.get(u.id) ?? 0,
          pacientes_count: pacMap.get(u.id) ?? 0,
          created_at: u.created_at,
        };
      });

      return jsonResponse({ status: "ok", unidades: out });
    }

    // ============= criar_gestor_geral =============
    if (acao === "criar_gestor_geral") {
      const nome = String(body.nome ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const cargo = body.cargo ?? null;
      const instituicao = body.instituicao ?? null;

      // [28.3a] Modelo novo: contratante_ids[]. Backwards-compat: aceita unidade_ids[] legado e converte.
      let contratanteIds: string[] = Array.isArray(body.contratante_ids)
        ? body.contratante_ids.filter((x: any) => typeof x === "string" && x)
        : [];
      const unidadeIdsLegado: string[] = Array.isArray(body.unidade_ids)
        ? body.unidade_ids.filter((x: any) => typeof x === "string" && x)
        : [];
      if (contratanteIds.length === 0 && unidadeIdsLegado.length > 0) {
        console.warn("[28.3a] criar_gestor_geral recebeu unidade_ids[] legado — convertendo para contratante_ids[].");
        const { data: uniRows } = await admin
          .from("unidades")
          .select("contratante_id")
          .in("id", unidadeIdsLegado);
        contratanteIds = Array.from(new Set((uniRows ?? []).map((u: any) => u.contratante_id).filter(Boolean)));
      }

      if (!nome || !email) {
        return jsonResponse({ error: "Nome e e-mail são obrigatórios." }, 400);
      }

      const conflito = await verificarEmailEmUso(admin, email);
      if (conflito.em_uso) {
        return jsonResponse(erroEmailParaResposta(conflito.perfil), 400);
      }

      // Validar contratantes (existem e ativos)
      if (contratanteIds.length > 0) {
        const { data: contRows } = await admin
          .from("contratantes")
          .select("id, status")
          .in("id", contratanteIds);
        if ((contRows?.length ?? 0) !== contratanteIds.length) {
          return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Um ou mais contratantes não existem." }, 400);
        }
        const encerrados = (contRows ?? []).filter((c: any) => c.status !== "ativo").map((c: any) => c.id);
        if (encerrados.length > 0) {
          return jsonResponse({ codigo: "contratante_encerrado", mensagem: "Um ou mais contratantes estão encerrados.", ids: encerrados }, 400);
        }
      }

      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            nome,
            perfil: "gestor_geral",
            cargo,
            instituicao,
            total_contratantes: contratanteIds.length,
          },
          redirectTo: `${APP_URL}/nova-senha?destino=/consolidar`,
        });
      if (invErr || !invited?.user) {
        console.error("Erro invite gestor geral:", invErr);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }
      const newUserId = invited.user.id;

      const { data: gg, error: errGg } = await admin
        .from("gestores_gerais")
        .insert({ user_id: newUserId, nome })
        .select("id")
        .single();
      if (errGg) {
        console.error("Erro insert gestor geral:", errGg);
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      if (contratanteIds.length > 0) {
        const vinculos = contratanteIds.map((cid) => ({
          gestor_geral_id: gg.id,
          contratante_id: cid,
        }));
        const { error: errVinc } = await admin
          .from("gestores_gerais_contratantes")
          .insert(vinculos);
        if (errVinc) {
          console.error("Erro vínculos contratantes:", errVinc);
          await admin.from("gestores_gerais").delete().eq("id", gg.id);
          await admin.auth.admin.deleteUser(newUserId).catch(() => {});
          return jsonResponse(
            { error: "Erro ao processar operação. Nenhum dado foi alterado." },
            500,
          );
        }
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail,
        "criar_gestor_geral",
        email, nome, null,
        {
          gestor_geral_id: gg.id,
          email,
          total_contratantes: contratanteIds.length,
          cargo,
          instituicao,
        },
      );

      return jsonResponse({
        status: "criado",
        gestor_geral_id: gg.id,
        contratantes_vinculados: contratanteIds.length,
      });
    }

    // ============= listar_gestores_gerais =============
    if (acao === "listar_gestores_gerais") {
      const { data: ggs } = await admin
        .from("gestores_gerais")
        .select("id, user_id, nome, created_at")
        .order("created_at", { ascending: false });

      const ids = (ggs ?? []).map((g) => g.id);
      const userIds = (ggs ?? []).map((g) => g.user_id).filter(Boolean);
      const emailMap = await getEmailMap(admin, userIds);

      // [28.3a] Vínculos com contratantes (modelo novo)
      const { data: vincC } = await admin
        .from("gestores_gerais_contratantes")
        .select("gestor_geral_id, contratante_id")
        .in("gestor_geral_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      const contratanteIds = Array.from(new Set((vincC ?? []).map((v) => v.contratante_id)));
      const { data: contratantesRows } = await admin
        .from("contratantes")
        .select("id, nome")
        .in("id", contratanteIds.length ? contratanteIds : ["00000000-0000-0000-0000-000000000000"]);
      const cMap = new Map((contratantesRows ?? []).map((c) => [c.id, c.nome] as const));

      const contratantesByGg = new Map<string, { id: string; nome: string }[]>();
      for (const v of vincC ?? []) {
        const arr = contratantesByGg.get(v.gestor_geral_id) ?? [];
        arr.push({ id: v.contratante_id, nome: cMap.get(v.contratante_id) ?? "" });
        contratantesByGg.set(v.gestor_geral_id, arr);
      }

      // Compat: também retorna unidades_vinculadas[] derivadas via contratante (frontend antigo continua funcionando)
      const { data: uniRows } = await admin
        .from("unidades")
        .select("id, nome, contratante_id")
        .in("contratante_id", contratanteIds.length ? contratanteIds : ["00000000-0000-0000-0000-000000000000"]);
      const uniByContratante = new Map<string, { id: string; nome: string }[]>();
      for (const u of uniRows ?? []) {
        const arr = uniByContratante.get(u.contratante_id) ?? [];
        arr.push({ id: u.id, nome: u.nome });
        uniByContratante.set(u.contratante_id, arr);
      }

      const out = (ggs ?? []).map((g) => {
        const info = emailMap.get(g.user_id);
        const meta = info?.user_metadata ?? {};
        const contratantes = contratantesByGg.get(g.id) ?? [];
        const unidades: { id: string; nome: string }[] = [];
        for (const c of contratantes) {
          for (const u of uniByContratante.get(c.id) ?? []) unidades.push(u);
        }
        return {
          id: g.id,
          user_id: g.user_id,
          nome: g.nome,
          email: info?.email ?? null,
          cargo: meta.cargo ?? null,
          instituicao: meta.instituicao ?? null,
          convite_pendente: info ? info.last_sign_in_at == null : true,
          contratantes_vinculados: contratantes,
          // compat — frontend antigo
          unidades_vinculadas: unidades.length,
          unidades,
          created_at: g.created_at,
        };
      });

      return jsonResponse({ status: "ok", gestores_gerais: out });
    }

    // ============= atualizar_vinculos_gestor_geral =============
    if (acao === "atualizar_vinculos_gestor_geral" || acao === "atualizar_vinculos_unidades") {
      const ggId = body.gestor_geral_id;

      // [28.3a] Modelo novo: contratante_ids[]. Backwards-compat: aceita unidade_ids[] e converte.
      let contratanteIds: string[] = Array.isArray(body.contratante_ids)
        ? body.contratante_ids.filter((x: any) => typeof x === "string" && x)
        : [];
      const unidadeIdsLegado: string[] = Array.isArray(body.unidade_ids)
        ? body.unidade_ids.filter((x: any) => typeof x === "string" && x)
        : [];
      if (contratanteIds.length === 0 && unidadeIdsLegado.length > 0) {
        console.warn("[28.3a] atualizar_vinculos_gestor_geral recebeu unidade_ids[] legado — convertendo.");
        const { data: uniRows } = await admin
          .from("unidades")
          .select("contratante_id")
          .in("id", unidadeIdsLegado);
        contratanteIds = Array.from(new Set((uniRows ?? []).map((u: any) => u.contratante_id).filter(Boolean)));
      }

      if (!ggId) {
        return jsonResponse({ codigo: "gestor_geral_nao_encontrado", mensagem: "Gestor geral não encontrado." }, 400);
      }

      const { data: gg } = await admin
        .from("gestores_gerais")
        .select("id")
        .eq("id", ggId)
        .maybeSingle();
      if (!gg) {
        return jsonResponse({ codigo: "gestor_geral_nao_encontrado", mensagem: "Gestor geral não encontrado." }, 400);
      }

      if (contratanteIds.length > 0) {
        const { data: contRows } = await admin
          .from("contratantes")
          .select("id, status")
          .in("id", contratanteIds);
        if ((contRows?.length ?? 0) !== contratanteIds.length) {
          return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Um ou mais contratantes não existem." }, 400);
        }
        const encerrados = (contRows ?? []).filter((c: any) => c.status !== "ativo").map((c: any) => c.id);
        if (encerrados.length > 0) {
          return jsonResponse({ codigo: "contratante_encerrado", mensagem: "Um ou mais contratantes estão encerrados.", ids: encerrados }, 400);
        }
      }

      const { data: atuaisRows } = await admin
        .from("gestores_gerais_contratantes")
        .select("contratante_id")
        .eq("gestor_geral_id", ggId);
      const atuais = new Set((atuaisRows ?? []).map((r) => r.contratante_id));
      const novos = new Set(contratanteIds);
      const adicionar = contratanteIds.filter((c) => !atuais.has(c));
      const remover = [...atuais].filter((c) => !novos.has(c));

      if (adicionar.length > 0) {
        await admin.from("gestores_gerais_contratantes").insert(
          adicionar.map((c) => ({ gestor_geral_id: ggId, contratante_id: c })),
        );
      }
      if (remover.length > 0) {
        await admin
          .from("gestores_gerais_contratantes")
          .delete()
          .eq("gestor_geral_id", ggId)
          .in("contratante_id", remover);
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail,
        "atualizar_vinculos_gestor_geral",
        callerEmail, null, null,
        {
          gestor_geral_id: ggId,
          adicionadas: adicionar.length,
          removidas: remover.length,
          total: contratanteIds.length,
        },
      );

      return jsonResponse({
        status: "atualizado",
        adicionadas: adicionar.length,
        removidas: remover.length,
        total: contratanteIds.length,
      });
    }

    // ============= desativar_gestor_geral =============
    if (acao === "desativar_gestor_geral") {
      const ggId = body.gestor_geral_id;
      if (!ggId) {
        return jsonResponse(
          {
            codigo: "gestor_geral_nao_encontrado",
            mensagem: "Gestor geral não encontrado.",
          },
          400,
        );
      }
      const { data: gg } = await admin
        .from("gestores_gerais")
        .select("id, user_id, nome")
        .eq("id", ggId)
        .maybeSingle();
      if (!gg) {
        return jsonResponse(
          {
            codigo: "gestor_geral_nao_encontrado",
            mensagem: "Gestor geral não encontrado.",
          },
          400,
        );
      }

      let alvoEmail = "";
      try {
        const { data } = await admin.auth.admin.getUserById(gg.user_id);
        alvoEmail = data?.user?.email ?? "";
      } catch {
        /* ignore */
      }

      await admin
        .from("gestores_gerais_unidades")
        .delete()
        .eq("gestor_geral_id", ggId);
      await admin.from("gestores_gerais").delete().eq("id", ggId);
      await admin.auth.admin.deleteUser(gg.user_id).catch(() => {});

      await inserirAuditoria(
        admin,
        callerUserId,
        callerEmail,
        "desativar_gestor_geral",
        alvoEmail,
        gg.nome ?? null,
        null,
        { gestor_geral_id: ggId, email: alvoEmail, nome: gg.nome },
      );

      return jsonResponse({ status: "desativado", gestor_geral_id: ggId });
    }

    // ============= reenviar_convite =============
    if (acao === "reenviar_convite") {
      const tipo = body.tipo;
      const id = body.id;
      if (!["gestor_unidade", "gestor_geral"].includes(tipo) || !id) {
        return jsonResponse({ error: "tipo/id inválidos." }, 400);
      }

      let userId: string | null = null;
      let nome: string | null = null;
      let unidadeNome: string | null = null;
      let cargo: string | null = null;
      let instituicao: string | null = null;
      let totalUnidades: number | null = null;

      if (tipo === "gestor_unidade") {
        const { data: u } = await admin
          .from("unidades")
          .select("id, nome")
          .eq("id", id)
          .maybeSingle();
        if (!u) {
          return jsonResponse(
            {
              codigo: "unidade_nao_encontrada",
              mensagem: "Uma ou mais unidades não existem.",
            },
            400,
          );
        }
        unidadeNome = u.nome;
        const { data: prof } = await admin
          .from("profissionais")
          .select("user_id, nome")
          .eq("unidade_id", id)
          .eq("perfil_institucional", "gestor")
          .maybeSingle();
        if (!prof) {
          return jsonResponse(
            { error: "Unidade sem gestor cadastrado." },
            400,
          );
        }
        userId = prof.user_id;
        nome = prof.nome;
      } else {
        const { data: gg } = await admin
          .from("gestores_gerais")
          .select("id, user_id, nome")
          .eq("id", id)
          .maybeSingle();
        if (!gg) {
          return jsonResponse(
            {
              codigo: "gestor_geral_nao_encontrado",
              mensagem: "Gestor geral não encontrado.",
            },
            400,
          );
        }
        userId = gg.user_id;
        nome = gg.nome;
        const { count } = await admin
          .from("gestores_gerais_unidades")
          .select("id", { count: "exact", head: true })
          .eq("gestor_geral_id", gg.id);
        totalUnidades = count ?? 0;
      }

      const { data: u } = await admin.auth.admin.getUserById(userId!);
      if (!u?.user) {
        return jsonResponse({ error: "Usuário não encontrado no Auth." }, 400);
      }
      if (u.user.last_sign_in_at) {
        return jsonResponse(
          {
            codigo: "usuario_ja_ativo",
            mensagem: "Este usuário já está ativo no sistema.",
          },
          400,
        );
      }
      const meta = u.user.user_metadata ?? {};
      cargo = meta.cargo ?? null;
      instituicao = meta.instituicao ?? null;

      const email = u.user.email!;
      const redirect =
        tipo === "gestor_unidade"
          ? `${APP_URL}/nova-senha?destino=/gestao`
          : `${APP_URL}/nova-senha?destino=/consolidar`;

      const { error: invErr } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            nome,
            perfil: tipo,
            unidade_nome: unidadeNome ?? undefined,
            cargo: cargo ?? undefined,
            instituicao: instituicao ?? undefined,
            total_unidades: totalUnidades ?? undefined,
          },
          redirectTo: redirect,
        },
      );
      if (invErr) {
        console.error("Erro reenviar convite:", invErr);
        return jsonResponse(
          { error: "Erro ao processar operação. Nenhum dado foi alterado." },
          500,
        );
      }

      await inserirAuditoria(
        admin,
        callerUserId,
        callerEmail,
        tipo === "gestor_unidade"
          ? "reenviar_convite_gestor_unidade"
          : "reenviar_convite_gestor_geral",
        email,
        nome,
        null,
        { id, email, tipo },
      );

      return jsonResponse({ status: "reenviado", tipo, id, email });
    }

    // ============= listar_profissionais =============
    if (acao === "listar_profissionais") {
      const filtroUnidade = body.unidade_id ?? null;
      const filtroContratante = body.contratante_id ?? null;

      let q = admin
        .from("profissionais")
        .select(
          "id, user_id, nome, crm, especialidade, perfil_clinico, perfil_institucional, unidade_id, acesso_revogado, acesso_revogado_em, motivo_revogacao, created_at, unidades(nome, contratante_id, contratantes(id, nome))"
        )
        .not("unidade_id", "is", null)
        .neq("perfil_institucional", "gestor")
        .order("acesso_revogado", { ascending: true })
        .order("created_at", { ascending: false });
      if (filtroUnidade) q = q.eq("unidade_id", filtroUnidade);

      const { data: profs, error: errList } = await q;
      if (errList) {
        console.error("Erro listar profissionais:", errList);
        return jsonResponse({ error: "Erro ao listar." }, 500);
      }

      const userIds = (profs ?? []).map((p: any) => p.user_id).filter(Boolean);
      const emailMap = await getEmailMap(admin, userIds);

      // convites pendentes — por email
      const emails = Array.from(emailMap.values())
        .map((u) => u.email)
        .filter(Boolean) as string[];
      const pendentes = new Set<string>();
      if (emails.length > 0) {
        const { data: convs } = await admin
          .from("convites")
          .select("email_convidado")
          .in("email_convidado", emails)
          .eq("status", "pendente");
        (convs ?? []).forEach((c: any) =>
          pendentes.add((c.email_convidado ?? "").toLowerCase()),
        );
      }

      let profissionais = (profs ?? []).map((p: any) => {
        const auth = emailMap.get(p.user_id);
        const email = auth?.email ?? null;
        return {
          id: p.id,
          user_id: p.user_id,
          nome: p.nome,
          email,
          crm: p.crm,
          especialidade: p.especialidade,
          perfil_clinico: p.perfil_clinico,
          perfil_institucional: p.perfil_institucional,
          unidade_id: p.unidade_id,
          unidade_nome: p.unidades?.nome ?? null,
          contratante_id: p.unidades?.contratante_id ?? null,
          contratante_nome: p.unidades?.contratantes?.nome ?? null,
          convite_pendente: email
            ? pendentes.has(email.toLowerCase())
            : false,
          acesso_revogado: !!p.acesso_revogado,
          acesso_revogado_em: p.acesso_revogado_em,
          motivo_revogacao: p.motivo_revogacao,
          created_at: p.created_at,
        };
      });

      if (filtroContratante) {
        profissionais = profissionais.filter((p) => p.contratante_id === filtroContratante);
      }

      return jsonResponse({ status: "ok", profissionais });
    }

    // ============= convidar_profissional_unidade =============
    if (acao === "convidar_profissional_unidade") {
      const unidade_id = String(body.unidade_id ?? "").trim();
      const nome = String(body.nome ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const perfil = String(body.perfil ?? "").trim();
      const PERFIS_VALIDOS = ["medico", "enfermeiro", "tecnico_enfermagem", "outro"];

      if (!unidade_id || !nome || !email || !PERFIS_VALIDOS.includes(perfil)) {
        return jsonResponse({ error: "Campos obrigatórios ausentes ou inválidos." }, 400);
      }

      const { data: uni } = await admin
        .from("unidades")
        .select("id, nome")
        .eq("id", unidade_id)
        .maybeSingle();
      if (!uni) return jsonResponse({ error: "Unidade não encontrada." }, 404);

      const conflito = await verificarEmailEmUso(admin, email);
      if (conflito.em_uso) {
        // Caso especial: profissional consultório (sem unidade)
        if (conflito.perfil === "profissional" && conflito.user_id) {
          const { data: prof } = await admin
            .from("profissionais")
            .select("unidade_id")
            .eq("user_id", conflito.user_id)
            .maybeSingle();
          if (!prof?.unidade_id) {
            return jsonResponse({
              codigo: "email_em_uso_consultorio",
              mensagem:
                "Este profissional já tem conta de consultório. Por questão de auditoria, ele precisa aceitar o vínculo institucional via convite tradicional. Peça que o gestor da unidade envie o convite pelo painel /gestao/equipe.",
            }, 400);
          }
          return jsonResponse({
            codigo: "email_em_uso_profissional_outra_unidade",
            mensagem: "Este e-mail já está cadastrado como profissional de outra unidade.",
          }, 400);
        }
        return jsonResponse(erroEmailParaResposta(conflito.perfil), 400);
      }

      const planoId = await getPlanoIdInstitucional(admin);
      if (!planoId) return jsonResponse({ error: "Plano padrão não encontrado." }, 500);

      // Convida
      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            nome,
            perfil: "profissional_institucional",
            perfil_clinico: perfil,
            unidade_nome: uni.nome,
          },
          redirectTo: `${APP_URL}/nova-senha?destino=/dashboard`,
        });
      if (invErr || !invited?.user) {
        console.error("Erro invite profissional:", invErr);
        return jsonResponse({ error: "Erro ao processar operação." }, 500);
      }
      const newUserId = invited.user.id;

      // Cria registro profissional
      const { data: prof, error: errProf } = await admin
        .from("profissionais")
        .insert({
          user_id: newUserId,
          nome,
          unidade_id,
          perfil_institucional: "institucional",
          perfil_clinico: perfil,
          plano_id: planoId,
          plano_status: "ativo",
        })
        .select("id")
        .single();
      if (errProf) {
        console.error("Erro insert profissional:", errProf);
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        return jsonResponse({ error: "Erro ao processar operação." }, 500);
      }

      // Registra convite
      const token = crypto.randomUUID();
      const { data: conv } = await admin
        .from("convites")
        .insert({
          unidade_id,
          email_convidado: email,
          token,
          status: "pendente",
          convidado_por: callerUserId,
        })
        .select("id")
        .single();

      await inserirAuditoria(
        admin, callerUserId, callerEmail,
        "convidar_profissional_unidade",
        email, nome, null,
        { unidade_id, unidade_nome: uni.nome, perfil_clinico: perfil, profissional_id: prof.id },
      );

      return jsonResponse({
        status: "convite_enviado",
        profissional_id: prof.id,
        convite_id: conv?.id ?? null,
      });
    }

    // ============= editar_profissional =============
    if (acao === "editar_profissional") {
      const profissional_id = String(body.profissional_id ?? "").trim();
      if (!profissional_id) return jsonResponse({ error: "profissional_id obrigatório." }, 400);

      const updates: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) updates.nome = body.nome.trim();
      if (typeof body.perfil === "string") {
        const PERFIS_VALIDOS = ["medico", "enfermeiro", "tecnico_enfermagem", "outro"];
        if (!PERFIS_VALIDOS.includes(body.perfil)) {
          return jsonResponse({ error: "Perfil clínico inválido." }, 400);
        }
        updates.perfil_clinico = body.perfil;
      }
      if (Object.keys(updates).length === 0) {
        return jsonResponse({ error: "Nada a atualizar." }, 400);
      }

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, unidade_id, user_id")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Profissional não encontrado." }, 404);
      if (!prof.unidade_id) return jsonResponse({ error: "Não é profissional institucional." }, 400);

      const { error: errUpd } = await admin
        .from("profissionais")
        .update(updates)
        .eq("id", profissional_id);
      if (errUpd) {
        console.error("Erro editar profissional:", errUpd);
        return jsonResponse({ error: "Erro ao atualizar." }, 500);
      }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "editar_profissional",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        { profissional_id, updates },
      );

      return jsonResponse({ status: "atualizado" });
    }

    // ============= transferir_profissional =============
    if (acao === "transferir_profissional") {
      const profissional_id = String(body.profissional_id ?? "").trim();
      const unidade_destino_id = String(body.unidade_destino_id ?? "").trim();
      if (!profissional_id || !unidade_destino_id) {
        return jsonResponse({ error: "Parâmetros obrigatórios ausentes." }, 400);
      }

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, unidade_id, user_id")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Profissional não encontrado." }, 404);
      if (!prof.unidade_id) return jsonResponse({ error: "Profissional não tem unidade." }, 400);
      if (prof.unidade_id === unidade_destino_id) {
        return jsonResponse({ error: "Unidade destino igual à atual." }, 400);
      }

      const { data: uniOrigem } = await admin.from("unidades").select("nome").eq("id", prof.unidade_id).maybeSingle();
      const { data: uniDestino } = await admin.from("unidades").select("id, nome").eq("id", unidade_destino_id).maybeSingle();
      if (!uniDestino) return jsonResponse({ error: "Unidade destino não encontrada." }, 404);

      const STATUS_INATIVOS = ["DMG afastado", "Resultado do parto", "Encerrada"];
      const { count: orfasCount } = await admin
        .from("pacientes")
        .select("id", { count: "exact", head: true })
        .eq("profissional_id", profissional_id)
        .eq("unidade_id", prof.unidade_id)
        .not("status_ficha", "in", `(${STATUS_INATIVOS.map((s) => `"${s}"`).join(",")})`);

      const { error: errUpd } = await admin
        .from("profissionais")
        .update({ unidade_id: unidade_destino_id })
        .eq("id", profissional_id);
      if (errUpd) {
        console.error("Erro transferir:", errUpd);
        return jsonResponse({ error: "Erro ao transferir." }, 500);
      }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "transferir_profissional",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        {
          profissional_id,
          unidade_origem_id: prof.unidade_id,
          unidade_origem_nome: uniOrigem?.nome ?? null,
          unidade_destino_id,
          unidade_destino_nome: uniDestino.nome,
          pacientes_orfas_count: orfasCount ?? 0,
        },
      );

      return jsonResponse({
        status: "transferido",
        pacientes_orfas_count: orfasCount ?? 0,
        unidade_origem_nome: uniOrigem?.nome ?? null,
        unidade_destino_nome: uniDestino.nome,
      });
    }

    // ============= revogar_acesso_profissional =============
    if (acao === "revogar_acesso_profissional") {
      const profissional_id = String(body.profissional_id ?? "").trim();
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() || null : null;
      if (!profissional_id) return jsonResponse({ error: "profissional_id obrigatório." }, 400);

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, unidade_id, acesso_revogado")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Profissional não encontrado." }, 404);
      if (!prof.unidade_id) return jsonResponse({ error: "Não é profissional institucional." }, 400);
      if (prof.acesso_revogado) return jsonResponse({ error: "Acesso já está revogado." }, 400);

      const { data: callerProf } = await admin
        .from("profissionais")
        .select("id")
        .eq("user_id", callerUserId)
        .maybeSingle();

      const { error: errUpd } = await admin
        .from("profissionais")
        .update({
          acesso_revogado: true,
          acesso_revogado_em: new Date().toISOString(),
          acesso_revogado_por: callerProf?.id ?? null,
          motivo_revogacao: motivo,
        })
        .eq("id", profissional_id);
      if (errUpd) {
        console.error("Erro revogar:", errUpd);
        return jsonResponse({ error: "Erro ao revogar." }, 500);
      }

      // Encerra sessões ativas
      try {
        await admin.auth.admin.signOut(prof.user_id, "global");
      } catch (e) {
        console.warn("signOut falhou:", e);
      }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "revogar_acesso_profissional",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        { profissional_id, motivo },
      );

      return jsonResponse({ status: "revogado" });
    }

    // ============= reativar_acesso_profissional =============
    if (acao === "reativar_acesso_profissional") {
      const profissional_id = String(body.profissional_id ?? "").trim();
      if (!profissional_id) return jsonResponse({ error: "profissional_id obrigatório." }, 400);

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, acesso_revogado")
        .eq("id", profissional_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Profissional não encontrado." }, 404);
      if (!prof.acesso_revogado) return jsonResponse({ error: "Acesso não está revogado." }, 400);

      const { error: errUpd } = await admin
        .from("profissionais")
        .update({
          acesso_revogado: false,
          acesso_revogado_em: null,
          acesso_revogado_por: null,
          motivo_revogacao: null,
        })
        .eq("id", profissional_id);
      if (errUpd) {
        console.error("Erro reativar:", errUpd);
        return jsonResponse({ error: "Erro ao reativar." }, 500);
      }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "reativar_acesso_profissional",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        { profissional_id },
      );

      return jsonResponse({ status: "reativado" });
    }

    // ============= listar_gestores_unidade =============
    if (acao === "listar_gestores_unidade") {
      const { data: profs, error: errList } = await admin
        .from("profissionais")
        .select(
          "id, user_id, nome, unidade_id, acesso_revogado, acesso_revogado_em, motivo_revogacao, created_at, unidades(nome)",
        )
        .eq("perfil_institucional", "gestor")
        .order("acesso_revogado", { ascending: true })
        .order("created_at", { ascending: false });
      if (errList) {
        console.error("Erro listar gestores unidade:", errList);
        return jsonResponse({ error: "Erro ao listar." }, 500);
      }

      const userIds = (profs ?? []).map((p: any) => p.user_id).filter(Boolean);
      const emailMap = await getEmailMap(admin, userIds);
      const emails = Array.from(emailMap.values())
        .map((u) => u.email)
        .filter(Boolean) as string[];
      const pendentes = new Set<string>();
      if (emails.length > 0) {
        const { data: convs } = await admin
          .from("convites")
          .select("email_convidado")
          .in("email_convidado", emails)
          .eq("status", "pendente");
        (convs ?? []).forEach((c: any) =>
          pendentes.add((c.email_convidado ?? "").toLowerCase()),
        );
      }
      // Heurística adicional para "convite pendente": gestor que ainda nunca logou.
      const gestores = (profs ?? []).map((p: any) => {
        const auth = emailMap.get(p.user_id);
        const email = auth?.email ?? null;
        const nuncaLogou = !auth?.last_sign_in_at;
        return {
          id: p.id,
          user_id: p.user_id,
          nome: p.nome,
          email,
          unidade_id: p.unidade_id,
          unidade_nome: p.unidades?.nome ?? null,
          convite_pendente:
            (email ? pendentes.has(email.toLowerCase()) : false) || nuncaLogou,
          acesso_revogado: !!p.acesso_revogado,
          acesso_revogado_em: p.acesso_revogado_em,
          motivo_revogacao: p.motivo_revogacao,
          created_at: p.created_at,
        };
      });

      return jsonResponse({ status: "ok", gestores });
    }

    // ============= cadastrar_gestor_unidade =============
    if (acao === "cadastrar_gestor_unidade") {
      const nome = String(body.nome ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const unidadeIdOpt = body.unidade_id ? String(body.unidade_id) : null;
      if (!nome || !email) {
        return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
      }

      const conflito = await verificarEmailEmUso(admin, email);
      if (conflito.em_uso) {
        if (conflito.perfil === "profissional" && conflito.user_id) {
          const { data: prof } = await admin
            .from("profissionais")
            .select("unidade_id")
            .eq("user_id", conflito.user_id)
            .maybeSingle();
          if (!prof?.unidade_id) {
            return jsonResponse({
              codigo: "email_em_uso_consultorio",
              mensagem:
                "Este profissional já tem conta de consultório. Por questão de auditoria, ele precisa aceitar o vínculo institucional via convite tradicional.",
            }, 400);
          }
        }
        return jsonResponse(erroEmailParaResposta(conflito.perfil), 400);
      }

      // Validação opcional de unidade
      let unidadeNome: string | null = null;
      if (unidadeIdOpt) {
        const { data: uni } = await admin
          .from("unidades").select("id, nome").eq("id", unidadeIdOpt).maybeSingle();
        if (!uni) return jsonResponse({ error: "Unidade não encontrada." }, 404);
        unidadeNome = uni.nome;
        const { data: jaTem } = await admin
          .from("profissionais")
          .select("id")
          .eq("perfil_institucional", "gestor")
          .eq("unidade_id", unidadeIdOpt)
          .eq("acesso_revogado", false)
          .maybeSingle();
        if (jaTem) {
          return jsonResponse({
            codigo: "unidade_ja_tem_gestor",
            mensagem: "Esta unidade já tem um gestor ativo. Troque pelo painel de Unidades antes.",
          }, 400);
        }
      }

      const planoId = await getPlanoIdInstitucional(admin);
      if (!planoId) return jsonResponse({ error: "Plano padrão não encontrado." }, 500);

      const { data: invited, error: invErr } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { nome, perfil: "gestor_unidade", unidade_nome: unidadeNome ?? undefined },
          redirectTo: `${APP_URL}/nova-senha?destino=/gestao`,
        });
      if (invErr || !invited?.user) {
        console.error("Erro invite gestor:", invErr);
        return jsonResponse({ error: "Erro ao processar operação." }, 500);
      }
      const newUserId = invited.user.id;

      const { data: prof, error: errProf } = await admin
        .from("profissionais")
        .insert({
          user_id: newUserId,
          nome,
          unidade_id: unidadeIdOpt,
          perfil_institucional: "gestor",
          plano_id: planoId,
          plano_status: "ativo",
        })
        .select("id")
        .single();
      if (errProf) {
        console.error("Erro insert gestor:", errProf);
        await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        return jsonResponse({ error: "Erro ao processar operação." }, 500);
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail, "cadastrar_gestor_unidade",
        email, nome, null, { gestor_id: prof.id, unidade_id: unidadeIdOpt },
      );

      return jsonResponse({
        status: unidadeIdOpt ? "cadastrado_e_vinculado" : "cadastrado",
        gestor_id: prof.id,
        unidade_id: unidadeIdOpt,
      });
    }

    // ============= editar_gestor_unidade =============
    if (acao === "editar_gestor_unidade") {
      const gestor_id = String(body.gestor_id ?? "").trim();
      const nome = typeof body.nome === "string" ? body.nome.trim() : "";
      if (!gestor_id || !nome) {
        return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
      }
      const { data: prof } = await admin
        .from("profissionais")
        .select("id, perfil_institucional, user_id, nome")
        .eq("id", gestor_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Gestor não encontrado." }, 404);
      if (prof.perfil_institucional !== "gestor") {
        return jsonResponse({ error: "Não é gestor de unidade." }, 400);
      }
      const { error: errUpd } = await admin
        .from("profissionais").update({ nome }).eq("id", gestor_id);
      if (errUpd) return jsonResponse({ error: "Erro ao atualizar." }, 500);
      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "editar_gestor_unidade",
        emailMap.get(prof.user_id)?.email ?? "", nome, null, { gestor_id },
      );
      return jsonResponse({ status: "atualizado" });
    }

    // ============= vincular_gestor_a_unidade =============
    if (acao === "vincular_gestor_a_unidade") {
      const gestor_id = String(body.gestor_id ?? "").trim();
      const unidade_id = String(body.unidade_id ?? "").trim();
      if (!gestor_id || !unidade_id) {
        return jsonResponse({ error: "gestor_id e unidade_id obrigatórios." }, 400);
      }
      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, unidade_id, perfil_institucional, acesso_revogado")
        .eq("id", gestor_id).maybeSingle();
      if (!prof) return jsonResponse({ error: "Gestor não encontrado." }, 404);
      if (prof.perfil_institucional !== "gestor") {
        return jsonResponse({ error: "Não é gestor de unidade." }, 400);
      }
      if (prof.acesso_revogado) {
        return jsonResponse({
          codigo: "gestor_revogado_para_vincular",
          mensagem: "Este gestor está com acesso revogado. Reative-o antes de vincular a uma unidade.",
        }, 400);
      }
      if (prof.unidade_id) {
        return jsonResponse({
          codigo: "gestor_ja_vinculado",
          mensagem: "Este gestor já está vinculado a uma unidade.",
        }, 400);
      }
      const { data: uni } = await admin
        .from("unidades").select("id, nome").eq("id", unidade_id).maybeSingle();
      if (!uni) return jsonResponse({ error: "Unidade não encontrada." }, 404);
      const { data: jaTem } = await admin
        .from("profissionais")
        .select("id")
        .eq("perfil_institucional", "gestor")
        .eq("unidade_id", unidade_id)
        .eq("acesso_revogado", false)
        .maybeSingle();
      if (jaTem) {
        return jsonResponse({
          codigo: "unidade_ja_tem_gestor",
          mensagem: "Esta unidade já tem um gestor ativo.",
        }, 400);
      }
      const { error: errUpd } = await admin
        .from("profissionais").update({ unidade_id }).eq("id", gestor_id);
      if (errUpd) {
        console.error("Erro vincular:", errUpd);
        return jsonResponse({ error: "Erro ao vincular." }, 500);
      }
      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "vincular_gestor_a_unidade",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        { gestor_id, unidade_id, unidade_nome: uni.nome },
      );
      return jsonResponse({ status: "vinculado", unidade_nome: uni.nome });
    }

    // ============= desvincular_gestor =============
    if (acao === "desvincular_gestor") {
      const gestor_id = String(body.gestor_id ?? "").trim();
      if (!gestor_id) return jsonResponse({ error: "gestor_id obrigatório." }, 400);
      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, unidade_id, perfil_institucional, unidades(nome)")
        .eq("id", gestor_id).maybeSingle();
      if (!prof) return jsonResponse({ error: "Gestor não encontrado." }, 404);
      if (prof.perfil_institucional !== "gestor") {
        return jsonResponse({ error: "Não é gestor de unidade." }, 400);
      }
      if (!prof.unidade_id) {
        return jsonResponse({
          codigo: "gestor_nao_vinculado",
          mensagem: "Este gestor não está vinculado a nenhuma unidade.",
        }, 400);
      }
      const unidadeOrigemNome = (prof as any).unidades?.nome ?? null;
      const { error: errUpd } = await admin
        .from("profissionais").update({ unidade_id: null }).eq("id", gestor_id);
      if (errUpd) {
        console.error("Erro desvincular:", errUpd);
        return jsonResponse({ error: "Erro ao desvincular." }, 500);
      }
      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "desvincular_gestor",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null,
        { gestor_id, unidade_origem_nome: unidadeOrigemNome },
      );
      return jsonResponse({ status: "desvinculado", unidade_origem_nome: unidadeOrigemNome });
    }

    // ============= revogar_acesso_gestor_unidade =============
    if (acao === "revogar_acesso_gestor_unidade") {
      const gestor_id = String(body.gestor_id ?? "").trim();
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() || null : null;
      if (!gestor_id) return jsonResponse({ error: "gestor_id obrigatório." }, 400);

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, unidade_id, perfil_institucional, acesso_revogado, unidades(nome)")
        .eq("id", gestor_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Gestor não encontrado." }, 404);
      if (prof.perfil_institucional !== "gestor") {
        return jsonResponse({ error: "Não é gestor de unidade." }, 400);
      }
      if (prof.acesso_revogado) {
        return jsonResponse({ error: "Acesso já está revogado." }, 400);
      }
      if (prof.unidade_id) {
        return jsonResponse({
          codigo: "gestor_ainda_vinculado",
          mensagem: `Este gestor ainda está vinculado à unidade ${(prof as any).unidades?.nome ?? ""}. Use a aba Unidades para trocar o gestor antes de revogar o acesso.`,
          unidade_nome: (prof as any).unidades?.nome ?? null,
          unidade_id: prof.unidade_id,
        }, 400);
      }

      const { data: callerProf } = await admin
        .from("profissionais")
        .select("id")
        .eq("user_id", callerUserId)
        .maybeSingle();

      const { error: errUpd } = await admin
        .from("profissionais")
        .update({
          acesso_revogado: true,
          acesso_revogado_em: new Date().toISOString(),
          acesso_revogado_por: callerProf?.id ?? null,
          motivo_revogacao: motivo,
        })
        .eq("id", gestor_id);
      if (errUpd) {
        console.error("Erro revogar gestor:", errUpd);
        return jsonResponse({ error: "Erro ao revogar." }, 500);
      }

      try { await admin.auth.admin.signOut(prof.user_id, "global"); } catch (e) { console.warn(e); }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "revogar_acesso_gestor_unidade",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null, { gestor_id, motivo },
      );
      return jsonResponse({ status: "revogado" });
    }

    // ============= reativar_acesso_gestor_unidade =============
    if (acao === "reativar_acesso_gestor_unidade") {
      const gestor_id = String(body.gestor_id ?? "").trim();
      if (!gestor_id) return jsonResponse({ error: "gestor_id obrigatório." }, 400);

      const { data: prof } = await admin
        .from("profissionais")
        .select("id, nome, user_id, perfil_institucional, acesso_revogado")
        .eq("id", gestor_id)
        .maybeSingle();
      if (!prof) return jsonResponse({ error: "Gestor não encontrado." }, 404);
      if (prof.perfil_institucional !== "gestor") {
        return jsonResponse({ error: "Não é gestor de unidade." }, 400);
      }
      if (!prof.acesso_revogado) {
        return jsonResponse({ error: "Acesso não está revogado." }, 400);
      }

      const { error: errUpd } = await admin
        .from("profissionais")
        .update({
          acesso_revogado: false,
          acesso_revogado_em: null,
          acesso_revogado_por: null,
          motivo_revogacao: null,
        })
        .eq("id", gestor_id);
      if (errUpd) {
        console.error("Erro reativar gestor:", errUpd);
        return jsonResponse({ error: "Erro ao reativar." }, 500);
      }

      const emailMap = await getEmailMap(admin, [prof.user_id]);
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "reativar_acesso_gestor_unidade",
        emailMap.get(prof.user_id)?.email ?? "", prof.nome, null, { gestor_id },
      );
      return jsonResponse({ status: "reativado" });
    }

    // ====================================================================
    // ============= [28.3a] CAMADA CONTRATANTE — 6 ações novas ============
    // ====================================================================

    // ============= listar_contratantes =============
    if (acao === "listar_contratantes") {
      const { data: cs } = await admin
        .from("contratantes")
        .select("id, nome, cnpj, razao_social, contato_nome, contato_email, contato_telefone, data_inicio_contrato, data_termino_contrato, status, observacoes, encerrado_em, motivo_encerramento, created_at")
        .order("created_at", { ascending: false });

      const ids = (cs ?? []).map((c) => c.id);

      const { data: uniRows } = await admin
        .from("unidades")
        .select("id, nome, contratante_id")
        .in("contratante_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const uniByCont = new Map<string, string[]>();
      const nomesByCont = new Map<string, string[]>();
      const uniIds: string[] = [];
      for (const u of uniRows ?? []) {
        const arr = uniByCont.get(u.contratante_id) ?? [];
        arr.push(u.id);
        uniByCont.set(u.contratante_id, arr);
        const narr = nomesByCont.get(u.contratante_id) ?? [];
        narr.push(u.nome);
        nomesByCont.set(u.contratante_id, narr);
        uniIds.push(u.id);
      }

      const { data: ggRows } = await admin
        .from("gestores_gerais_contratantes")
        .select("contratante_id, gestor_geral_id")
        .in("contratante_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const ggByCont = new Map<string, number>();
      for (const v of ggRows ?? []) {
        ggByCont.set(v.contratante_id, (ggByCont.get(v.contratante_id) ?? 0) + 1);
      }

      const { data: profRows } = await admin
        .from("profissionais")
        .select("unidade_id")
        .in("unidade_id", uniIds.length ? uniIds : ["00000000-0000-0000-0000-000000000000"]);
      const profByUni = new Map<string, number>();
      for (const p of profRows ?? []) {
        if (p.unidade_id) profByUni.set(p.unidade_id, (profByUni.get(p.unidade_id) ?? 0) + 1);
      }

      const out = (cs ?? []).map((c: any) => {
        const unis = uniByCont.get(c.id) ?? [];
        let profCount = 0;
        for (const uid of unis) profCount += profByUni.get(uid) ?? 0;
        return {
          ...c,
          unidades_count: unis.length,
          unidades_nomes: nomesByCont.get(c.id) ?? [],
          gestores_gerais_count: ggByCont.get(c.id) ?? 0,
          profissionais_count: profCount,
        };
      });

      return jsonResponse({ status: "ok", contratantes: out });
    }

    // ============= criar_contratante =============
    if (acao === "criar_contratante") {
      const nome = String(body.nome ?? "").trim();
      const cnpjRaw = String(body.cnpj ?? "").replace(/\D/g, "");
      const razao_social = body.razao_social ?? null;
      const contato_nome = String(body.contato_nome ?? "").trim();
      const contato_email = String(body.contato_email ?? "").trim().toLowerCase();
      const contato_telefone = body.contato_telefone ?? null;
      const data_inicio_contrato = body.data_inicio_contrato ?? null;
      const data_termino_contrato = body.data_termino_contrato ?? null;
      const observacoes = body.observacoes ?? null;

      if (!nome || nome.length > 200) {
        return jsonResponse({ codigo: "nome_contratante_obrigatorio", mensagem: "Nome do contratante é obrigatório." }, 400);
      }
      if (cnpjRaw.length !== 14) {
        return jsonResponse({ codigo: "cnpj_invalido", mensagem: "CNPJ inválido." }, 400);
      }
      const cnpj = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12)}`;
      if (!contato_nome) {
        return jsonResponse({ error: "contato_nome obrigatório." }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato_email)) {
        return jsonResponse({ codigo: "contato_email_invalido", mensagem: "E-mail de contato inválido." }, 400);
      }
      if (!data_inicio_contrato) {
        return jsonResponse({ codigo: "data_inicio_obrigatoria", mensagem: "Data de início do contrato é obrigatória." }, 400);
      }
      if (data_termino_contrato && data_termino_contrato <= data_inicio_contrato) {
        return jsonResponse({ codigo: "data_termino_invalida", mensagem: "Data de término deve ser posterior à data de início." }, 400);
      }

      const { data: existente } = await admin
        .from("contratantes")
        .select("id")
        .eq("cnpj", cnpj)
        .maybeSingle();
      if (existente) {
        return jsonResponse({ codigo: "cnpj_duplicado", mensagem: "Já existe um contratante com este CNPJ." }, 400);
      }

      const { data: novo, error: errIns } = await admin
        .from("contratantes")
        .insert({
          nome, cnpj, razao_social,
          contato_nome, contato_email, contato_telefone,
          data_inicio_contrato, data_termino_contrato,
          status: "ativo", observacoes,
        })
        .select("id, nome, cnpj")
        .single();
      if (errIns || !novo) {
        console.error("Erro criar contratante:", errIns);
        return jsonResponse({ error: "Erro ao criar contratante." }, 500);
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail, "criar_contratante",
        contato_email, nome, null,
        { contratante_id: novo.id, cnpj: novo.cnpj },
      );
      return jsonResponse({ status: "criado", contratante_id: novo.id });
    }

    // ============= editar_contratante =============
    if (acao === "editar_contratante") {
      const contratante_id = String(body.contratante_id ?? "").trim();
      if (!contratante_id) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }
      const { data: atual } = await admin
        .from("contratantes")
        .select("id, data_inicio_contrato, data_termino_contrato")
        .eq("id", contratante_id)
        .maybeSingle();
      if (!atual) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }

      const update: Record<string, any> = {};
      const editaveis = ["nome", "razao_social", "contato_nome", "contato_email", "contato_telefone", "data_inicio_contrato", "data_termino_contrato", "observacoes"];
      for (const k of editaveis) {
        if (k in body && body[k] !== undefined) update[k] = body[k];
      }
      // CNPJ e status NÃO editáveis aqui

      const inicio = update.data_inicio_contrato ?? atual.data_inicio_contrato;
      const termino = update.data_termino_contrato ?? atual.data_termino_contrato;
      if (termino && inicio && termino <= inicio) {
        return jsonResponse({ codigo: "data_termino_invalida", mensagem: "Data de término deve ser posterior à data de início." }, 400);
      }

      if (Object.keys(update).length === 0) {
        return jsonResponse({ status: "nada_a_alterar" });
      }

      const { error: errUpd } = await admin
        .from("contratantes")
        .update(update)
        .eq("id", contratante_id);
      if (errUpd) {
        console.error("Erro editar contratante:", errUpd);
        return jsonResponse({ error: "Erro ao editar." }, 500);
      }
      await inserirAuditoria(
        admin, callerUserId, callerEmail, "editar_contratante",
        update.contato_email ?? "", update.nome ?? "", null,
        { contratante_id, campos: Object.keys(update) },
      );
      return jsonResponse({ status: "editado" });
    }

    // ============= encerrar_contratante =============
    if (acao === "encerrar_contratante") {
      const contratante_id = String(body.contratante_id ?? "").trim();
      const modo = String(body.modo ?? "preview");
      const motivo = body.motivo ?? null;

      if (!contratante_id) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }

      const { data: cont } = await admin
        .from("contratantes")
        .select("id, nome, status")
        .eq("id", contratante_id)
        .maybeSingle();
      if (!cont) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }

      // Coleta unidades + profissionais afetados
      const { data: uniRows } = await admin
        .from("unidades")
        .select("id, nome, ativa")
        .eq("contratante_id", contratante_id);
      const uniIds = (uniRows ?? []).map((u) => u.id);

      const { data: profRows } = await admin
        .from("profissionais")
        .select("id, user_id, nome, acesso_revogado")
        .in("unidade_id", uniIds.length ? uniIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("acesso_revogado", false);

      if (modo === "preview") {
        return jsonResponse({
          status: "preview",
          contratante_nome: cont.nome,
          contratante_status_atual: cont.status,
          unidades_count: uniIds.length,
          profissionais_a_revogar_count: (profRows ?? []).length,
          unidades: (uniRows ?? []).map((u) => ({ id: u.id, nome: u.nome })),
        });
      }

      if (modo !== "confirmar") {
        return jsonResponse({ error: "modo deve ser 'preview' ou 'confirmar'." }, 400);
      }
      if (cont.status !== "ativo") {
        return jsonResponse({ codigo: "contratante_encerrado", mensagem: "Contratante já está encerrado." }, 400);
      }

      const REVOG_MARKER = `encerramento_contratante:${contratante_id}`;
      const profIds = (profRows ?? []).map((p) => p.id);
      const profUserIds = (profRows ?? []).map((p) => p.user_id).filter(Boolean);

      // Atualiza contratante
      await admin
        .from("contratantes")
        .update({
          status: "encerrado",
          encerrado_em: new Date().toISOString(),
          encerrado_por: callerUserId,
          motivo_encerramento: motivo,
        })
        .eq("id", contratante_id);

      // Desativa unidades
      if (uniIds.length > 0) {
        await admin.from("unidades").update({ ativa: false }).in("id", uniIds);
      }

      // Revoga acesso dos profissionais (com marcador para reativação seletiva)
      if (profIds.length > 0) {
        await admin.from("profissionais").update({
          acesso_revogado: true,
          acesso_revogado_em: new Date().toISOString(),
          acesso_revogado_por: callerUserId,
          motivo_revogacao: REVOG_MARKER,
        }).in("id", profIds);

        for (const uid of profUserIds) {
          await admin.auth.admin.signOut(uid, "global").catch(() => {});
        }
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail, "encerrar_contratante",
        "", cont.nome, null,
        {
          contratante_id,
          unidades_marcadas_count: uniIds.length,
          profissionais_revogados_count: profIds.length,
          motivo,
        },
      );

      return jsonResponse({
        status: "encerrado",
        profissionais_revogados_count: profIds.length,
        unidades_marcadas_count: uniIds.length,
      });
    }

    // ============= reativar_contratante =============
    if (acao === "reativar_contratante") {
      const contratante_id = String(body.contratante_id ?? "").trim();
      if (!contratante_id) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }
      const { data: cont } = await admin
        .from("contratantes")
        .select("id, nome, status")
        .eq("id", contratante_id)
        .maybeSingle();
      if (!cont) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante não encontrado." }, 400);
      }
      if (cont.status === "ativo") {
        return jsonResponse({ error: "Contratante já está ativo." }, 400);
      }

      const REVOG_MARKER = `encerramento_contratante:${contratante_id}`;

      await admin
        .from("contratantes")
        .update({
          status: "ativo",
          encerrado_em: null,
          encerrado_por: null,
          motivo_encerramento: null,
        })
        .eq("id", contratante_id);

      const { data: uniRows } = await admin
        .from("unidades")
        .select("id")
        .eq("contratante_id", contratante_id);
      const uniIds = (uniRows ?? []).map((u) => u.id);
      if (uniIds.length > 0) {
        await admin.from("unidades").update({ ativa: true }).in("id", uniIds);
      }

      // Reativar APENAS profissionais cujo motivo_revogacao bate com este encerramento
      const { data: profRows } = await admin
        .from("profissionais")
        .select("id")
        .in("unidade_id", uniIds.length ? uniIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("motivo_revogacao", REVOG_MARKER);
      const profIds = (profRows ?? []).map((p) => p.id);
      if (profIds.length > 0) {
        await admin.from("profissionais").update({
          acesso_revogado: false,
          acesso_revogado_em: null,
          acesso_revogado_por: null,
          motivo_revogacao: null,
        }).in("id", profIds);
      }

      await inserirAuditoria(
        admin, callerUserId, callerEmail, "reativar_contratante",
        "", cont.nome, null,
        { contratante_id, profissionais_restaurados_count: profIds.length, unidades_reativadas_count: uniIds.length },
      );

      return jsonResponse({
        status: "reativado",
        profissionais_restaurados_count: profIds.length,
      });
    }

    // ============= transferir_unidade_de_contratante =============
    if (acao === "transferir_unidade_de_contratante") {
      const unidade_id = String(body.unidade_id ?? "").trim();
      const contratante_destino_id = String(body.contratante_destino_id ?? "").trim();
      const justificativa = String(body.justificativa ?? "").trim();

      if (!unidade_id || !contratante_destino_id) {
        return jsonResponse({ error: "unidade_id e contratante_destino_id obrigatórios." }, 400);
      }
      if (justificativa.length < 20) {
        return jsonResponse({ codigo: "justificativa_curta", mensagem: "Justificativa deve ter pelo menos 20 caracteres." }, 400);
      }

      const { data: unidade } = await admin
        .from("unidades")
        .select("id, nome, contratante_id, contratantes(id, nome)")
        .eq("id", unidade_id)
        .maybeSingle();
      if (!unidade) {
        return jsonResponse({ error: "Unidade não encontrada." }, 404);
      }

      if (unidade.contratante_id === contratante_destino_id) {
        return jsonResponse({ codigo: "contratante_destino_igual_origem", mensagem: "Contratante destino é igual ao atual." }, 400);
      }

      const { data: destino } = await admin
        .from("contratantes")
        .select("id, nome, status")
        .eq("id", contratante_destino_id)
        .maybeSingle();
      if (!destino) {
        return jsonResponse({ codigo: "contratante_inexistente", mensagem: "Contratante destino não encontrado." }, 400);
      }
      if (destino.status !== "ativo") {
        return jsonResponse({ codigo: "contratante_destino_inativo", mensagem: "Contratante destino está encerrado." }, 400);
      }

      const origemNome = (unidade as any).contratantes?.nome ?? null;

      // Log primeiro (auditoria imutável), depois UPDATE
      await admin.from("log_transferencia_unidade").insert({
        unidade_id,
        contratante_origem_id: unidade.contratante_id,
        contratante_destino_id,
        justificativa,
        transferido_por: callerUserId,
        contratante_origem_nome_snapshot: origemNome,
        contratante_destino_nome_snapshot: destino.nome,
      });

      await admin
        .from("unidades")
        .update({ contratante_id: contratante_destino_id })
        .eq("id", unidade_id);

      await inserirAuditoria(
        admin, callerUserId, callerEmail, "transferir_unidade_de_contratante",
        "", unidade.nome, null,
        { unidade_id, contratante_origem_id: unidade.contratante_id, contratante_destino_id },
      );

      return jsonResponse({
        status: "transferido",
        unidade_nome: unidade.nome,
        contratante_origem_nome: origemNome,
        contratante_destino_nome: destino.nome,
      });
    }

    return jsonResponse({ error: "Ação não reconhecida." }, 400);
  } catch (e) {
    console.error("Falha inesperada:", e);
    return jsonResponse({ error: "Erro inesperado." }, 500);
  }
});

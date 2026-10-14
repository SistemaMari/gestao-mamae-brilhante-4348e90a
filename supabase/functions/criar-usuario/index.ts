// Edge function admin-only: cria conta de usuário SEM senha e envia
// e-mail de convite direto via sendLovableEmail (sem depender do auth hook ou pg_cron).
//
// Suporta criação individual e em lote. Retorna por item: { ok, email, motivo? }
//
// Regras da hierarquia (15/out/2026): uma conta = um papel (e-mail já cadastrado
// é recusado, nunca apagado/sobrescrito — exceto reenvio do convite para a mesma
// conta e papel que ainda não entrou); unidade ativa de rede não encerrada; no
// máximo 1 gestor ativo por unidade; gestor geral ligado à REDE da unidade.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Perfil =
  | "admin"
  | "consultorio"
  | "institucional"
  | "gestor"
  | "gestor_geral";

interface ItemEntrada {
  nome: string;
  email: string;
  perfil: Perfil;
  // só p/ médicos / gestor / gestor_geral
  plano_slug?: string | null;
  unidade_id?: string | null;
}

interface Resultado {
  email: string;
  ok: boolean;
  motivo?: string;
  user_id?: string;
  action_link?: string;
}

const PERFIS_VALIDOS: Perfil[] = [
  "admin",
  "consultorio",
  "institucional",
  "gestor",
  "gestor_geral",
];

function validar(item: ItemEntrada): string | null {
  if (!item?.nome || typeof item.nome !== "string" || !item.nome.trim()) {
    return "Nome obrigatório.";
  }
  if (!item?.email || typeof item.email !== "string") return "E-mail obrigatório.";
  const email = item.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return "E-mail inválido.";
  }
  if (!PERFIS_VALIDOS.includes(item.perfil)) return "Perfil inválido.";
  if (
    ["consultorio", "institucional", "gestor"].includes(item.perfil) &&
    item.perfil !== "consultorio" &&
    !item.unidade_id
  ) {
    return "Unidade obrigatória para esse perfil.";
  }
  return null;
}

const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: "admin",
  consultorio: "profissional de consultório",
  institucional: "profissional de unidade",
  gestor: "gestor de unidade",
  gestor_geral: "gestor geral",
};

// Papéis que a conta já tem no MARI (uma pessoa = um papel; ver auditoria da hierarquia).
// deno-lint-ignore no-explicit-any
async function papeisDoUsuario(sb: any, userId: string) {
  const [a, g, p] = await Promise.all([
    sb.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    sb.from("gestores_gerais").select("id").eq("user_id", userId).maybeSingle(),
    sb.from("profissionais").select("id, unidade_id, perfil_institucional").eq("user_id", userId).maybeSingle(),
  ]);
  const papeis: Array<{ perfil: Perfil; unidade_id: string | null }> = [];
  if (a.data) papeis.push({ perfil: "admin", unidade_id: null });
  if (g.data) papeis.push({ perfil: "gestor_geral", unidade_id: null });
  if (p.data) {
    papeis.push({
      perfil: (p.data.perfil_institucional ?? "consultorio") as Perfil,
      unidade_id: p.data.unidade_id ?? null,
    });
  }
  return papeis;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) auth: precisa ser admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const tokenJWT = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await supabaseUser.auth.getClaims(tokenJWT);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const callerUserId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // checa se chamador é admin
    const { data: adminRow } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!adminRow) {
      return json({ status: "erro", mensagem: "Apenas admins podem criar usuários." }, 403);
    }

    // 2) parse body
    const body = await req.json().catch(() => ({}));
    const itens: ItemEntrada[] = Array.isArray(body?.itens)
      ? body.itens
      : body?.item
      ? [body.item]
      : [];
    if (itens.length === 0) {
      return json({ status: "erro", mensagem: "Nenhum item para criar." }, 400);
    }
    if (itens.length > 50) {
      return json({ status: "erro", mensagem: "Máximo 50 por lote." }, 400);
    }

    // 3) carrega usuários auth uma vez (paginado simples)
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailToUserId = new Map<string, string>();
    for (const u of authList?.users ?? []) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
    }

    // 4) carrega plano_id por slug
    const { data: planos } = await supabaseAdmin.from("planos").select("id, slug");
    const planoSlugToId = new Map<string, string>();
    for (const p of planos ?? []) planoSlugToId.set(p.slug, p.id);

    const resultados: Resultado[] = [];

    const projectAppUrl =
      (body?.app_url as string | undefined) || "https://maridmg.com.br";
    const redirectFinal = `${projectAppUrl}/nova-senha`;

    for (const itemRaw of itens) {
      const item: ItemEntrada = {
        nome: (itemRaw.nome ?? "").trim(),
        email: (itemRaw.email ?? "").trim().toLowerCase(),
        perfil: itemRaw.perfil,
        plano_slug: itemRaw.plano_slug ?? null,
        unidade_id: itemRaw.unidade_id ?? null,
      };
      // Consultório e admin não têm unidade (antes a unidade ia junto e a conta
      // ficava "com unidade mas sem perfil institucional").
      if (item.perfil === "consultorio" || item.perfil === "admin") item.unidade_id = null;
      const erroValid = validar(item);
      if (erroValid) {
        resultados.push({ email: item.email, ok: false, motivo: erroValid });
        continue;
      }

      try {
        const falhar = (motivo: string) => resultados.push({ email: item.email, ok: false, motivo });

        // Unidade: precisa existir, estar ativa e a rede não pode estar encerrada.
        // deno-lint-ignore no-explicit-any
        let unidade: any = null;
        if (item.unidade_id) {
          const { data: u } = await supabaseAdmin
            .from("unidades")
            .select("id, nome, ativa, contratante_id, contratantes(nome, status)")
            .eq("id", item.unidade_id)
            .maybeSingle();
          if (!u) { falhar("Unidade não encontrada."); continue; }
          if (u.ativa === false) { falhar(`A unidade ${u.nome} está inativa.`); continue; }
          if (!u.contratante_id) { falhar(`A unidade ${u.nome} não está ligada a nenhuma rede.`); continue; }
          // deno-lint-ignore no-explicit-any
          if ((u as any).contratantes?.status === "encerrado") {
            falhar(`A rede da unidade ${u.nome} está encerrada.`);
            continue;
          }
          unidade = u;
        }

        // Gestor de unidade: no máximo um gestor ativo por unidade.
        if (item.perfil === "gestor") {
          const { data: atual } = await supabaseAdmin
            .from("profissionais")
            .select("id, nome")
            .eq("unidade_id", item.unidade_id!)
            .eq("perfil_institucional", "gestor")
            .eq("acesso_revogado", false)
            .limit(1)
            .maybeSingle();
          if (atual) {
            falhar(`A unidade ${unidade?.nome ?? ""} já tem gestor ativo (${atual.nome}). Para trocar, use Institucional → Unidades → trocar gestor.`);
            continue;
          }
        }

        // E-mail já existe? Nunca apaga nem sobrescreve uma conta com papel:
        // antes, conta sem login era APAGADA (com o papel que tinha) e conta com
        // login tinha unidade/papel sobrescritos — uma transferência sem as regras.
        let userId = emailToUserId.get(item.email);
        let criadoAgora = false;
        let soReenviar = false;
        if (userId) {
          const papeis = await papeisDoUsuario(supabaseAdmin, userId);
          if (papeis.length > 0) {
            const jaLogou = authList?.users?.find((u) => u.id === userId)?.last_sign_in_at != null;
            const mesmoPapel =
              papeis.length === 1 &&
              papeis[0].perfil === item.perfil &&
              (item.perfil === "gestor_geral" || papeis[0].unidade_id === item.unidade_id);
            if (mesmoPapel && !jaLogou) {
              soReenviar = true; // mesma conta, mesmo papel, nunca entrou: só reenvia o convite
            } else {
              const rotulos = papeis.map((p) => ROTULO_PERFIL[p.perfil] ?? p.perfil).join(" e ");
              falhar(`Este e-mail já tem acesso ao MARI como ${rotulos}. Para mudar de unidade ou de papel, use as telas de Institucional (transferir profissional / trocar gestor).`);
              continue;
            }
          }
          // Conta sem nenhum papel: reaproveita (cria o papel abaixo).
        } else {
          // Cria conta confirmada sem senha — o profissional define a senha
          // clicando no link do email de convite que enviamos abaixo.
          const { data: created, error: createErr } =
            await supabaseAdmin.auth.admin.createUser({
              email: item.email,
              email_confirm: true,
              user_metadata: { nome: item.nome },
            });
          if (createErr || !created?.user) {
            falhar(createErr?.message ?? "Falha ao criar usuário.");
            continue;
          }
          userId = created.user.id;
          criadoAgora = true;
        }

        // Cria o papel conforme o perfil, conferindo cada gravação (antes os
        // erros eram ignorados e a tela dizia "conta criada" mesmo sem papel).
        let erroPapel: string | null = null;
        if (item.perfil === "admin") {
          if (!soReenviar) {
            const { error } = await supabaseAdmin
              .from("admins")
              .upsert({ user_id: userId, nome: item.nome }, { onConflict: "user_id" });
            if (error) erroPapel = error.message;
          }
        } else if (item.perfil === "gestor_geral") {
          if (!soReenviar) {
            const { error } = await supabaseAdmin
              .from("gestores_gerais")
              .upsert({ user_id: userId, nome: item.nome }, { onConflict: "user_id" });
            if (error) erroPapel = error.message;
          }
          // O gestor geral é ligado à REDE da unidade escolhida (os gatilhos dão
          // acesso a todas as unidades dela). Antes ligava só a unidade, direto,
          // fora do vínculo com a rede.
          if (!erroPapel && unidade?.contratante_id) {
            const { data: gg } = await supabaseAdmin
              .from("gestores_gerais").select("id").eq("user_id", userId).maybeSingle();
            if (!gg?.id) {
              erroPapel = "gestor geral não encontrado após a criação.";
            } else {
              const { error } = await supabaseAdmin
                .from("gestores_gerais_contratantes")
                .upsert(
                  { gestor_geral_id: gg.id, contratante_id: unidade.contratante_id },
                  { onConflict: "gestor_geral_id,contratante_id", ignoreDuplicates: true },
                );
              if (error) erroPapel = error.message;
            }
          }
        } else if (!soReenviar) {
          // consultorio | institucional | gestor → tabela profissionais
          const planoSlug = item.plano_slug || "inicial";
          const planoId = planoSlugToId.get(planoSlug);
          const perfilInst =
            item.perfil === "consultorio" ? null : item.perfil; // 'gestor' | 'institucional'
          const { error } = await supabaseAdmin.from("profissionais").insert({
            user_id: userId,
            nome: item.nome,
            perfil_institucional: perfilInst,
            unidade_id: item.unidade_id ?? null,
            plano_id: planoId,
          });
          if (error) {
            erroPapel = error.code === "23505" && item.perfil === "gestor"
              ? "a unidade já tem gestor ativo. Para trocar, use Institucional → Unidades → trocar gestor."
              : error.message;
          }
        }
        if (erroPapel) {
          // Não deixa conta "solta", sem papel.
          if (criadoAgora && userId) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
          falhar(`Não foi possível criar o acesso: ${erroPapel}`);
          continue;
        }

        // Gera link de definição de senha e envia email de convite diretamente.
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: item.email,
          options: { redirectTo: redirectFinal },
        });
        const actionLink = linkData?.properties?.action_link;

        if (actionLink) {
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableApiKey) {
            const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#fff;padding:32px;color:#1e293b;">
  <p style="font-size:14px;font-weight:bold;color:#9b87f5;letter-spacing:2px;margin:0 0 24px;">MARI</p>
  <h2 style="font-family:Sora,Arial,sans-serif;font-size:22px;margin:0 0 20px;">Você foi convidado(a)</h2>
  <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">
    Você recebeu um convite para acessar o <strong>MARI | Inteligência Clínica</strong>.
    Clique no botão abaixo para criar sua senha e acessar o sistema.
  </p>
  <a href="${actionLink}" style="display:inline-block;background:#9b87f5;color:#fff;font-size:14px;font-weight:bold;border-radius:12px;padding:12px 24px;text-decoration:none;">
    Criar minha senha
  </a>
  <p style="font-size:12px;color:#94a3b8;margin:32px 0 0;line-height:1.5;">
    Se você não estava esperando este convite, pode ignorar este e-mail com segurança.
  </p>
</body></html>`;
            const textBody = `Você foi convidado(a) para o MARI | Inteligência Clínica.\n\nCrie sua senha acessando:\n${actionLink}`;

            try {
              await sendLovableEmail(
                {
                  message_id: crypto.randomUUID(),
                  to: item.email,
                  from: "Mari's Health Companion <noreply@notify.maridmg.com.br>",
                  sender_domain: "notify.maridmg.com.br",
                  subject: "Seu convite para o MARI | Inteligência Clínica",
                  html: htmlBody,
                  text: textBody,
                  purpose: "transactional",
                  label: "admin_invite",
                },
                { apiKey: lovableApiKey },
              );
              console.log(`[criar-usuario] convite enviado para ${item.email}`);
            } catch (emailErr) {
              console.error(`[criar-usuario] falha ao enviar email para ${item.email}:`, emailErr);
            }
          }
        }

        resultados.push({
          email: item.email,
          ok: true,
          user_id: userId,
        });
      } catch (err) {
        resultados.push({
          email: item.email,
          ok: false,
          motivo: err instanceof Error ? err.message : "Erro desconhecido.",
        });
      }
    }

    return json({ status: "ok", resultados });
  } catch (err) {
    console.error("[criar-usuario] erro:", err);
    return json(
      { status: "erro", mensagem: "Erro interno. Tente novamente." },
      500
    );
  }
});

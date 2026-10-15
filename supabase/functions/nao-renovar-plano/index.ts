// "Não quero renovar" do plano de consultório (Meu perfil → Meu plano).
//
// A MARI é anuidade e não renova sozinha; não há nada a cancelar no Asaas (a
// compra pelo link é única: Pix à vista ou cartão parcelado). O pedido:
//   - fica registrado em pedidos_nao_renovacao (mês de uso, motivo, 7 dias);
//   - NÃO corta o acesso: vale até o fim do ano pago (ciclo_fim);
//   - manda e-mail de confirmação para a profissional e aviso para a equipe.
// Se ela renovar depois, o webhook do Asaas encerra o pedido ('renovou').
//
// Body: { acao: 'nao_renovar', motivo?, comentario? } | { acao: 'desfazer' }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  fimDoCiclo, inicioDoCiclo, mesDeUso, dentroDaGarantia,
} from "../_shared/renovacao.ts";
import { enviarEmailDeModelo } from "../_shared/emailModelo.ts";
import { template as renovacaoCancelada } from "../_shared/transactional-email-templates/renovacao-cancelada.tsx";
import { template as naoRenovacaoEquipe } from "../_shared/transactional-email-templates/nao-renovacao-equipe.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MOTIVOS: Record<string, string> = {
  nao_uso: "Não estou usando",
  preco: "Preço",
  dificil: "Achei difícil de usar",
  falta_funcao: "Falta alguma função",
  mudanca: "Mudança de trabalho / parei de atender gestantes",
  outro: "Outro",
};

const fmtData = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const EMAIL_EQUIPE = Deno.env.get("EMAIL_SUPORTE") || "SuporteMari@novodmg.com.br";
  const APP_URL = Deno.env.get("APP_PUBLIC_URL") ?? "https://maridmg.com.br";

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const user = userData.user;

  let body: { acao?: string; motivo?: string; comentario?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const acao = body.acao ?? "nao_renovar";

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: prof, error: profErr } = await supabase
    .from("profissionais")
    .select(`id, nome, telefone, plano_id, plano_status, unidade_id, perfil_institucional,
             data_inicio_assinatura, proxima_renovacao, asaas_subscription_id,
             planos:plano_id ( nome )`)
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return json({ error: "Falha ao ler a conta." }, 500);
  // Só consultório: a conta institucional é contratada pela rede.
  if (!prof || prof.unidade_id || prof.perfil_institucional) {
    return json({ error: "Esta conta não tem plano de consultório." }, 400);
  }

  const { data: aberto } = await supabase
    .from("pedidos_nao_renovacao")
    .select("id")
    .eq("profissional_id", prof.id)
    .is("desfeito_em", null)
    .maybeSingle();

  if (acao === "desfazer") {
    if (aberto) {
      const { error } = await supabase
        .from("pedidos_nao_renovacao")
        .update({ desfeito_em: new Date().toISOString(), desfeito_motivo: "desistiu" })
        .eq("id", aberto.id);
      if (error) return json({ error: "Falha ao desfazer o pedido." }, 500);
    }
    return json({ status: "ok" });
  }

  if (acao !== "nao_renovar") return json({ error: "Ação inválida." }, 400);
  if (aberto) return json({ status: "ja_pedido", pedido_id: aberto.id });

  const agora = new Date();
  const fim = fimDoCiclo(prof);
  const inicio = inicioDoCiclo(prof);
  if (!fim || fim.getTime() < agora.getTime()) {
    return json({ error: "Seu plano já venceu: não há renovação para cancelar." }, 400);
  }
  const mes = mesDeUso(prof, agora);
  const garantia = dentroDaGarantia(prof, agora);
  const motivoTexto = body.motivo ? (MOTIVOS[body.motivo] ?? null) : null;
  const comentario = (body.comentario ?? "").trim().slice(0, 1000) || null;
  // deno-lint-ignore no-explicit-any
  const planoNome = (prof as any).planos?.nome ?? null;

  const { data: pedido, error: insErr } = await supabase
    .from("pedidos_nao_renovacao")
    .insert({
      profissional_id: prof.id,
      user_id: user.id,
      nome: prof.nome,
      email: user.email,
      plano_id: prof.plano_id,
      plano_nome: planoNome,
      ciclo_inicio: inicio?.toISOString() ?? null,
      ciclo_fim: fim.toISOString(),
      mes_de_uso: mes,
      dentro_garantia: garantia,
      motivo: motivoTexto,
      comentario,
    })
    .select("id")
    .single();
  if (insErr || !pedido) {
    console.error("[nao-renovar-plano] insert:", insErr?.message);
    return json({ error: "Falha ao registrar o pedido." }, 500);
  }

  // E-mails: best-effort (o pedido já está gravado e aparece no admin).
  const errosEmail: string[] = [];
  if (user.email) {
    const e1 = await enviarEmailDeModelo(supabase, {
      modelo: renovacaoCancelada,
      nomeModelo: "renovacao-cancelada",
      para: user.email,
      idempotencyKey: `renovacao-cancelada-${pedido.id}`,
      props: {
        nomeProfissional: prof.nome,
        nomePlano: planoNome ?? "MARI",
        acessoAteFormatado: fmtData(fim),
        pedidoEmFormatado: fmtData(agora),
        dentroGarantia: garantia,
        linkRenovar: `${APP_URL}/perfil`,
        emailSuporte: EMAIL_EQUIPE,
      },
    });
    if (e1) errosEmail.push(e1);
  }
  const e2 = await enviarEmailDeModelo(supabase, {
    modelo: naoRenovacaoEquipe,
    nomeModelo: "nao-renovacao-equipe",
    para: EMAIL_EQUIPE,
    idempotencyKey: `nao-renovacao-equipe-${pedido.id}`,
    props: {
      nomeProfissional: prof.nome,
      emailProfissional: user.email,
      telefone: prof.telefone,
      nomePlano: planoNome,
      mesDeUso: mes,
      acessoAteFormatado: fmtData(fim),
      motivo: motivoTexto,
      comentario,
      dentroGarantia: garantia,
    },
  });
  if (e2) errosEmail.push(e2);
  if (errosEmail.length) console.error("[nao-renovar-plano] e-mail:", errosEmail.join(" | "));

  return json({
    status: "ok",
    pedido_id: pedido.id,
    acesso_ate: fim.toISOString(),
    dentro_garantia: garantia,
    email_enviado: errosEmail.length === 0,
  });
});

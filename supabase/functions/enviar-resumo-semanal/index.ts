// Edge Function: enviar-resumo-semanal
// Disparada por pg_cron toda segunda às 10:00 UTC (07:00 em Brasília) — o SQL
// do agendamento está no cabeçalho da migration 20261015150000_resumo_semanal_email.
//
// Gestor de unidade: "Resumo da semana — <unidade>" (pendências de hoje +
// laudos e gestantes novas da semana anterior). Gestor geral: um e-mail com
// uma linha por unidade das redes dele (redes encerradas ficam de fora).
// Conteúdo montado em ../_shared/resumoSemanal.ts; números vindos de
// resumo_semanal_destinatarios (SQL). Entrega pela fila transacional
// (mesma do convite/e-mail de acesso) — o process-email-queue envia.
//
// Só aceita a service role (cron/admin), como gerar-relatorios-mensais.
// Corpo (todos opcionais):
//   { "dry_run": true }                → devolve o que enviaria, sem enviar nada
//   { "somente_email": "x@y.com" }     → envia SÓ para esse destinatário, como
//                                        teste: assunto com "[Teste]", ignora a
//                                        regra "nada a relatar" e o registro da
//                                        semana (o envio de segunda continua valendo)
//   { "semana": "2026-10-19" }         → segunda-feira de referência (padrão: a
//                                        semana atual em Brasília)
// Nunca envia para a rede de demonstração (domínio/CNPJ de _shared/redeDemo.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { enfileirarEmailTransacional } from "../_shared/emailTransacional.ts";
import { CONTRATANTE as CONTRATANTE_DEMO, DOMINIO_EMAIL as DOMINIO_DEMO } from "../_shared/redeDemo.ts";
import {
  deveEnviarGestorGeral,
  ehEmailDemo,
  ehSegunda,
  type EmailMontado,
  montarEmailGestor,
  montarEmailGestorGeral,
  type NumerosUnidade,
  semanaDoEnvio,
  temAlgoARelatar,
} from "../_shared/resumoSemanal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Papel = "gestor" | "gestor_geral";

interface Destinatario {
  papel: Papel;
  user_id: string;
  nome: string | null;
  email: string;
  ja_enviado: boolean;
  /** Há pendência ou atividade para contar? */
  tem_conteudo: boolean;
  email_montado: EmailMontado;
}

interface RespostaSql {
  semana: string;
  gestores: Array<{
    user_id: string; nome: string | null; email: string; ja_enviado: boolean; unidade: NumerosUnidade;
  }>;
  gestores_gerais: Array<{
    user_id: string; nome: string | null; email: string; ja_enviado: boolean; unidades: NumerosUnidade[];
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const somenteEmail = typeof body?.somente_email === "string" && body.somente_email.trim()
    ? body.somente_email.trim().toLowerCase()
    : null;
  let semana: string;
  if (typeof body?.semana === "string" && body.semana) {
    if (!ehSegunda(body.semana)) {
      return json({ status: "erro", mensagem: "semana deve ser uma segunda-feira no formato AAAA-MM-DD." }, 400);
    }
    semana = body.semana;
  } else {
    semana = semanaDoEnvio(new Date());
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const appUrl = (Deno.env.get("APP_PUBLIC_URL") ?? "https://maridmg.com.br").replace(/\/+$/, "");

  const { data, error } = await admin.rpc("resumo_semanal_destinatarios", {
    p_semana: semana,
    p_dominio_excluido: DOMINIO_DEMO,
    p_cnpj_excluido: CONTRATANTE_DEMO.cnpj,
  });
  if (error || !data) {
    console.error("[enviar-resumo-semanal] falha ao montar destinatários:", error);
    return json({ status: "erro", mensagem: "Falha ao buscar os destinatários.", detalhe: error?.message ?? null }, 500);
  }
  const dados = data as RespostaSql;

  const destinatarios: Destinatario[] = [];
  for (const g of dados.gestores ?? []) {
    destinatarios.push({
      papel: "gestor",
      user_id: g.user_id,
      nome: g.nome,
      email: g.email,
      ja_enviado: g.ja_enviado,
      tem_conteudo: temAlgoARelatar(g.unidade),
      email_montado: montarEmailGestor({
        nome: g.nome,
        unidade: g.unidade,
        semana,
        links: { painel: `${appUrl}/gestao`, configuracoes: `${appUrl}/gestao/configuracoes` },
      }),
    });
  }
  for (const gg of dados.gestores_gerais ?? []) {
    destinatarios.push({
      papel: "gestor_geral",
      user_id: gg.user_id,
      nome: gg.nome,
      email: gg.email,
      ja_enviado: gg.ja_enviado,
      tem_conteudo: deveEnviarGestorGeral(gg.unidades),
      email_montado: montarEmailGestorGeral({
        nome: gg.nome,
        unidades: gg.unidades,
        semana,
        links: { painel: `${appUrl}/consolidar/visao-geral`, configuracoes: `${appUrl}/consolidar/configuracoes` },
      }),
    });
  }

  // Defesa extra: o SQL já tira a rede de demonstração.
  const lista = destinatarios
    .filter((d) => !ehEmailDemo(d.email, DOMINIO_DEMO))
    .filter((d) => !somenteEmail || d.email === somenteEmail);

  if (somenteEmail && lista.length === 0) {
    return json({
      status: "erro",
      mensagem: "Esse e-mail não é destinatário do resumo (não é gestor ativo, desligou o resumo, unidade inativa, rede encerrada ou conta de demonstração).",
    }, 404);
  }

  const motivo = (d: Destinatario): string | null => {
    if (somenteEmail) return null; // teste: sempre envia
    if (d.ja_enviado) return "ja_enviado_nesta_semana";
    if (!d.tem_conteudo) return "nada_a_relatar";
    return null;
  };

  if (dryRun) {
    return json({
      status: "dry_run",
      semana,
      total: lista.length,
      enviaria: lista.filter((d) => motivo(d) === null).length,
      destinatarios: lista.map((d) => ({
        papel: d.papel,
        nome: d.nome,
        email: d.email,
        enviaria: motivo(d) === null,
        motivo_pular: motivo(d),
        subject: (somenteEmail ? "[Teste] " : "") + d.email_montado.subject,
        text: d.email_montado.text,
        html: d.email_montado.html,
      })),
    });
  }

  const resultado = {
    enviados: [] as Array<{ papel: Papel; email: string }>,
    pulados: [] as Array<{ papel: Papel; email: string; motivo: string }>,
    falhas: [] as Array<{ papel: Papel; email: string; erro: string }>,
  };

  for (const d of lista) {
    const m = motivo(d);
    if (m) {
      resultado.pulados.push({ papel: d.papel, email: d.email, motivo: m });
      continue;
    }

    let registroId: string | null = null;
    if (!somenteEmail) {
      // Registra ANTES de enfileirar: o unique (user_id, papel, semana) impede
      // um 2º envio mesmo com duas execuções simultâneas.
      const { data: reg, error: regErr } = await admin
        .from("resumo_semanal_envios")
        .upsert(
          { user_id: d.user_id, papel: d.papel, semana, email: d.email },
          { onConflict: "user_id,papel,semana", ignoreDuplicates: true },
        )
        .select("id");
      if (regErr) {
        resultado.falhas.push({ papel: d.papel, email: d.email, erro: `Falha ao registrar envio: ${regErr.message}` });
        continue;
      }
      if (!reg || reg.length === 0) {
        resultado.pulados.push({ papel: d.papel, email: d.email, motivo: "ja_enviado_nesta_semana" });
        continue;
      }
      registroId = reg[0].id;
    }

    const erro = await enfileirarEmailTransacional(admin, {
      to: d.email,
      subject: (somenteEmail ? "[Teste] " : "") + d.email_montado.subject,
      html: d.email_montado.html,
      text: d.email_montado.text,
      templateName: "resumo_semanal",
      label: "resumo_semanal",
      idempotencyKey: somenteEmail
        ? `resumo-semanal-teste-${d.papel}-${d.user_id}-${Date.now()}`
        : `resumo-semanal-${d.papel}-${d.user_id}-${semana}`,
    });

    if (erro) {
      // Desfaz o registro para a próxima execução tentar de novo.
      if (registroId) await admin.from("resumo_semanal_envios").delete().eq("id", registroId);
      resultado.falhas.push({ papel: d.papel, email: d.email, erro });
      continue;
    }
    resultado.enviados.push({ papel: d.papel, email: d.email });
  }

  console.log(
    `[enviar-resumo-semanal] semana ${semana}: ${resultado.enviados.length} enviado(s), ` +
      `${resultado.pulados.length} pulado(s), ${resultado.falhas.length} falha(s)`,
  );
  return json({ status: "ok", semana, teste: !!somenteEmail, ...resultado });
});

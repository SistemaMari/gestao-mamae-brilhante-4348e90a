// Webhook do Asaas: recebe eventos de pagamento e provisiona conta no Supabase.
// Endpoint público (verify_jwt=false). Autenticação via header "asaas-access-token".
//
// Eventos tratados:
// - PAYMENT_CONFIRMED / PAYMENT_RECEIVED (1ª fatura) → cria user + profissional + envia recovery link
// - PAYMENT_RECEIVED (renovações) → atualiza proxima_renovacao
// - PAYMENT_OVERDUE → marca plano_status = 'inadimplente'
// - SUBSCRIPTION_DELETED → marca plano_status = 'cancelado'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { planoSlugPorValor } from "../_shared/planoPorValor.ts";
import {
  codigoDoLink, slugPorCodigoDeLink, identificarCompra, somarMeses, MESES_COMPRA_ANUAL,
} from "../_shared/compraAsaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Valor da cobrança → slug do plano (aceita preço cheio e preço de lançamento).
// Regra isolada e testada em src/lib/planoPorValor.test.ts.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1) Autenticação do webhook
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const received = req.headers.get("asaas-access-token");
  if (!expected || received !== expected) {
    console.warn("[asaas-webhook] token inválido");
    return json({ error: "Unauthorized" }, 401);
  }

  // 2) Parse payload
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const eventType: string = payload?.event ?? "";
  const eventId: string | null = payload?.id ?? null;
  const payment = payload?.payment ?? {};

  console.log("[asaas-webhook] evento:", eventType, "id:", eventId);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 3) Idempotência: se já processado com sucesso, retorna 200
  if (eventId) {
    const { data: existente } = await supabase
      .from("asaas_webhook_events")
      .select("id, processed_at")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existente?.processed_at) {
      return json({ status: "already_processed" });
    }
  }

  // Registra recebimento (auditoria). Upsert por event_id: retentativas da Asaas reenviam
  // o mesmo event_id, e a coluna tem UNIQUE constraint — um insert simples falharia
  // silenciosamente nessas retentativas, deixando logId indefinido.
  const { data: logRow } = await supabase
    .from("asaas_webhook_events")
    .upsert(
      { event_id: eventId, event_type: eventType, payload },
      { onConflict: "event_id" },
    )
    .select("id")
    .maybeSingle();
  const logId = logRow?.id;

  // Não marca processed_at em erro: mantém o evento retentável pelo retry automático da Asaas.
  const marcarErro = async (msg: string) => {
    if (logId) {
      await supabase
        .from("asaas_webhook_events")
        .update({ error: msg })
        .eq("id", logId);
    }
  };
  const marcarOk = async () => {
    if (logId) {
      await supabase
        .from("asaas_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", logId);
    }
  };

  try {
    // ===== Eventos de pagamento confirmado =====
    if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
      const customerId: string | undefined = payment.customer;
      const subscriptionId: string | null = payment.subscription ?? null;
      const valor: number = Number(payment.value ?? 0);
      const { compraId, anual } = identificarCompra(payment);

      if (!customerId) {
        await marcarErro("payment.customer ausente");
        return json({ error: "Missing customer" }, 400);
      }

      const asaasEnv = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
      const asaasBase = asaasEnv === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3";
      const asaasKey = Deno.env.get("ASAAS_API_KEY");
      if (!asaasKey) {
        await marcarErro("ASAAS_API_KEY não configurado");
        return json({ error: "Missing ASAAS_API_KEY" }, 500);
      }

      // Qual plano? 1º pelo LINK de pagamento (o valor varia com parcelas e juros);
      // na falta dele (mensalidade criada pelo app), pelo valor.
      let slug: string | null = null;
      const paymentLinkId: string | null = payment.paymentLink ?? null;
      if (paymentLinkId) {
        const linkResp = await fetch(`${asaasBase}/paymentLinks/${paymentLinkId}`, {
          headers: { access_token: asaasKey },
        });
        if (linkResp.ok) {
          const link = await linkResp.json();
          const { data: planosLinks } = await supabase
            .from("planos")
            .select("slug, link_pagamento_asaas, links_pagamento_anteriores");
          slug = slugPorCodigoDeLink(codigoDoLink(link?.url), planosLinks ?? []);
          if (!slug) console.warn(`[asaas-webhook] link ${paymentLinkId} (${link?.url}) não cadastrado em nenhum plano`);
        } else {
          console.warn(`[asaas-webhook] falha ao consultar link ${paymentLinkId}: ${linkResp.status}`);
        }
      }
      if (!slug) slug = planoSlugPorValor(valor);
      if (!slug) {
        await marcarErro(`Plano não reconhecido (link ${paymentLinkId ?? "—"}, valor R$${valor})`);
        return json({ error: "Plan not recognized" }, 400);
      }

      // Busca dados do cliente Asaas (e-mail/nome) via API
      const custResp = await fetch(`${asaasBase}/customers/${customerId}`, {
        headers: { access_token: asaasKey },
      });
      if (!custResp.ok) {
        const txt = await custResp.text();
        await marcarErro(`Falha ao buscar cliente Asaas: ${custResp.status} ${txt}`);
        return json({ error: "Failed to fetch customer" }, 502);
      }
      const customer = await custResp.json();
      const email: string | undefined = customer?.email?.toLowerCase().trim();
      const nome: string = customer?.name?.trim() || "Profissional";

      if (!email) {
        await marcarErro("Cliente Asaas sem e-mail");
        return json({ error: "Customer without email" }, 400);
      }

      // Busca plano_id pelo slug
      const { data: plano } = await supabase
        .from("planos")
        .select("id, laudos_por_mes")
        .eq("slug", slug)
        .maybeSingle();
      if (!plano) {
        await marcarErro(`Plano ${slug} não encontrado`);
        return json({ error: "Plan missing in DB" }, 500);
      }

      const camposProf = "id, user_id, data_inicio_assinatura, asaas_subscription_id, asaas_compra_id";

      // Já é cliente? Pelo cliente Asaas e, se não achar, pelo e-mail: quem troca
      // de plano pelo link pode virar um cliente Asaas novo.
      let { data: profExistente } = await supabase
        .from("profissionais")
        .select(camposProf)
        .eq("asaas_customer_id", customerId)
        .maybeSingle();

      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email) ?? null;

      if (!profExistente && authUser) {
        const { data: porUsuario } = await supabase
          .from("profissionais")
          .select(camposProf)
          .eq("user_id", authUser.id)
          .maybeSingle();
        profExistente = porUsuario;
      }

      const agora = new Date();
      const proxRenov = anual ? somarMeses(agora, MESES_COMPRA_ANUAL) : somarMeses(agora, 1);

      if (profExistente && anual) {
        // Outra parcela (ou o "recebido" depois do "confirmado") da MESMA compra:
        // a conta já foi liberada por 12 meses, então não mexe em nada.
        if (compraId && profExistente.asaas_compra_id === compraId) {
          await marcarOk();
          return json({ status: "same_purchase", profissional_id: profExistente.id });
        }

        // Compra anual NOVA (renovação ou troca de plano): começa um ano novo,
        // no plano comprado, a partir de hoje.
        await supabase
          .from("profissionais")
          .update({
            plano_id: plano.id,
            plano_status: "ativo",
            laudos_limite: plano.laudos_por_mes,
            laudos_usados: 0,
            asaas_customer_id: customerId,
            asaas_compra_id: compraId,
            data_inicio_assinatura: agora.toISOString(),
            proxima_renovacao: proxRenov.toISOString(),
            aviso_fim_ciclo_enviado_em: null,
          })
          .eq("id", profExistente.id);

        await marcarOk();
        return json({ status: "renewed_annual", profissional_id: profExistente.id });
      }

      if (profExistente) {
        // ----- RENOVAÇÃO DA MENSALIDADE (assinatura criada pelo app) -----
        // Um asaas_subscription_id diferente do que já estava salvo significa que
        // começou um ciclo anual novo (a assinatura anterior, com maxPayments: 12,
        // encerrou e uma nova foi criada), e não só mais uma das 12 cobranças
        // mensais do mesmo ciclo. Reinicia a contagem do ciclo
        // (data_inicio_assinatura) e destrava o aviso de "plano acabando".
        const novoCicloAnual = profExistente.asaas_subscription_id !== subscriptionId;

        await supabase
          .from("profissionais")
          .update({
            plano_id: plano.id,
            plano_status: "ativo",
            laudos_limite: plano.laudos_por_mes,
            laudos_usados: 0, // reset por aniversário da assinatura
            asaas_subscription_id: subscriptionId,
            asaas_compra_id: compraId,
            proxima_renovacao: proxRenov.toISOString(),
            ...(novoCicloAnual
              ? { data_inicio_assinatura: agora.toISOString(), aviso_fim_ciclo_enviado_em: null }
              : {}),
          })
          .eq("id", profExistente.id);

        await marcarOk();
        return json({ status: "renewed", profissional_id: profExistente.id });
      }

      // ----- PRIMEIRA COMPRA: provisiona conta -----

      let userId: string | null = authUser?.id ?? null;
      if (!userId) {
        const { data: created, error: createErr } = await supabase.auth.admin
          .createUser({
            email,
            email_confirm: true,
            user_metadata: { nome },
          });
        if (createErr || !created?.user) {
          await marcarErro(`Falha ao criar user: ${createErr?.message}`);
          return json({ error: "Failed to create user" }, 500);
        }
        userId = created.user.id;
      }

      // Cria registro em profissionais (consultório, sem unidade)
      const { error: profErr } = await supabase.from("profissionais").insert({
        user_id: userId,
        nome,
        plano_id: plano.id,
        plano_status: "ativo",
        laudos_limite: plano.laudos_por_mes,
        laudos_usados: 0,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        asaas_compra_id: compraId,
        data_inicio_assinatura: agora.toISOString(),
        proxima_renovacao: proxRenov.toISOString(),
      });
      if (profErr) {
        await marcarErro(`Falha ao criar profissional: ${profErr.message}`);
        return json({ error: "Failed to create profissional" }, 500);
      }

      // Gera link de recovery (define senha) — Supabase envia o e-mail padrão
      const redirectTo = `${Deno.env.get("APP_PUBLIC_URL") ?? "https://maridmg.com.br"}/nova-senha`;
      const { error: linkErr } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkErr) {
        // Conta criada, mas falha no e-mail — registra mas não falha o webhook
        console.error("[asaas-webhook] generateLink error:", linkErr.message);
        await marcarErro(`Conta criada, falha no e-mail: ${linkErr.message}`);
        return json({ status: "created_no_email", user_id: userId });
      }

      await marcarOk();
      return json({ status: "provisioned", user_id: userId });
    }

    // ===== Inadimplência =====
    if (eventType === "PAYMENT_OVERDUE") {
      const customerId = payment?.customer;
      // Só a MENSALIDADE (assinatura do app) bloqueia por atraso. Na compra anual
      // pelo link, o acesso vale pela data de validade: um Pix/boleto gerado e não
      // pago (ex.: tentativa de recompra abandonada) não pode bloquear quem já
      // tem o ano pago.
      if (customerId && payment?.subscription) {
        await supabase
          .from("profissionais")
          .update({ plano_status: "inadimplente" })
          .eq("asaas_customer_id", customerId);
      }
      await marcarOk();
      return json({ status: "marked_overdue" });
    }

    // ===== Cancelamento =====
    if (eventType === "SUBSCRIPTION_DELETED") {
      const subId = payload?.subscription?.id ?? payload?.subscription;
      if (subId) {
        await supabase
          .from("profissionais")
          .update({ plano_status: "cancelado" })
          .eq("asaas_subscription_id", subId);
      }
      await marcarOk();
      return json({ status: "subscription_canceled" });
    }

    // Evento ignorado (não tratado, mas confirmado)
    await marcarOk();
    return json({ status: "ignored", event: eventType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[asaas-webhook] erro:", msg);
    await marcarErro(msg);
    return json({ error: "Internal error" }, 500);
  }
});

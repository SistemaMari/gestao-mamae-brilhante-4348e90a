// Webhook do Asaas: recebe eventos de pagamento e provisiona conta no Supabase.
// Endpoint público (verify_jwt=false). Autenticação via header "asaas-access-token".
//
// Eventos tratados:
// - PAYMENT_CONFIRMED / PAYMENT_RECEIVED (1ª fatura) → cria user + profissional + envia recovery link
// - PAYMENT_RECEIVED (renovações) → atualiza proxima_renovacao
// - PAYMENT_OVERDUE → marca plano_status = 'inadimplente'
// - SUBSCRIPTION_DELETED → marca plano_status = 'cancelado'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// Mapeia valor da cobrança → slug do plano. Tolera centavos.
function planoSlugPorValor(valor: number): string | null {
  const v = Math.round(Number(valor));
  if (v === 79) return "inicial";
  if (v === 139) return "intermediaria";
  if (v === 299) return "profissional";
  return null;
}

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

  // Registra recebimento (auditoria)
  const { data: logRow } = await supabase
    .from("asaas_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload,
    })
    .select("id")
    .maybeSingle();
  const logId = logRow?.id;

  const marcarErro = async (msg: string) => {
    if (logId) {
      await supabase
        .from("asaas_webhook_events")
        .update({ error: msg, processed_at: new Date().toISOString() })
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
      const slug = planoSlugPorValor(valor);

      if (!customerId) {
        await marcarErro("payment.customer ausente");
        return json({ error: "Missing customer" }, 400);
      }
      if (!slug) {
        await marcarErro(`Valor R$${valor} não corresponde a nenhum plano`);
        return json({ error: "Plan not recognized" }, 400);
      }

      // Busca dados do cliente Asaas (e-mail/nome) via API
      const asaasEnv = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
      const asaasBase = asaasEnv === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3";
      const asaasKey = Deno.env.get("ASAAS_API_KEY");
      if (!asaasKey) {
        await marcarErro("ASAAS_API_KEY não configurado");
        return json({ error: "Missing ASAAS_API_KEY" }, 500);
      }

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

      // Verifica se já existe profissional por asaas_customer_id (renovação)
      const { data: profExistente } = await supabase
        .from("profissionais")
        .select("id, user_id, data_inicio_assinatura")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();

      const agora = new Date();
      const proxRenov = new Date(agora);
      proxRenov.setMonth(proxRenov.getMonth() + 1);

      if (profExistente) {
        // ----- RENOVAÇÃO -----
        await supabase
          .from("profissionais")
          .update({
            plano: slug,
            plano_id: plano.id,
            plano_status: "ativo",
            laudos_limite: plano.laudos_por_mes,
            laudos_usados: 0, // reset por aniversário da assinatura
            asaas_subscription_id: subscriptionId,
            proxima_renovacao: proxRenov.toISOString(),
          })
          .eq("id", profExistente.id);

        await marcarOk();
        return json({ status: "renewed", profissional_id: profExistente.id });
      }

      // ----- PRIMEIRA FATURA: provisiona conta -----

      // Verifica se já existe user no Auth com esse e-mail
      let userId: string | null = null;
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (found) {
        userId = found.id;
      } else {
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
        plano: slug,
        plano_id: plano.id,
        plano_status: "ativo",
        laudos_limite: plano.laudos_por_mes,
        laudos_usados: 0,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        data_inicio_assinatura: agora.toISOString(),
        proxima_renovacao: proxRenov.toISOString(),
      });
      if (profErr) {
        await marcarErro(`Falha ao criar profissional: ${profErr.message}`);
        return json({ error: "Failed to create profissional" }, 500);
      }

      // Gera link de recovery (define senha) — Supabase envia o e-mail padrão
      const redirectTo = "https://gestao-mamae-brilhante.lovable.app/nova-senha";
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
      if (customerId) {
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

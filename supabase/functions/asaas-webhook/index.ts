// Webhook do Asaas: recebe eventos de pagamento e provisiona conta no Supabase.
// Endpoint público (verify_jwt=false). Autenticação via header "asaas-access-token".
//
// Eventos tratados:
// - PAYMENT_CONFIRMED / PAYMENT_RECEIVED (1ª fatura) → cria user + profissional + envia recovery link
// - PAYMENT_RECEIVED (renovações) → atualiza proxima_renovacao
// - PAYMENT_OVERDUE → marca plano_status = 'inadimplente'
// - PAYMENT_REFUNDED → marca plano_status = 'cancelado' (reembolso corta o acesso)
// - SUBSCRIPTION_DELETED → marca plano_status = 'cancelado'
//
// Respostas: o Asaas entrega os eventos em FILA, em ordem, e pausa a fila depois
// de várias falhas seguidas. Por isso, evento que nunca vai dar certo (cobrança
// que não é da MARI, cliente sem e-mail) responde 200 e fica só registrado com
// erro em asaas_webhook_events. Só falha temporária (API do Asaas, banco,
// configuração) responde 5xx para o Asaas tentar de novo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { planoSlugPorValor } from "../_shared/planoPorValor.ts";
import {
  codigoDoLink, slugPorCodigoDeLink, slugPorValorDaCompraAnual, identificarCompra, somarMeses,
  asaasBaseUrl, MESES_COMPRA_ANUAL,
} from "../_shared/compraAsaas.ts";
import { enviarEmailAcesso } from "../_shared/emailAcesso.ts";

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
  // Evento que não adianta repetir: registra o motivo e responde 200 para não
  // travar a fila do Asaas.
  const ignorar = async (msg: string, status: string) => {
    console.warn("[asaas-webhook] ignorado:", msg);
    await marcarErro(msg);
    return json({ status, motivo: msg });
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
        return await ignorar("payment.customer ausente", "ignored_missing_customer");
      }

      const asaasKey = Deno.env.get("ASAAS_API_KEY");
      if (!asaasKey) {
        await marcarErro("ASAAS_API_KEY não configurado");
        return json({ error: "Missing ASAAS_API_KEY" }, 500);
      }
      const asaasBase = asaasBaseUrl(asaasKey, Deno.env.get("ASAAS_ENV"));

      // "*" e não a lista de colunas: se faltar rodar alguma migration de planos,
      // o webhook continua reconhecendo pelo que existir.
      const { data: planosDb, error: planosErr } = await supabase.from("planos").select("*");
      if (planosErr) {
        await marcarErro(`Falha ao ler planos: ${planosErr.message}`);
        return json({ error: "Failed to read plans" }, 500);
      }

      // Qual plano? 1º pelo LINK de pagamento (o valor varia com parcelas e juros);
      // na falta dele, pelo valor da parcela ou do ano à vista; por fim, pelo valor
      // da mensalidade (assinatura criada pelo app).
      let slug: string | null = null;
      const paymentLinkId: string | null = payment.paymentLink ?? null;
      if (paymentLinkId) {
        const linkResp = await fetch(`${asaasBase}/paymentLinks/${paymentLinkId}`, {
          headers: { access_token: asaasKey },
        });
        if (linkResp.ok) {
          const link = await linkResp.json();
          slug = slugPorCodigoDeLink(codigoDoLink(link?.url), planosDb ?? []);
          if (!slug) console.warn(`[asaas-webhook] link ${paymentLinkId} (${link?.url}) não cadastrado em nenhum plano`);
        } else {
          console.warn(`[asaas-webhook] falha ao consultar link ${paymentLinkId}: ${linkResp.status}`);
        }
      }
      if (!slug && anual) slug = slugPorValorDaCompraAnual(valor, planosDb ?? []);
      if (!slug) slug = planoSlugPorValor(valor);
      if (!slug) {
        // Cobrança que não é de nenhum plano da MARI (ex.: outra cobrança da mesma
        // conta Asaas). Não pode travar a fila.
        return await ignorar(
          `Plano não reconhecido (link ${paymentLinkId ?? "—"}, valor R$${valor})`,
          "ignored_unknown_plan",
        );
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
        return await ignorar("Cliente Asaas sem e-mail", "ignored_customer_without_email");
      }

      const plano = (planosDb ?? []).find((p: any) => p.slug === slug);
      if (!plano) {
        await marcarErro(`Plano ${slug} não encontrado`);
        return json({ error: "Plan missing in DB" }, 500);
      }

      const camposProf = "id, user_id, data_inicio_assinatura, asaas_subscription_id, asaas_compra_id";

      // Já é cliente? Pelo cliente Asaas e, se não achar, pelo e-mail: quem troca
      // de plano pelo link pode virar um cliente Asaas novo.
      // Erro de leitura aqui não pode virar "cliente novo" (duplicaria a conta):
      // responde 500 para o Asaas tentar de novo depois.
      const porCliente = await supabase
        .from("profissionais")
        .select(camposProf)
        .eq("asaas_customer_id", customerId)
        .limit(1)
        .maybeSingle();
      if (porCliente.error) {
        await marcarErro(`Falha ao buscar profissional: ${porCliente.error.message}`);
        return json({ error: "Failed to read profissionais" }, 500);
      }
      let profExistente = porCliente.data;

      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) {
        await marcarErro(`Falha ao listar usuários: ${listErr.message}`);
        return json({ error: "Failed to list users" }, 500);
      }
      const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email) ?? null;

      if (!profExistente && authUser) {
        const porUsuario = await supabase
          .from("profissionais")
          .select(camposProf)
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (porUsuario.error) {
          await marcarErro(`Falha ao buscar profissional: ${porUsuario.error.message}`);
          return json({ error: "Failed to read profissionais" }, 500);
        }
        profExistente = porUsuario.data;
      }

      // Quem ainda não entrou nenhuma vez recebe o e-mail com o link de senha.
      const nuncaEntrou = !authUser?.last_sign_in_at;

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
        const { error: upErr } = await supabase
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
        if (upErr) {
          await marcarErro(`Falha ao atualizar profissional: ${upErr.message}`);
          return json({ error: "Failed to update profissional" }, 500);
        }

        // Conta criada antes (ex.: pelo admin) por quem nunca entrou: manda o acesso.
        if (authUser && nuncaEntrou) {
          const erroEmail = await enviarEmailAcesso(supabase, {
            email, nome, nomePlano: plano.nome ?? null, validade: proxRenov,
            idempotencyKey: `acesso-liberado-${compraId ?? payment.id}`,
          });
          if (erroEmail) {
            await marcarErro(`Plano atualizado, ${erroEmail}`);
            return json({ status: "renewed_annual_no_email", profissional_id: profExistente.id });
          }
        }

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

      // E-mail com login + link para criar a senha. generateLink sozinho não envia
      // nada: o envio é pelo send-transactional-email (ver _shared/emailAcesso.ts).
      const erroEmail = await enviarEmailAcesso(supabase, {
        email, nome, nomePlano: plano.nome ?? null, validade: anual ? proxRenov : null,
        idempotencyKey: `acesso-liberado-${compraId ?? payment.id}`,
      });
      if (erroEmail) {
        // Conta criada, mas o e-mail falhou — registra (o admin reenvia pelo botão
        // "Reenviar e-mail de acesso") e não falha o webhook.
        console.error("[asaas-webhook] e-mail de acesso:", erroEmail);
        await marcarErro(`Conta criada, ${erroEmail}`);
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

    // ===== Reembolso =====
    // Garantia de 7 dias: reembolso integral encerra o acesso. Só cancela se o
    // reembolso for da compra atual da conta (não mexe em quem já comprou de novo).
    if (eventType === "PAYMENT_REFUNDED") {
      const { compraId } = identificarCompra(payment);
      if (compraId) {
        const { error: upErr } = await supabase
          .from("profissionais")
          .update({ plano_status: "cancelado" })
          .eq("asaas_compra_id", compraId);
        if (upErr) {
          await marcarErro(`Falha ao cancelar após reembolso: ${upErr.message}`);
          return json({ error: "Failed to cancel" }, 500);
        }
      }
      await marcarOk();
      return json({ status: "refunded_canceled" });
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

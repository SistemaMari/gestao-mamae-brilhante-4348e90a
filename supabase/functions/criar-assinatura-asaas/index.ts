// Cria cliente + assinatura no Asaas e retorna dados de pagamento (PIX ou Boleto).
// Público: verify_jwt = false (acesso sem login, pois o usuário ainda não tem conta).

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

function asaasBase() {
  const env = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaasFetch(path: string, opts: RequestInit = {}) {
  const key = Deno.env.get("ASAAS_API_KEY")!;
  return fetch(`${asaasBase()}${path}`, {
    ...opts,
    headers: {
      "access_token": key,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    plano_slug, nome, email, cpf, telefone, billing_type,
    credit_card_number, credit_card_expiry_month, credit_card_expiry_year,
    credit_card_cvv, cep, address_number,
  } = body;

  if (!plano_slug || !nome || !email || !cpf || !billing_type) {
    return json({ error: "Campos obrigatórios: plano_slug, nome, email, cpf, billing_type" }, 400);
  }
  if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billing_type)) {
    return json({ error: "billing_type deve ser PIX, BOLETO ou CREDIT_CARD" }, 400);
  }
  if (billing_type === "CREDIT_CARD" && (!credit_card_number || !credit_card_expiry_month || !credit_card_expiry_year || !credit_card_cvv || !cep)) {
    return json({ error: "Campos obrigatórios para cartão: credit_card_number, credit_card_expiry_month, credit_card_expiry_year, credit_card_cvv, cep" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Busca plano no banco
  const { data: plano } = await supabase
    .from("planos")
    .select("id, nome, preco_mensal, pacientes_max, suporte")
    .eq("slug", plano_slug)
    .eq("ativo", true)
    .maybeSingle();

  if (!plano) return json({ error: "Plano não encontrado" }, 404);

  // 2. Cria ou recupera cliente no Asaas
  const cpfLimpo = cpf.replace(/\D/g, "");
  const foneFormatado = telefone ? telefone.replace(/\D/g, "") : undefined;

  // Busca por CPF existente
  const searchResp = await asaasFetch(`/customers?cpfCnpj=${cpfLimpo}&limit=1`);
  const searchData = await searchResp.json();
  let customerId: string;

  if (searchData?.data?.length > 0) {
    customerId = searchData.data[0].id;
  } else {
    const createCust = await asaasFetch("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: nome.trim(),
        email: email.trim().toLowerCase(),
        cpfCnpj: cpfLimpo,
        ...(foneFormatado ? { mobilePhone: foneFormatado } : {}),
        notificationDisabled: false,
      }),
    });
    const custData = await createCust.json();
    if (!custData?.id) {
      console.error("Erro ao criar cliente Asaas:", custData);
      return json({ error: "Falha ao criar cliente no Asaas", detail: custData }, 502);
    }
    customerId = custData.id;
  }

  // 3. Cria assinatura
  const hoje = new Date().toISOString().split("T")[0];

  const subPayload: any = {
    customer: customerId,
    billingType: billing_type,
    value: plano.preco_mensal,
    nextDueDate: hoje,
    cycle: "MONTHLY",
    description: plano.pacientes_max
      ? `${plano.nome} MARI | até ${plano.pacientes_max} pacientes`
      : `${plano.nome} MARI`,
    externalReference: plano_slug,
  };

  if (billing_type === "CREDIT_CARD") {
    subPayload.creditCard = {
      holderName: nome.trim(),
      number: credit_card_number.replace(/\D/g, ""),
      expiryMonth: credit_card_expiry_month,
      expiryYear: credit_card_expiry_year,
      ccv: credit_card_cvv,
    };
    subPayload.creditCardHolderInfo = {
      name: nome.trim(),
      email: email.trim().toLowerCase(),
      cpfCnpj: cpfLimpo,
      postalCode: cep.replace(/\D/g, ""),
      addressNumber: address_number?.trim() || "S/N",
      ...(foneFormatado ? { phone: foneFormatado } : {}),
    };
  }

  const subResp = await asaasFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify(subPayload),
  });
  const subData = await subResp.json();
  if (subData?.errors || !subData?.id) {
    console.error("Erro ao criar assinatura Asaas:", subData);
    return json({ error: "Falha ao criar assinatura no Asaas", detail: subData }, 502);
  }

  const subscriptionId = subData.id;

  // Cartão: cobrança processada na hora, retorna imediatamente
  if (billing_type === "CREDIT_CARD") {
    return json({
      billing_type: "CREDIT_CARD",
      subscription_id: subscriptionId,
      plano: { nome: plano.nome, preco: plano.preco_mensal },
    });
  }

  // 4. Aguarda 1s e busca o primeiro pagamento da assinatura (PIX / BOLETO)
  await new Promise((r) => setTimeout(r, 1200));

  const paymentsResp = await asaasFetch(`/payments?subscription=${subscriptionId}&limit=1`);
  const paymentsData = await paymentsResp.json();
  const payment = paymentsData?.data?.[0];

  if (!payment?.id) {
    return json({ error: "Pagamento inicial não encontrado", subscription_id: subscriptionId }, 502);
  }

  const paymentId = payment.id;

  // 5. Busca dados específicos do método de pagamento
  if (billing_type === "PIX") {
    const pixResp = await asaasFetch(`/payments/${paymentId}/pixQrCode`);
    const pixData = await pixResp.json();
    return json({
      billing_type: "PIX",
      subscription_id: subscriptionId,
      payment_id: paymentId,
      pix_qr_code_image: pixData.encodedImage ?? null,
      pix_copia_cola: pixData.payload ?? null,
      expiration: pixData.expirationDate ?? null,
      plano: { nome: plano.nome, preco: plano.preco_mensal },
    });
  }

  // BOLETO
  const boletoResp = await asaasFetch(`/payments/${paymentId}/identificationField`);
  const boletoData = await boletoResp.json();
  return json({
    billing_type: "BOLETO",
    subscription_id: subscriptionId,
    payment_id: paymentId,
    boleto_linha_digitavel: boletoData.identificationField ?? null,
    boleto_pdf_url: payment.bankSlipUrl ?? null,
    due_date: payment.dueDate ?? hoje,
    plano: { nome: plano.nome, preco: plano.preco_mensal },
  });
});

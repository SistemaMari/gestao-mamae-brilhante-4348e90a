// Aba Pagamentos da profissional de consultório: as cobranças da PRÓPRIA conta
// no Asaas (parcelas pagas e em aberto), com boleto, Pix copia e cola e a
// fatura do Asaas para o que estiver em aberto.
//
// Body: { acao: 'listar' } | { acao: 'pix', pagamento_id }
// Só devolve cobranças do cliente Asaas da própria conta (asaas_customer_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asaasBaseUrl } from "../_shared/compraAsaas.ts";
import { montarPagamentosConta } from "../_shared/pagamentosConta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

  let body: { acao?: string; pagamento_id?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const acao = body.acao ?? "listar";

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: prof, error: profErr } = await supabase
    .from("profissionais")
    .select("id, asaas_customer_id, unidade_id, perfil_institucional")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profErr) return json({ error: "Falha ao ler a conta." }, 500);
  if (!prof || prof.unidade_id || prof.perfil_institucional) {
    return json({ error: "Esta conta não tem plano de consultório." }, 400);
  }
  // Conta sem compra no Asaas (ex.: criada pelo admin): nada a mostrar.
  if (!prof.asaas_customer_id) return json({ status: "ok", pagamentos: [], sem_cliente_asaas: true });

  const asaasKey = Deno.env.get("ASAAS_API_KEY");
  if (!asaasKey) return json({ error: "Pagamentos indisponíveis no momento." }, 500);
  const base = asaasBaseUrl(asaasKey, Deno.env.get("ASAAS_ENV"));
  const asaas = (path: string) => fetch(`${base}${path}`, { headers: { access_token: asaasKey } });

  if (acao === "listar") {
    // deno-lint-ignore no-explicit-any
    const cobrancas: any[] = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const resp = await asaas(`/payments?customer=${encodeURIComponent(prof.asaas_customer_id)}&limit=100&offset=${offset}`);
      if (!resp.ok) {
        console.error("[meus-pagamentos] listar:", resp.status, await resp.text());
        return json({ error: "Não foi possível consultar os pagamentos agora." }, 502);
      }
      const pagina = await resp.json();
      cobrancas.push(...(pagina?.data ?? []));
      if (!pagina?.hasMore) break;
    }
    return json({ status: "ok", pagamentos: montarPagamentosConta(cobrancas, hojeSP()) });
  }

  if (acao === "pix") {
    const id = String(body.pagamento_id ?? "");
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return json({ error: "Cobrança inválida." }, 400);
    // A cobrança tem que ser da própria conta.
    const pResp = await asaas(`/payments/${id}`);
    if (!pResp.ok) return json({ error: "Cobrança não encontrada." }, 404);
    const pagamento = await pResp.json();
    if (pagamento?.customer !== prof.asaas_customer_id) return json({ error: "Cobrança não encontrada." }, 404);

    const qResp = await asaas(`/payments/${id}/pixQrCode`);
    if (!qResp.ok) {
      console.error("[meus-pagamentos] pix:", qResp.status, await qResp.text());
      return json({ error: "Pix indisponível para esta cobrança. Use a fatura do Asaas." }, 502);
    }
    const qr = await qResp.json();
    return json({
      status: "ok",
      copia_e_cola: qr?.payload ?? null,
      qr_code_base64: qr?.encodedImage ?? null,
      expira_em: qr?.expirationDate ?? null,
    });
  }

  return json({ error: "Ação inválida." }, 400);
});

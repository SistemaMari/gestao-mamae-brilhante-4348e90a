// Reajusta o valor das assinaturas ATUAIS de um plano direto no Asaas.
// Só admin. Atualiza cada profissional (consultório) que tem assinatura ativa
// no plano para o novo valor. Clientes sem assinatura no Asaas são ignorados.
//
// ⚠️ Mexe em COBRANÇA REAL. O front deve confirmar antes de chamar.
// Verificar o endpoint/método contra a doc atual do Asaas no smoke test.

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1. Auth: exige JWT de admin.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: adminRow } = await admin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!adminRow) return json({ error: "Acesso restrito a administradores" }, 403);

  // 2. Parâmetros.
  let body: { plano_id?: string; novo_valor?: number; atualizar_cobrancas_pendentes?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { plano_id, novo_valor } = body;
  const updatePendingPayments = Boolean(body.atualizar_cobrancas_pendentes);
  if (!plano_id || typeof novo_valor !== "number" || novo_valor < 0) {
    return json({ error: "plano_id e novo_valor (>= 0) são obrigatórios" }, 400);
  }

  // 3. Assinaturas atuais do plano (consultório com assinatura no Asaas).
  const { data: profs, error: profErr } = await admin
    .from("profissionais")
    .select("id, nome, asaas_subscription_id")
    .eq("plano_id", plano_id)
    .not("asaas_subscription_id", "is", null);
  if (profErr) return json({ error: "Erro ao ler assinaturas", details: profErr.message }, 500);

  const alvo = profs ?? [];
  const falhas: { profissional_id: string; nome: string; motivo: string }[] = [];
  let atualizadas = 0;

  for (const p of alvo) {
    try {
      const resp = await asaasFetch(`/subscriptions/${p.asaas_subscription_id}`, {
        method: "POST",
        body: JSON.stringify({ value: novo_valor, updatePendingPayments }),
      });
      if (resp.ok) {
        atualizadas++;
      } else {
        const txt = await resp.text();
        falhas.push({ profissional_id: p.id, nome: p.nome, motivo: `HTTP ${resp.status}: ${txt.slice(0, 200)}` });
      }
    } catch (e) {
      falhas.push({ profissional_id: p.id, nome: p.nome, motivo: (e as Error).message });
    }
  }

  return json({
    total: alvo.length,
    atualizadas,
    falhas,
  });
});

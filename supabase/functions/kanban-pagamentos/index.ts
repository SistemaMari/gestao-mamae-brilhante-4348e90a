// Edge Function: kanban-pagamentos (admin)
// Cobranças do Asaas de cada conta de consultório, para o kanban de pagamentos
// e renovações (/admin/pagamentos). A coluna de cada conta é calculada no app
// (supabase/functions/_shared/kanbanPagamentos.ts); aqui só buscamos as
// parcelas, direto do Asaas, para refletir pagamentos e atrasos na hora.
//
// Body: { acao: 'listar' }
// Resposta: { status: 'ok', hoje, pagamentos: { [profissional_id]: PagamentoConta[] }, falhas: string[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { asaasBaseUrl } from "../_shared/compraAsaas.ts";
import { montarPagamentosConta, type PagamentoConta } from "../_shared/pagamentosConta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const erro = (codigo: string, mensagem: string, status = 400) =>
  json({ status: "erro", codigo, mensagem }, status);

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Quantas contas consultamos no Asaas ao mesmo tempo. */
const CONCORRENCIA = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return erro("metodo", "Method not allowed", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return erro("nao_autenticado", "Não autenticado.", 401);
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) return erro("nao_autenticado", "Não autenticado.", 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: adminRow } = await supabase
      .from("admins")
      .select("id")
      .eq("user_id", claimsData.claims.sub as string)
      .maybeSingle();
    if (!adminRow) return erro("forbidden", "Apenas administradores.", 403);

    const body = await req.json().catch(() => ({}));
    if ((body?.acao ?? "listar") !== "listar") return erro("acao_invalida", "Ação inválida.");

    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasKey) return erro("asaas_indisponivel", "Pagamentos indisponíveis no momento.", 500);
    const base = asaasBaseUrl(asaasKey, Deno.env.get("ASAAS_ENV"));

    // Contas de consultório com cliente no Asaas. Canceladas e revogadas não
    // precisam de consulta: vão direto para "Encerrados".
    const { data: profs, error: profErr } = await supabase
      .from("profissionais")
      .select("id, asaas_customer_id, plano_status, acesso_revogado")
      .is("unidade_id", null)
      .is("perfil_institucional", null)
      .not("asaas_customer_id", "is", null);
    if (profErr) {
      console.error("[kanban-pagamentos] profissionais:", profErr);
      return erro("erro_interno", "Erro ao listar as contas.", 500);
    }
    const alvo = (profs ?? []).filter((p) => p.plano_status !== "cancelado" && !p.acesso_revogado);

    const hoje = hojeSP();
    const pagamentos: Record<string, PagamentoConta[]> = {};
    const falhas: string[] = [];

    async function buscar(prof: { id: string; asaas_customer_id: string }) {
      // deno-lint-ignore no-explicit-any
      const cobrancas: any[] = [];
      for (let offset = 0; offset < 300; offset += 100) {
        const resp = await fetch(
          `${base}/payments?customer=${encodeURIComponent(prof.asaas_customer_id)}&limit=100&offset=${offset}`,
          { headers: { access_token: asaasKey! } },
        );
        if (!resp.ok) {
          console.error("[kanban-pagamentos] asaas:", prof.id, resp.status, await resp.text());
          falhas.push(prof.id);
          return;
        }
        const pagina = await resp.json();
        cobrancas.push(...(pagina?.data ?? []));
        if (!pagina?.hasMore) break;
      }
      pagamentos[prof.id] = montarPagamentosConta(cobrancas, hoje);
    }

    const fila = [...alvo] as { id: string; asaas_customer_id: string }[];
    await Promise.all(
      Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, async () => {
        while (fila.length) {
          const prox = fila.shift()!;
          try {
            await buscar(prox);
          } catch (e) {
            console.error("[kanban-pagamentos] falha:", prox.id, e);
            falhas.push(prox.id);
          }
        }
      }),
    );

    return json({ status: "ok", hoje, pagamentos, falhas });
  } catch (e) {
    console.error("[kanban-pagamentos] erro:", e);
    return erro("erro_interno", "Erro ao montar o kanban.", 500);
  }
});

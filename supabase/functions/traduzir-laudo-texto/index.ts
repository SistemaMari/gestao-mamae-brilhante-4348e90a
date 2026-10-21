// Edge Function: traduzir-laudo-texto (admin)
// Traduz um texto de laudo do português para inglês e espanhol com o Claude.
// Chamada pelo editor /admin/laudos ao salvar um rascunho em PT: as traduções
// viram rascunhos nas abas EN/ES e são publicadas junto com o PT.
//
// Body: { titulo?: string | null, texto: string }
// Resposta: { status: 'ok', traducoes: { 'en-US': {titulo, texto}, es: {titulo, texto} } }
//         | { status: 'erro', codigo, mensagem }
//
// As variáveis [entre colchetes] ficam em português; se o modelo alterar alguma,
// a tradução é recusada (codigo 'variaveis_alteradas') — nada é gravado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import {
  PROMPT_TRADUCAO,
  SCHEMA_TRADUCAO,
  montarPedidoTraducao,
  validarTraducoes,
} from "../_shared/traducaoLaudo.ts";

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

const MODELO = "claude-opus-5-5";
/** Limite de segurança: os textos de laudo têm poucos parágrafos. */
const MAX_CARACTERES = 20000;

async function chamarModelo(apiKey: string, titulo: string, texto: string): Promise<unknown> {
  const corpo = {
    model: MODELO,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA_TRADUCAO }, effort: "high" },
    // Se o modelo principal recusar, a própria API refaz o pedido num modelo reserva.
    fallbacks: "default",
    system: PROMPT_TRADUCAO,
    messages: [{ role: "user", content: montarPedidoTraducao(titulo, texto) }],
  };

  // No máximo uma segunda tentativa, e só para falha de rede/429/5xx.
  let ultimoErro: unknown = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify(corpo),
      });

      if ((resp.status === 429 || resp.status >= 500) && tentativa === 0) {
        ultimoErro = new Error(`Anthropic API ${resp.status}`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Anthropic API ${resp.status}: ${t.slice(0, 300)}`);
      }

      const dados = await resp.json();
      if (dados.stop_reason === "refusal") {
        throw Object.assign(new Error("Modelo recusou a tradução"), { codigo: "recusado" });
      }
      if (dados.stop_reason === "max_tokens") {
        throw Object.assign(new Error("Tradução cortada (max_tokens)"), { codigo: "resposta_invalida" });
      }
      const blocoTexto = Array.isArray(dados.content)
        ? dados.content.find((b: { type: string }) => b.type === "text")
        : null;
      if (!blocoTexto?.text) {
        throw Object.assign(new Error("Resposta sem texto"), { codigo: "resposta_invalida" });
      }
      console.log(
        `[traduzir-laudo-texto] ok modelo=${dados.model} entrada=${dados.usage?.input_tokens} saida=${dados.usage?.output_tokens}`,
      );
      return JSON.parse(blocoTexto.text);
    } catch (err) {
      ultimoErro = err;
      if (tentativa === 0 && err instanceof TypeError) continue; // falha de rede
      break;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha desconhecida ao chamar o modelo");
}

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

    const body = await req.json().catch(() => null);
    const texto = typeof body?.texto === "string" ? body.texto : "";
    const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";
    if (!texto.trim()) return erro("texto_vazio", "Texto vazio.");
    if (texto.length + titulo.length > MAX_CARACTERES) return erro("texto_longo", "Texto longo demais.");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return erro("traducao_indisponivel", "Tradução automática indisponível.", 500);

    const bruto = await chamarModelo(apiKey, titulo, texto);
    const traducoes = validarTraducoes(texto, bruto);
    return json({ status: "ok", traducoes });
  } catch (e) {
    const codigo = (e as { codigo?: string })?.codigo ?? "falha_servico";
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error(`[traduzir-laudo-texto] ${codigo}: ${mensagem}`);
    return erro(codigo, mensagem, codigo === "falha_servico" ? 502 : 422);
  }
});

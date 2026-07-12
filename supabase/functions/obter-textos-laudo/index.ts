// Edge Function: obter-textos-laudo
// Retorna os blocos de texto FIXOS (escritos pelo time clínico) publicados
// para uma combinação (tipo_consulta + desfecho_clinico).
// Leitura pura do banco — NÃO chama IA.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fase 2 — normaliza o idioma recebido para um dos valores suportados por
// laudo_textos.idioma. Espelha `normalizeLang` do front (src/i18n/index.ts).
function normalizarIdioma(value: unknown): "pt-BR" | "en-US" | "es" {
  const v = typeof value === "string" ? value.toLowerCase() : "";
  if (v.startsWith("en")) return "en-US";
  if (v.startsWith("es")) return "es";
  return "pt-BR";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResp({ error: "JSON inválido" }, 400);
    }

    const tipo_consulta = typeof body?.tipo_consulta === "string" ? body.tipo_consulta.trim() : "";
    const desfecho_clinico = typeof body?.desfecho_clinico === "string" ? body.desfecho_clinico.trim() : "";
    // Fase 2 — laudo multilíngue. Default 'pt-BR' preserva o comportamento
    // pré-idioma (retrocompatível). Só 'pt-BR' | 'en-US' | 'es' são aceitos.
    const idioma = normalizarIdioma(body?.idioma);

    if (!tipo_consulta || !desfecho_clinico) {
      return jsonResp({ error: "tipo_consulta e desfecho_clinico são obrigatórios" }, 400);
    }

    const { data, error } = await supabase
      .from("laudo_textos")
      .select("bloco, ordem_bloco, titulo_bloco, texto, versao")
      .eq("tipo_consulta", tipo_consulta)
      .eq("desfecho_clinico", desfecho_clinico)
      .eq("status", "publicado")
      .eq("idioma", idioma)
      .order("ordem_bloco", { ascending: true });

    if (error) {
      return jsonResp({ error: "Erro ao ler textos", details: error.message }, 500);
    }

    if (!data || data.length === 0) {
      return jsonResp({
        textos: [],
        completo: false,
        blocos_faltantes: ["*"],
        mensagem: "Nenhum texto publicado para esta combinação — solicitar ao time clínico.",
      });
    }

    return jsonResp({
      textos: data,
      completo: true,
    });
  } catch (e) {
    return jsonResp({ error: "Erro interno", details: (e as Error).message }, 500);
  }
});

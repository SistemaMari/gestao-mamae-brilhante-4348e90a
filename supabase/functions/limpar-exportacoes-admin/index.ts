// Edge Function: limpar-exportacoes-admin
// Acionada pelo cron (pg_cron + pg_net) 1x ao dia. Remove objetos do bucket
// `exportacoes-admin` com mais de 7 dias.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RETENCAO_DIAS = 7;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: only allow calls bearing the service-role key (pg_cron / admin).
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const limite = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000);

  // Lista recursiva: primeiro pega as pastas /exportacoes/{admin_id}/
  const removidos: string[] = [];
  let erros = 0;

  async function listarRecursivo(prefix: string): Promise<string[]> {
    const acumulado: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage
        .from("exportacoes-admin")
        .list(prefix, { limit: 1000, offset });
      if (error) {
        erros++;
        break;
      }
      if (!data || data.length === 0) break;
      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          // Pasta: recursa
          const subs = await listarRecursivo(fullPath);
          acumulado.push(...subs);
        } else {
          const created = item.created_at ? new Date(item.created_at) : null;
          if (created && created < limite) {
            acumulado.push(fullPath);
          }
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
    return acumulado;
  }

  try {
    const candidatos = await listarRecursivo("exportacoes");
    if (candidatos.length > 0) {
      // Remove em lotes de 100
      for (let i = 0; i < candidatos.length; i += 100) {
        const lote = candidatos.slice(i, i + 100);
        const { error } = await admin.storage
          .from("exportacoes-admin")
          .remove(lote);
        if (error) {
          erros++;
          console.error("Erro removendo lote:", error);
        } else {
          removidos.push(...lote);
        }
      }
    }
  } catch (e) {
    console.error("Erro listagem:", e);
    erros++;
  }

  return new Response(
    JSON.stringify({
      status: erros === 0 ? "ok" : "parcial",
      removidos: removidos.length,
      erros,
      retencao_dias: RETENCAO_DIAS,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

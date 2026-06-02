// Cron diário: verifica profissionais com proxima_renovacao vencida e marca como inadimplente.
// Também marca como 'inadimplente' quem ainda está 'ativo' mas a data já passou.
// Executado todo dia às 08:00 via pg_cron ou scheduled invocation.
//
// Lógica:
//   1. Busca profissionais com plano_status = 'ativo' e proxima_renovacao < agora
//   2. Marca plano_status = 'inadimplente'
//
// A reativação acontece via webhook asaas-webhook quando PAYMENT_RECEIVED chegar.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const agora = new Date().toISOString();

  // 1. Marca inadimplentes: ativo + proxima_renovacao vencida
  const { data: marcados, error: errMarca } = await supabase
    .from("profissionais")
    .update({ plano_status: "inadimplente" })
    .eq("plano_status", "ativo")
    .lt("proxima_renovacao", agora)
    .select("id, nome, proxima_renovacao");

  if (errMarca) {
    console.error("[verificar-inadimplencia] erro ao marcar inadimplentes:", errMarca);
    return json({ error: errMarca.message }, 500);
  }

  const totalMarcados = marcados?.length ?? 0;
  console.log(`[verificar-inadimplencia] ${totalMarcados} profissional(is) marcado(s) como inadimplente`);

  // 2. Busca quem renova em <=5 dias (apenas log — o banner é feito no frontend)
  const em5Dias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: aVencer } = await supabase
    .from("profissionais")
    .select("id, nome, proxima_renovacao")
    .eq("plano_status", "ativo")
    .gte("proxima_renovacao", agora)
    .lte("proxima_renovacao", em5Dias);

  const totalAVencer = aVencer?.length ?? 0;
  console.log(`[verificar-inadimplencia] ${totalAVencer} profissional(is) renovam em até 5 dias`);

  return json({
    status: "ok",
    marcados_inadimplentes: totalMarcados,
    renovando_em_5_dias: totalAVencer,
    timestamp: agora,
  });
});

// Cron diário: verifica profissionais com proxima_renovacao vencida e marca como inadimplente.
// Também marca como 'inadimplente' quem ainda está 'ativo' mas a data já passou.
// Executado todo dia às 08:00 via pg_cron ou scheduled invocation.
//
// Lógica:
//   1. Busca profissionais com plano_status = 'ativo' e proxima_renovacao < agora
//   2. Marca plano_status = 'inadimplente'
//   3. Avisa por e-mail quem está a até 15 dias da última cobrança do plano
//      anual (a 12ª, ver maxPayments em criar-assinatura-asaas) — aviso único,
//      controlado por aviso_fim_ciclo_enviado_em.
//
// A reativação acontece via webhook asaas-webhook quando PAYMENT_RECEIVED chegar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Plano anual = 12 cobranças mensais a partir de data_inicio_assinatura; a
// última é 11 meses depois da primeira.
const MESES_CICLO_ANUAL = 11;
// Quantos dias antes da última cobrança o aviso é disparado.
const DIAS_AVISO_FIM_CICLO = 15;

function addMeses(dataIso: string, meses: number): Date {
  const d = new Date(dataIso);
  d.setMonth(d.getMonth() + meses);
  return d;
}

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

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!SERVICE_ROLE_KEY || bearer !== SERVICE_ROLE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    SERVICE_ROLE_KEY,
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

  // 3. Avisa por e-mail quem está a até 15 dias da última cobrança (12ª) do
  // plano anual. Candidatos: ativos, com ciclo iniciado e ainda não avisados
  // — o filtro fino (dias restantes) é feito aqui embaixo, pois a data da
  // última cobrança é calculada a partir de data_inicio_assinatura, não uma
  // coluna própria.
  const { data: candidatosAviso, error: errCandidatos } = await supabase
    .from("profissionais")
    .select("id, user_id, nome, plano_id, data_inicio_assinatura")
    .eq("plano_status", "ativo")
    .not("data_inicio_assinatura", "is", null)
    .is("aviso_fim_ciclo_enviado_em", null);

  if (errCandidatos) {
    console.error("[verificar-inadimplencia] erro ao buscar candidatos ao aviso de fim de ciclo:", errCandidatos);
  }

  let totalAvisados = 0;
  const agoraMs = Date.now();

  for (const prof of candidatosAviso ?? []) {
    const dataFimCiclo = addMeses(prof.data_inicio_assinatura as string, MESES_CICLO_ANUAL);
    const diasRestantes = Math.ceil((dataFimCiclo.getTime() - agoraMs) / (24 * 60 * 60 * 1000));
    if (diasRestantes > DIAS_AVISO_FIM_CICLO) continue; // ainda longe do fim

    try {
      const { data: plano } = await supabase
        .from("planos")
        .select("nome")
        .eq("id", prof.plano_id)
        .maybeSingle();

      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(prof.user_id as string);
      const email = userData?.user?.email;
      if (userErr || !email) {
        console.error(`[verificar-inadimplencia] sem e-mail para profissional ${prof.id}:`, userErr?.message);
        continue;
      }

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "plano-anual-acabando",
          recipientEmail: email,
          idempotencyKey: `plano-anual-acabando-${prof.id}-${prof.data_inicio_assinatura}`,
          templateData: {
            nomeProfissional: prof.nome,
            nomePlano: plano?.nome ?? "MARI",
            dataFimFormatada: dataFimCiclo.toLocaleDateString("pt-BR"),
          },
        },
      });

      await supabase
        .from("profissionais")
        .update({ aviso_fim_ciclo_enviado_em: new Date().toISOString() })
        .eq("id", prof.id);

      totalAvisados++;
    } catch (e) {
      // Best-effort: uma falha de e-mail não pode travar o cron para os demais.
      console.error(`[verificar-inadimplencia] falha ao avisar profissional ${prof.id}:`, (e as Error).message);
    }
  }

  console.log(`[verificar-inadimplencia] ${totalAvisados} profissional(is) avisado(s) do fim do ciclo anual`);

  return json({
    status: "ok",
    marcados_inadimplentes: totalMarcados,
    renovando_em_5_dias: totalAVencer,
    avisados_fim_ciclo_anual: totalAvisados,
    timestamp: agora,
  });
});

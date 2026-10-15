// Cron diário: verifica profissionais com proxima_renovacao vencida e marca como inadimplente.
// Também marca como 'inadimplente' quem ainda está 'ativo' mas a data já passou.
// Executado todo dia às 08:00 via pg_cron ou scheduled invocation.
//
// Lógica:
//   1. Busca profissionais com plano_status = 'ativo' e proxima_renovacao < agora
//   2. Marca plano_status = 'inadimplente'
//   3. Avisa por e-mail quem está a até 60 dias do fim do ano pago (renovar
//      ou não pelo app, em Meu perfil → Meu plano) — aviso único por ano,
//      controlado por aviso_fim_ciclo_enviado_em.
//
// A reativação acontece via webhook asaas-webhook quando PAYMENT_RECEIVED chegar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { DIAS_AVISO_RENOVACAO, diasParaVencer, fimDoCiclo } from "../_shared/renovacao.ts";
import { enviarEmailDeModelo } from "../_shared/emailModelo.ts";
import { template as planoAnualAcabando } from "../_shared/transactional-email-templates/plano-anual-acabando.tsx";

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

  // 3. Avisa por e-mail quem está a até 60 dias do fim do ano pago (a MARI não
  // renova sozinha). Aviso único por ano, controlado por
  // aviso_fim_ciclo_enviado_em (o webhook zera a cada compra nova). Quem já
  // pediu para não renovar não recebe. O filtro fino (dias restantes) é feito
  // aqui embaixo: o fim do ano depende do tipo de compra (ver fimDoCiclo).
  const { data: candidatosAviso, error: errCandidatos } = await supabase
    .from("profissionais")
    .select("id, user_id, nome, plano_id, data_inicio_assinatura, proxima_renovacao, asaas_subscription_id")
    .eq("plano_status", "ativo")
    .is("unidade_id", null)
    .is("aviso_fim_ciclo_enviado_em", null);

  if (errCandidatos) {
    console.error("[verificar-inadimplencia] erro ao buscar candidatos ao aviso de fim de ciclo:", errCandidatos);
  }

  const { data: pedidosAbertos } = await supabase
    .from("pedidos_nao_renovacao")
    .select("profissional_id")
    .is("desfeito_em", null);
  const naoRenovam = new Set((pedidosAbertos ?? []).map((p: { profissional_id: string }) => p.profissional_id));

  const appUrl = Deno.env.get("APP_PUBLIC_URL") ?? "https://maridmg.com.br";
  let totalAvisados = 0;

  for (const prof of candidatosAviso ?? []) {
    if (naoRenovam.has(prof.id)) continue;
    const dias = diasParaVencer(prof);
    if (dias === null || dias < 0 || dias > DIAS_AVISO_RENOVACAO) continue;
    const dataFimCiclo = fimDoCiclo(prof)!;

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

      const erro = await enviarEmailDeModelo(supabase, {
        modelo: planoAnualAcabando,
        nomeModelo: "plano-anual-acabando",
        para: email,
        idempotencyKey: `plano-anual-acabando-${prof.id}-${dataFimCiclo.toISOString()}`,
        props: {
          nomeProfissional: prof.nome,
          nomePlano: plano?.nome ?? "MARI",
          dataFimFormatada: dataFimCiclo.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          linkRenovar: `${appUrl}/perfil`,
        },
      });
      if (erro) {
        console.error(`[verificar-inadimplencia] aviso de fim de ciclo para ${prof.id}:`, erro);
        continue;
      }

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

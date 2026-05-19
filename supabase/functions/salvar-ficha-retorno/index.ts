// Edge Function: salvar-ficha-retorno
// Persistência idempotente da ficha de retorno com modo rascunho|finalizar.
// Usa COALESCE em todos os campos clínicos para impedir sobrescrita destrutiva por NULL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type Modo = "rascunho" | "finalizar";

interface Payload {
  consulta_id?: string;
  paciente_id: string;
  modo: Modo;
  tipo?: string;                  // ex.: 'retorno_1'
  numero_sequencial?: number;
  campos?: {
    data?: string;
    ig_semanas?: number | null;
    ig_dias?: number | null;
    cenario_clinico?: string | null;
    observacoes?: string | null;
  };
  exame_glicemia?: {
    id?: string;
    valor_mgdl?: number | null;
    tipo_exame?: string | null;
    data_exame?: string | null;
    ig_semanas_na_data?: number | null;
    ig_dias_na_data?: number | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Payload;
    if (!body?.paciente_id || !body?.modo) {
      return jsonResp({ error: "paciente_id e modo são obrigatórios" }, 400);
    }
    if (body.modo !== "rascunho" && body.modo !== "finalizar") {
      return jsonResp({ error: "modo inválido" }, 400);
    }

    // Resolve profissional
    const { data: prof } = await admin
      .from("profissionais")
      .select("id, acesso_revogado")
      .eq("user_id", userData.user.id)
      .single();
    if (!prof || prof.acesso_revogado) return jsonResp({ error: "Profissional não autorizado" }, 403);

    // Garante acesso ao paciente (RLS via cliente autenticado)
    const { data: pacienteCheck, error: pacErr } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", body.paciente_id)
      .maybeSingle();
    if (pacErr || !pacienteCheck) return jsonResp({ error: "Paciente não acessível" }, 403);

    const campos = body.campos ?? {};
    const tipo = body.tipo ?? "retorno_1";

    // ============================================================
    // Validação modo=finalizar
    // ============================================================
    if (body.modo === "finalizar") {
      const faltantes: string[] = [];
      if (!campos.data) faltantes.push("data");
      if (campos.ig_semanas == null) faltantes.push("ig_semanas");
      if (campos.ig_dias == null) faltantes.push("ig_dias");
      if (!campos.cenario_clinico) faltantes.push("cenario_clinico");

      // Para Retorno 1: exige exame de glicemia se ainda não houver para a consulta
      if (tipo === "retorno_1") {
        const temExame = body.exame_glicemia && (body.exame_glicemia.valor_mgdl ?? null) != null;
        if (!temExame && body.consulta_id) {
          const { data: existente } = await admin
            .from("exames_glicemia")
            .select("id")
            .eq("consulta_id", body.consulta_id)
            .limit(1);
          if (!existente?.length) faltantes.push("exame_glicemia");
        } else if (!temExame) {
          faltantes.push("exame_glicemia");
        }
      }

      if (faltantes.length) {
        return jsonResp({ error: "campos_pendentes", faltantes }, 422);
      }
    }

    // ============================================================
    // UPSERT consultas (COALESCE via RPC manual: usamos UPDATE … COALESCE)
    // ============================================================
    let consultaId = body.consulta_id ?? null;

    if (!consultaId) {
      const insertPayload: Record<string, unknown> = {
        paciente_id: body.paciente_id,
        profissional_id: prof.id,
        tipo,
        numero_sequencial: body.numero_sequencial ?? 1,
        data: campos.data ?? new Date().toISOString().slice(0, 10),
        ig_semanas: campos.ig_semanas ?? null,
        ig_dias: campos.ig_dias ?? null,
        cenario_clinico: campos.cenario_clinico ?? null,
        observacoes: campos.observacoes ?? null,
        is_rascunho: body.modo === "rascunho",
        status_ficha: body.modo === "finalizar" ? "completa" : "rascunho",
        ficha_finalizada_em: body.modo === "finalizar" ? new Date().toISOString() : null,
      };
      const { data: novaConsulta, error: insErr } = await admin
        .from("consultas")
        .insert(insertPayload)
        .select("*")
        .single();
      if (insErr || !novaConsulta) return jsonResp({ error: "Erro ao criar consulta", details: insErr?.message }, 500);
      consultaId = novaConsulta.id;
    } else {
      // UPDATE COALESCE: lê valores atuais, faz merge no servidor
      const { data: atual } = await admin
        .from("consultas")
        .select("data, ig_semanas, ig_dias, cenario_clinico, observacoes, status_ficha")
        .eq("id", consultaId)
        .single();
      if (!atual) return jsonResp({ error: "Consulta não encontrada" }, 404);

      const updatePayload: Record<string, unknown> = {
        data: campos.data ?? atual.data,
        ig_semanas: campos.ig_semanas ?? atual.ig_semanas,
        ig_dias: campos.ig_dias ?? atual.ig_dias,
        cenario_clinico: campos.cenario_clinico ?? atual.cenario_clinico,
        observacoes: campos.observacoes ?? atual.observacoes,
        is_rascunho: body.modo === "rascunho",
        status_ficha:
          body.modo === "finalizar"
            ? (atual.status_ficha === "laudo_gerado" ? "laudo_gerado" : "completa")
            : (atual.status_ficha === "laudo_gerado" ? "laudo_gerado" : "rascunho"),
        ficha_finalizada_em: body.modo === "finalizar" ? new Date().toISOString() : null,
      };
      const { error: updErr } = await admin
        .from("consultas")
        .update(updatePayload)
        .eq("id", consultaId);
      if (updErr) return jsonResp({ error: "Erro ao atualizar consulta", details: updErr.message }, 500);
    }

    // ============================================================
    // Exame de glicemia (opcional)
    // ============================================================
    if (body.exame_glicemia) {
      const eg = body.exame_glicemia;
      if (eg.id) {
        const { data: atualEg } = await admin
          .from("exames_glicemia")
          .select("valor_mgdl, tipo_exame, data_exame, ig_semanas_na_data, ig_dias_na_data")
          .eq("id", eg.id)
          .single();
        const updEg: Record<string, unknown> = {
          valor_mgdl: eg.valor_mgdl ?? atualEg?.valor_mgdl,
          tipo_exame: eg.tipo_exame ?? atualEg?.tipo_exame,
          data_exame: eg.data_exame ?? atualEg?.data_exame,
          ig_semanas_na_data: eg.ig_semanas_na_data ?? atualEg?.ig_semanas_na_data,
          ig_dias_na_data: eg.ig_dias_na_data ?? atualEg?.ig_dias_na_data,
        };
        await admin.from("exames_glicemia").update(updEg).eq("id", eg.id);
      } else if (eg.valor_mgdl != null) {
        await admin.from("exames_glicemia").insert({
          paciente_id: body.paciente_id,
          consulta_id: consultaId,
          profissional_id: prof.id,
          valor_mgdl: eg.valor_mgdl,
          tipo_exame: eg.tipo_exame ?? "plasmatica",
          data_exame: eg.data_exame ?? new Date().toISOString().slice(0, 10),
          ig_semanas_na_data: eg.ig_semanas_na_data ?? null,
          ig_dias_na_data: eg.ig_dias_na_data ?? null,
        });
      }
    }

    // ============================================================
    // Resposta: consulta + IG calculada + alerta de divergência
    // ============================================================
    const { data: consultaFinal } = await admin
      .from("consultas")
      .select("*")
      .eq("id", consultaId!)
      .single();

    const dataAlvo = consultaFinal?.data ?? new Date().toISOString().slice(0, 10);
    const { data: igRows } = await admin.rpc("calcular_ig", {
      p_paciente_id: body.paciente_id,
      p_data_alvo: dataAlvo,
    });
    const igRef = Array.isArray(igRows) ? igRows[0] : igRows;

    // Alerta de divergência (>7 dias) entre IG-USG e IG-DUM
    let alerta_divergencia_ig = false;
    try {
      const { data: pac } = await admin
        .from("pacientes")
        .select("referencia_ig, referencia_usg_id, dum")
        .eq("id", body.paciente_id)
        .single();
      if (pac?.referencia_ig === "usg" && pac.dum && igRef?.base_data) {
        const dumDate = new Date(pac.dum + "T00:00:00").getTime();
        const baseUsg = new Date(String(igRef.base_data) + "T00:00:00").getTime();
        const diffDias = Math.abs(Math.round((dumDate - baseUsg) / (1000 * 60 * 60 * 24)));
        if (diffDias > 7) alerta_divergencia_ig = true;
      }
    } catch (_e) { /* ignora */ }

    return jsonResp({
      ok: true,
      consulta: consultaFinal,
      ig: igRef ?? null,
      alerta_divergencia_ig,
    });
  } catch (e) {
    console.error("salvar-ficha-retorno error", e);
    return jsonResp({ error: "Erro interno", details: String(e instanceof Error ? e.message : e) }, 500);
  }
});

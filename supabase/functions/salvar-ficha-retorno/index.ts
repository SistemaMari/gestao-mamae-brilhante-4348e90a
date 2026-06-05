// Edge Function: salvar-ficha-retorno
// Persistência idempotente de QUALQUER ficha (caso_novo, retorno_1, ficha_a/b/c/d, gtt, registro_parto)
// com modo rascunho|finalizar.
// Usa COALESCE em todos os campos clínicos (consulta + perfil glicêmico + exame de glicemia)
// para impedir sobrescrita destrutiva por NULL.
//
// 34A.2 — Generalização: aceita e persiste a grade (perfis_glicemicos + valores_perfil)
// para QUALQUER tipo de ficha, com a mesma proteção COALESCE que antes só o retorno_1 tinha.
//   • grade ausente no payload  → NÃO toca em perfis_glicemicos nem em valores_perfil
//   • grade presente sem valores → atualiza perfil com COALESCE, NÃO apaga valores existentes
//   • grade.valores presente (array) → substitui (delete+insert) os valores do perfil
// A camada de decisão clínica da ficha_a (checklist/regra/dose) é responsabilidade do 36A,
// que apenas acrescenta colunas sobre esta base — não duplica persistência da grade.

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

interface ValorPerfilInput {
  dia: number;
  ponto: string;
  valor_mgdl: number;
}

interface GradeInput {
  // Identificador opcional do perfil já existente (UPDATE com COALESCE)
  id?: string;
  // Campos do perfil glicêmico (todos COALESCE)
  tipo_perfil?: string | null;
  tipo_pos_prandial?: string | null;
  peso_paciente_kg?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  percentual_meta?: number | null;
  decisao?: string | null;
  dose_insulina_calculada?: number | null;
  // Valores da grade. Quando omitido (undefined), valores existentes ficam INTACTOS.
  // Quando enviado como array (inclusive vazio), substitui (delete+insert).
  valores?: ValorPerfilInput[];
}

// 36A REV3 — Motor de decisão da Ficha A (Retorno 2)
interface DecisaoFichaAInput {
  checklist_dieta?: boolean | null;
  checklist_exercicio?: boolean | null;
  checklist_ganho_peso?: boolean | null;
  checklist_pfe_us?: "sim" | "nao" | "sem_info" | null;
  checklist_ca?: "sim" | "nao" | "sem_info" | null;
  checklist_la?: "sim" | "nao" | "sem_info" | null;
  // Override opcional do percentual da meta (se omitido, usa o do perfil glicêmico)
  percentual_meta?: number | null;
  // Peso para cálculo da dose (se omitido, usa peso_paciente_kg do perfil)
  peso_paciente_kg?: number | null;
  // Desfechos secundários:
  memoria_glicosimetro?: "confirma" | "nao_confirma" | null;
  pactuacao_adesao?: "aceita" | "recusa" | null;
}

interface Payload {
  consulta_id?: string;
  paciente_id: string;
  modo: Modo;
  tipo?: string; // 'caso_novo' | 'retorno_1' | 'ficha_a' | 'ficha_b' | 'ficha_c' | 'ficha_d' | 'gtt' | 'registro_parto'
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
  // 34A.2 — grade genérica (perfil glicêmico + valores)
  grade?: GradeInput | null;
  // 36A REV3 — checklist + pactuação + memória da Ficha A
  decisao_ficha_a?: DecisaoFichaAInput | null;
}

// ============================================================
// 36A REV3 — Motor das 4 regras + roteamento
// ============================================================
type Regra = "regra_manter" | "regra_2" | "regra_3" | "regra_4";
type Conduta = "manter_mev" | "reforcar_mev" | "insulina" | "avaliar_memoria";
type ProximaFicha = "ficha_a" | "ficha_b" | "ficha_c" | "ficha_d" | "ficha_e";

interface ResultadoDecisao {
  regra_aplicada: Regra | null;
  conduta_gerada: Conduta | null;
  proxima_ficha_recomendada: ProximaFicha | null;
  dose_total: number | null;
  dose_manha: number | null;
  dose_noite: number | null;
  pendencias: string[];
}

function aplicarRegras(
  d: DecisaoFichaAInput,
  pct: number,
  peso: number | null,
  igSemanas: number | null,
): ResultadoDecisao {
  const adesao_ok =
    d.checklist_dieta === true && d.checklist_exercicio === true && d.checklist_ganho_peso === true;
  const adesao_falhou =
    d.checklist_dieta === false || d.checklist_exercicio === false || d.checklist_ganho_peso === false;
  const fetal_nao =
    d.checklist_pfe_us === "nao" || d.checklist_ca === "nao" || d.checklist_la === "nao";

  let regra: Regra | null = null;
  let conduta: Conduta | null = null;

  if (pct >= 70 && adesao_ok && !fetal_nao) {
    regra = "regra_manter";
    conduta = "manter_mev";
  } else if (pct < 70 && adesao_falhou) {
    regra = "regra_2";
    conduta = "reforcar_mev";
  } else if (pct < 70 && adesao_ok) {
    regra = "regra_3";
    conduta = "insulina";
  } else if (pct >= 70 && (adesao_falhou || fetal_nao)) {
    regra = "regra_4";
    conduta = "avaliar_memoria";
  }

  // Doses só quando o caminho clínico exige insulina
  let dose_total: number | null = null;
  let dose_manha: number | null = null;
  let dose_noite: number | null = null;

  const vaiParaInsulina =
    regra === "regra_3" ||
    (regra === "regra_2" && d.pactuacao_adesao === "recusa") ||
    (regra === "regra_4" && d.memoria_glicosimetro === "nao_confirma" && d.pactuacao_adesao === "recusa");

  if (vaiParaInsulina && peso && peso > 0) {
    dose_total = Math.round(0.5 * peso * 10) / 10;
    dose_manha = Math.round((dose_total * 2) / 3 * 10) / 10;
    dose_noite = Math.round(dose_total / 3 * 10) / 10;
  }

  // ROTEAMENTO — próxima ficha
  let proxima: ProximaFicha | null = null;
  const ig30 = igSemanas != null ? igSemanas <= 30 : null;
  const ac = (a: ProximaFicha, c: ProximaFicha): ProximaFicha | null =>
    ig30 == null ? null : (ig30 ? a : c);
  const bd = (): ProximaFicha | null => ac("ficha_b", "ficha_d");
  const semInsulinaAC = (): ProximaFicha | null => ac("ficha_a", "ficha_c");

  const pendencias: string[] = [];

  if (regra === "regra_manter") {
    proxima = semInsulinaAC();
  } else if (regra === "regra_2") {
    if (d.pactuacao_adesao === "aceita") proxima = semInsulinaAC();
    else if (d.pactuacao_adesao === "recusa") proxima = bd();
    else pendencias.push("pactuacao_adesao");
  } else if (regra === "regra_3") {
    proxima = bd();
  } else if (regra === "regra_4") {
    if (d.memoria_glicosimetro === "confirma") {
      proxima = "ficha_e";
    } else if (d.memoria_glicosimetro === "nao_confirma") {
      if (d.pactuacao_adesao === "aceita") proxima = semInsulinaAC();
      else if (d.pactuacao_adesao === "recusa") proxima = bd();
      else pendencias.push("pactuacao_adesao");
    } else {
      pendencias.push("memoria_glicosimetro");
    }
  }

  if (proxima == null && regra && pendencias.length === 0 && ig30 == null) {
    pendencias.push("ig_para_roteamento");
  }

  return {
    regra_aplicada: regra,
    conduta_gerada: conduta,
    proxima_ficha_recomendada: proxima,
    dose_total,
    dose_manha,
    dose_noite,
    pendencias,
  };
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
    // UPSERT consultas (COALESCE via UPDATE … COALESCE no servidor)
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
      // 🔒 verifica que a consulta pertence à paciente do body
      const { data: atual } = await admin
        .from("consultas")
        .select("data, ig_semanas, ig_dias, cenario_clinico, observacoes, status_ficha, paciente_id, profissional_id")
        .eq("id", consultaId)
        .maybeSingle();
      if (!atual) return jsonResp({ error: "Consulta não encontrada" }, 404);
      if (atual.paciente_id !== body.paciente_id || atual.profissional_id !== prof.id) {
        return jsonResp({ error: "Sem permissão para alterar esta consulta" }, 403);
      }

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
        .eq("id", consultaId)
        .eq("paciente_id", body.paciente_id)
        .eq("profissional_id", prof.id);
      if (updErr) return jsonResp({ error: "Erro ao atualizar consulta", details: updErr.message }, 500);
    }

    // ============================================================
    // Exame de glicemia (opcional)
    // ============================================================
    if (body.exame_glicemia) {
      const eg = body.exame_glicemia;
      if (eg.id) {
        // 🔒 Verifica que o exame pertence à paciente do body E ao profissional autenticado
        const { data: atualEg } = await admin
          .from("exames_glicemia")
          .select("valor_mgdl, tipo_exame, data_exame, ig_semanas_na_data, ig_dias_na_data, paciente_id, profissional_id")
          .eq("id", eg.id)
          .maybeSingle();
        if (!atualEg) {
          return jsonResp({ error: "Exame não encontrado" }, 404);
        }
        if (atualEg.paciente_id !== body.paciente_id || atualEg.profissional_id !== prof.id) {
          return jsonResp({ error: "Sem permissão para alterar este exame" }, 403);
        }
        const updEg: Record<string, unknown> = {
          valor_mgdl: eg.valor_mgdl ?? atualEg.valor_mgdl,
          tipo_exame: eg.tipo_exame ?? atualEg.tipo_exame,
          data_exame: eg.data_exame ?? atualEg.data_exame,
          ig_semanas_na_data: eg.ig_semanas_na_data ?? atualEg.ig_semanas_na_data,
          ig_dias_na_data: eg.ig_dias_na_data ?? atualEg.ig_dias_na_data,
        };
        await admin
          .from("exames_glicemia")
          .update(updEg)
          .eq("id", eg.id)
          .eq("paciente_id", body.paciente_id)
          .eq("profissional_id", prof.id);

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
    // 34A.2 — Grade glicêmica genérica (perfis_glicemicos + valores_perfil)
    // COALESCE: campo ausente NÃO sobrescreve; valores ausentes NÃO apagam.
    // ============================================================
    if (body.grade !== undefined && body.grade !== null && consultaId) {
      const g = body.grade;

      // Resolve perfil_id: usa o id enviado OU busca o perfil existente da consulta
      let perfilId: string | null = g.id ?? null;
      let perfilAtual: Record<string, unknown> | null = null;

      if (perfilId) {
        const { data } = await admin
          .from("perfis_glicemicos")
          .select("id, paciente_id, profissional_id, tipo_perfil, tipo_pos_prandial, peso_paciente_kg, data_inicio, data_fim, percentual_meta, decisao, dose_insulina_calculada")
          .eq("id", perfilId)
          .maybeSingle();
        if (!data) return jsonResp({ error: "Perfil glicêmico não encontrado" }, 404);
        if (data.paciente_id !== body.paciente_id || data.profissional_id !== prof.id) {
          return jsonResp({ error: "Sem permissão para alterar este perfil" }, 403);
        }
        perfilAtual = data;
      } else {
        // Procura um perfil já existente para esta consulta (1:1 por consulta)
        const { data } = await admin
          .from("perfis_glicemicos")
          .select("id, paciente_id, profissional_id, tipo_perfil, tipo_pos_prandial, peso_paciente_kg, data_inicio, data_fim, percentual_meta, decisao, dose_insulina_calculada")
          .eq("consulta_id", consultaId)
          .maybeSingle();
        if (data) {
          if (data.paciente_id !== body.paciente_id || data.profissional_id !== prof.id) {
            return jsonResp({ error: "Sem permissão para alterar perfil da consulta" }, 403);
          }
          perfilId = data.id as string;
          perfilAtual = data;
        }
      }

      if (perfilId && perfilAtual) {
        // UPDATE COALESCE — só sobrescreve quando o cliente enviou explicitamente
        const updPerfil: Record<string, unknown> = {
          tipo_perfil: g.tipo_perfil ?? (perfilAtual.tipo_perfil as unknown),
          peso_paciente_kg: g.peso_paciente_kg ?? (perfilAtual.peso_paciente_kg as unknown),
          data_inicio: g.data_inicio ?? (perfilAtual.data_inicio as unknown),
          data_fim: g.data_fim ?? (perfilAtual.data_fim as unknown),
          percentual_meta: g.percentual_meta ?? (perfilAtual.percentual_meta as unknown),
          decisao: g.decisao ?? (perfilAtual.decisao as unknown),
          dose_insulina_calculada: g.dose_insulina_calculada ?? (perfilAtual.dose_insulina_calculada as unknown),
          // tipo_pos_prandial é imutável após criação (trigger BEFORE UPDATE) — não atualizar.
        };
        const { error: perfUpdErr } = await admin
          .from("perfis_glicemicos")
          .update(updPerfil)
          .eq("id", perfilId);
        if (perfUpdErr) {
          return jsonResp({ error: "Erro ao atualizar perfil glicêmico", details: perfUpdErr.message }, 500);
        }
      } else {
        // INSERT — só cria se houver dados mínimos (data_inicio + data_fim)
        const data_inicio = g.data_inicio ?? campos.data ?? new Date().toISOString().slice(0, 10);
        const data_fim = g.data_fim ?? data_inicio;
        const insPerfil: Record<string, unknown> = {
          consulta_id: consultaId,
          paciente_id: body.paciente_id,
          profissional_id: prof.id,
          tipo_perfil: g.tipo_perfil ?? "4_pontos",
          tipo_pos_prandial: g.tipo_pos_prandial ?? "1h",
          peso_paciente_kg: g.peso_paciente_kg ?? null,
          data_inicio,
          data_fim,
          percentual_meta: g.percentual_meta ?? 0,
          decisao: g.decisao ?? null,
          dose_insulina_calculada: g.dose_insulina_calculada ?? null,
        };
        const { data: novoPerfil, error: perfInsErr } = await admin
          .from("perfis_glicemicos")
          .insert(insPerfil)
          .select("id")
          .single();
        if (perfInsErr || !novoPerfil) {
          return jsonResp({ error: "Erro ao criar perfil glicêmico", details: perfInsErr?.message }, 500);
        }
        perfilId = novoPerfil.id as string;
      }

      // Valores da grade: só substitui se o cliente ENVIOU o array explicitamente.
      // Omitir g.valores preserva os valores já gravados (proteção COALESCE).
      if (Array.isArray(g.valores) && perfilId) {
        const valoresLimpos = g.valores
          .filter((v) => v && typeof v.valor_mgdl === "number" && v.valor_mgdl > 0)
          .map((v) => ({
            perfil_id: perfilId,
            dia: v.dia,
            ponto: v.ponto,
            valor_mgdl: v.valor_mgdl,
          }));

        const { error: delErr } = await admin
          .from("valores_perfil")
          .delete()
          .eq("perfil_id", perfilId);
        if (delErr) {
          return jsonResp({ error: "Erro ao limpar valores da grade", details: delErr.message }, 500);
        }
        if (valoresLimpos.length > 0) {
          const { error: insValErr } = await admin
            .from("valores_perfil")
            .insert(valoresLimpos);
          if (insValErr) {
            return jsonResp({ error: "Erro ao inserir valores da grade", details: insValErr.message }, 500);
          }
        }
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

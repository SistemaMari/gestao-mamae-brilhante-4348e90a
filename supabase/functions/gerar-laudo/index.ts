// Edge function: gerar-laudo (v3 — textos fixos, sem IA)
// Refatoração 34D-A: a geração de Blocos 2 e 3 do laudo deixa de chamar a
// API Gemini (Lovable AI Gateway) e passa a ler textos fixos publicados
// pelo time clínico na tabela `laudo_textos`. Os dados clínicos da paciente
// (nome, IG, glicemias) continuam sendo injetados pelo template do PDF a
// partir de `metadata`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  modulosParaCenario,
  normalizarCenario,
  derivarFichaTipo,
  semProximaConsulta,
  type CenarioId,
} from "./prompt-v52.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Feature flag operacional — quando 'false', bloqueia geração mesmo se textos existirem.
const LAUDO_GERACAO_ATIVA =
  (Deno.env.get("LAUDO_GERACAO_ATIVA") ?? "true").toLowerCase() !== "false";

// ── helpers ────────────────────────────────────────────────────────

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// 34C-A: IG é derivada AO VIVO pela função SQL `calcular_ig`, que é a fonte
// única (lê pacientes.referencia_ig + referencia_usg_id|dum). Nenhum cálculo
// local de IG deve coexistir aqui — qualquer divergência seria bug.
// `p_data_alvo` é SEMPRE a data da consulta que gera o laudo, nunca `new Date()`,
// para que o laudo reflita a IG correta na data da consulta (não a IG "de hoje").
type IgCalculada = {
  semanas: number;
  dias: number;
  origem: string;      // 'DUM' | 'USG #N'
  base_data: string;   // 'YYYY-MM-DD'
};

async function calcularIgViaRpc(
  supabaseAdmin: any,
  paciente_id: string,
  data_consulta: string,
): Promise<{ ok: true; ig: IgCalculada } | { ok: false; motivo: string }> {
  const { data, error } = await supabaseAdmin.rpc("calcular_ig", {
    p_paciente_id: paciente_id,
    p_data_alvo: data_consulta,
  });
  if (error) {
    return { ok: false, motivo: `Erro ao calcular IG: ${error.message}` };
  }
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha || linha.semanas == null) {
    return { ok: false, motivo: "Referência de IG não definida para esta paciente (sem USG de referência e sem DUM, ou data da consulta anterior à base)." };
  }
  return {
    ok: true,
    ig: {
      semanas: Number(linha.semanas),
      dias: Number(linha.dias),
      origem: String(linha.origem),
      base_data: String(linha.base_data),
    },
  };
}

function calcularProximaConsulta(cenario: CenarioId, igSemanas: number | null) {
  if (semProximaConsulta(cenario)) return { prazo_dias: null, data_formatada: null };
  let prazo = 21;
  if (igSemanas !== null) {
    if (igSemanas >= 32) prazo = 7;
    else if (igSemanas >= 28) prazo = 14;
  }
  const data = new Date();
  data.setDate(data.getDate() + prazo);
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const yyyy = data.getFullYear();
  return { prazo_dias: prazo, data_formatada: `${dd}/${mm}/${yyyy}` };
}

// Busca textos fixos publicados para (tipo_consulta + desfecho_clinico).
// Equivalente em SQL à Edge Function obter-textos-laudo — invocada inline
// para evitar round-trip e propagação de header.
async function obterTextosLaudo(
  supabaseAdmin: any,
  tipo_consulta: string,
  desfecho_clinico: string,
): Promise<
  | { completo: true; textos: Array<{ bloco: string; ordem_bloco: number; titulo_bloco: string | null; texto: string; versao: number }> }
  | { completo: false; blocos_faltantes: string[]; mensagem: string }
> {
  const { data, error } = await supabaseAdmin
    .from("laudo_textos")
    .select("bloco, ordem_bloco, titulo_bloco, texto, versao")
    .eq("tipo_consulta", tipo_consulta)
    .eq("desfecho_clinico", desfecho_clinico)
    .eq("status", "publicado")
    .order("ordem_bloco", { ascending: true });

  if (error) throw new Error(`Erro ao ler laudo_textos: ${error.message}`);

  if (!data || data.length === 0) {
    return {
      completo: false,
      blocos_faltantes: ["*"],
      mensagem: "Nenhum texto publicado para esta combinação — solicitar ao time clínico.",
    };
  }

  return { completo: true, textos: data };
}

// ── handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Body
    const { paciente_id, consulta_id, cenario_clinico: cenarioBody } = await req.json();
    if (!paciente_id || !consulta_id) {
      return jsonResp({ error: "paciente_id e consulta_id obrigatórios" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 🔒 Ownership check via cliente autenticado (respeita RLS).
    // Garante que o profissional autenticado tem acesso à paciente e à consulta
    // ANTES de qualquer leitura/escrita via service_role.
    const { data: pacienteAcesso, error: pacAcessoErr } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", paciente_id)
      .maybeSingle();
    if (pacAcessoErr || !pacienteAcesso) {
      return jsonResp({ error: "Acesso negado à paciente" }, 403);
    }

    const { data: consultaAcesso, error: consAcessoErr } = await supabase
      .from("consultas")
      .select("id")
      .eq("id", consulta_id)
      .eq("paciente_id", paciente_id)
      .maybeSingle();
    if (consAcessoErr || !consultaAcesso) {
      return jsonResp({ error: "Acesso negado à consulta" }, 403);
    }



    // Carrega dados clínicos da paciente (continuam sendo injetados no PDF)
    const [
      { data: profissional },
      { data: paciente },
      { data: consultas },
      { data: exames },
      { data: laudosAnteriores },
      { data: perfilMaisRecente },
    ] = await Promise.all([
      supabaseAdmin.from("profissionais").select("*").eq("user_id", userId).single(),
      supabaseAdmin.from("pacientes").select("*").eq("id", paciente_id).single(),
      supabaseAdmin
        .from("consultas")
        .select("*")
        .eq("paciente_id", paciente_id)
        .order("numero_sequencial", { ascending: true }),
      supabaseAdmin.from("exames_glicemia").select("*").eq("paciente_id", paciente_id).order("data_exame", { ascending: true }),
      supabaseAdmin
        .from("laudos")
        .select("id, cenario_clinico, conteudo_laudo, created_at")
        .eq("paciente_id", paciente_id)
        .neq("consulta_id", consulta_id)
        .order("created_at"),
      supabaseAdmin
        .from("perfis_glicemicos")
        .select("tipo_perfil, tipo_pos_prandial, percentual_meta, decisao, data_inicio, data_fim")
        .eq("paciente_id", paciente_id)
        .order("data_fim", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!profissional) return jsonResp({ error: "Profissional não encontrado" }, 404);
    if (!paciente) return jsonResp({ error: "Paciente não encontrado" }, 404);

    const consultaAtual = consultas?.find((c: any) => c.id === consulta_id);
    if (!consultaAtual) return jsonResp({ error: "Consulta não encontrada" }, 404);

    // Bloqueia se ficha não está completa
    if (consultaAtual.status_ficha && !["completa", "laudo_gerado"].includes(consultaAtual.status_ficha)) {
      const faltantes: string[] = [];
      if (!consultaAtual.data) faltantes.push("data");
      if (consultaAtual.ig_semanas == null) faltantes.push("ig_semanas");
      if (consultaAtual.ig_dias == null) faltantes.push("ig_dias");
      if (!consultaAtual.cenario_clinico) faltantes.push("cenario_clinico");
      return jsonResp({
        error: "ficha_incompleta",
        details: "A ficha precisa estar com status 'completa' antes de gerar o laudo.",
        status_ficha: consultaAtual.status_ficha,
        faltantes,
      }, 422);
    }

    // Feature flag de release
    if (!LAUDO_GERACAO_ATIVA) {
      return jsonResp({
        erro: "TEXTOS_PENDENTES",
        mensagem: "Geração de laudo temporariamente desativada (LAUDO_GERACAO_ATIVA=false).",
        blocos_faltantes: ["*"],
      }, 422);
    }

    // Quota
    const { data: quota, error: quotaErr } = await supabaseAdmin.rpc("pode_gerar_laudo", { p_profissional_id: profissional.id });
    if (quotaErr) return jsonResp({ error: "Erro ao verificar quota", details: quotaErr.message }, 500);
    if (quota && (quota as any).allowed === false) {
      return jsonResp({ error: "Limite de laudos atingido", laudos_limite: (quota as any).laudos_limite }, 402);
    }

    // Cenário e ficha_tipo
    const cenarioId = normalizarCenario(consultaAtual.cenario_clinico) ?? normalizarCenario(cenarioBody);
    if (!cenarioId) {
      return jsonResp({ error: "Cenário clínico inválido ou ausente", recebido: consultaAtual.cenario_clinico ?? cenarioBody ?? null }, 400);
    }

    if (!consultaAtual.cenario_clinico && cenarioId) {
      await supabaseAdmin.from("consultas").update({ cenario_clinico: cenarioId }).eq("id", consulta_id);
    }

    const fichaTipo = derivarFichaTipo(consultaAtual.tipo);

    // 34C-A: IG ao vivo a partir da função única `calcular_ig`, com a DATA DA
    // CONSULTA como p_data_alvo (não "hoje"). Se não der pra calcular (sem âncora),
    // bloqueia explicitamente — nada de fallback silencioso baseado em new Date().
    if (!consultaAtual.data) {
      return jsonResp({
        error: "data_consulta_ausente",
        details: "A consulta não tem data preenchida — impossível calcular a IG.",
      }, 422);
    }
    const igResult = await calcularIgViaRpc(supabaseAdmin, paciente_id, consultaAtual.data);
    if (!igResult.ok) {
      return jsonResp({
        error: "ig_indisponivel",
        details: igResult.motivo,
      }, 422);
    }
    const igAtual = igResult.ig;
    const proximaConsulta = calcularProximaConsulta(cenarioId, igAtual.semanas);

    // ── Núcleo da refatoração: lê textos fixos em vez de chamar IA ──
    const tipoConsulta = String(consultaAtual.tipo);
    const desfechoClinico = cenarioId; // cenario_clinico funciona como desfecho consolidado

    const resultado = await obterTextosLaudo(supabaseAdmin, tipoConsulta, desfechoClinico);

    if (!resultado.completo) {
      return jsonResp({
        erro: "TEXTOS_PENDENTES",
        mensagem: "Texto pendente — solicitar ao time clínico",
        tipo_consulta: tipoConsulta,
        desfecho_clinico: desfechoClinico,
        blocos_faltantes: resultado.blocos_faltantes,
      }, 422);
    }

    // Roteamento informativo de módulos (mantido para metadata do PDF)
    const arquivosAlvo = modulosParaCenario(cenarioId);

    // Concatena textos para o campo legado `conteudo_laudo` (mantém compatibilidade
    // com o template atual de PDF). Estrutura completa fica em metadata.blocos_textos.
    const conteudoConcatenado = resultado.textos
      .map((b) => (b.titulo_bloco ? `## ${b.titulo_bloco}\n\n${b.texto}` : b.texto))
      .join("\n\n");

    const { data: laudo, error: laudoErr } = await supabaseAdmin
      .from("laudos")
      .insert({
        paciente_id,
        consulta_id,
        profissional_id: profissional.id,
        cenario_clinico: cenarioId,
        status: "gerado",
        conteudo_laudo: conteudoConcatenado,
        metadata: {
          ficha_tipo: fichaTipo,
          ig_atual: igAtual,
          proxima_consulta: proximaConsulta,
          origem_texto: "laudo_textos",
          tipo_consulta: tipoConsulta,
          desfecho_clinico: desfechoClinico,
          // 35A — Pactuação pós-prandial: nos cenários que usam perfil glicêmico
          // (2, 3, 4 e 7), expor a janela pactuada e a meta aplicada para que o
          // Bloco 2 do laudo cite a meta correta (<140 mg/dL para 1h; <120 para 2h).
          // Jejum e pré-prandiais inalterados.
          pactuacao_pos_prandial: ["2", "3", "4", "7"].includes(cenarioId) && perfilMaisRecente
            ? {
                janela: perfilMaisRecente.tipo_pos_prandial as "1h" | "2h",
                meta_mg_dl: perfilMaisRecente.tipo_pos_prandial === "2h" ? 120 : 140,
                tipo_perfil: perfilMaisRecente.tipo_perfil,
              }
            : null,
          blocos_textos: resultado.textos,
          modulos_referencia: arquivosAlvo,
          dados_paciente: {
            nome: paciente.nome,
            data_nascimento: paciente.data_nascimento,
            dum: paciente.dum,
            usg: { data: paciente.usg_data, ig_semanas: paciente.usg_ig_semanas, ig_dias: paciente.usg_ig_dias },
            ig_atual: igAtual,
            dmg_gestacao_anterior: paciente.dmg_gestacao_anterior,
          },
          profissional: {
            nome: profissional.nome,
            crm: profissional.crm,
            especialidade: profissional.especialidade,
          },
          consulta_atual: {
            id: consultaAtual.id,
            tipo: consultaAtual.tipo,
            data: consultaAtual.data,
            // 34C-A: alinhado à fonte única (calcular_ig na data_alvo = data da
            // consulta). Não usar consultaAtual.ig_semanas/ig_dias, que podem
            // ter sido escritos antes pela ficha e divergir da âncora atual.
            ig_semanas: igAtual.semanas,
            ig_dias: igAtual.dias,
          },
        },
      })
      .select()
      .single();

    if (laudoErr || !laudo) {
      return jsonResp({ error: "Erro ao criar laudo", details: laudoErr?.message }, 500);
    }

    // Marca consulta como laudo_gerado
    await supabaseAdmin
      .from("consultas")
      .update({ status_ficha: "laudo_gerado" })
      .eq("id", consulta_id);

    if (profissional.unidade_id) {
      await supabaseAdmin.from("registros_atendimento").insert({
        paciente_id,
        profissional_id: profissional.id,
        unidade_id: profissional.unidade_id,
        tipo_operacao: "gerar_laudo",
        recurso_id: laudo.id,
        recurso_tipo: "laudo",
        profissional_nome: profissional.nome,
        profissional_crm: profissional.crm,
        profissional_especialidade: profissional.especialidade,
      });
    }

    return jsonResp({
      success: true,
      laudo_id: laudo.id,
      cenario: cenarioId,
      ficha_tipo: fichaTipo,
      proxima_consulta: proximaConsulta,
      origem_texto: "laudo_textos",
      blocos: resultado.textos.map((b) => b.bloco),
    }, 201);
  } catch (error) {
    return jsonResp({ error: "Erro interno", details: (error as Error).message }, 500);
  }
});

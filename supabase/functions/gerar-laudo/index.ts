// Edge function: gerar-laudo (v2 - getUser fix)
// Gera Blocos 2 e 3 do laudo de DMG via Lovable AI Gateway (Gemini 2.5 Flash)
// usando o System Prompt MARI v5.2 + arquivos da Base de Conhecimento como anexos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  SYSTEM_PROMPT_MARI_V52,
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

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // rápido e econômico para geração de laudos

// ── helpers ────────────────────────────────────────────────────────

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calcularIG(dum: string | null, usgData: string | null, usgSemanas: number | null, usgDias: number | null) {
  // Prioriza USG corrigida quando presente
  const hoje = new Date();
  if (usgData && (usgSemanas !== null || usgDias !== null)) {
    const [y, m, d] = usgData.split("-").map(Number);
    const dataUsg = new Date(y, m - 1, d);
    const diff = Math.floor((hoje.getTime() - dataUsg.getTime()) / 86400000);
    const totalDias = (usgSemanas ?? 0) * 7 + (usgDias ?? 0) + diff;
    return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7, total_dias: totalDias, fonte: "usg" };
  }
  if (dum) {
    const [y, m, d] = dum.split("-").map(Number);
    const dataDum = new Date(y, m - 1, d);
    const diff = Math.floor((hoje.getTime() - dataDum.getTime()) / 86400000);
    return { semanas: Math.floor(diff / 7), dias: diff % 7, total_dias: diff, fonte: "dum" };
  }
  return null;
}

function calcularProximaConsulta(cenario: CenarioId, igSemanas: number | null) {
  if (semProximaConsulta(cenario)) {
    return { prazo_dias: null, data_formatada: null };
  }
  // Heurística: se IG ≥ 32 sem → 7 dias; se ≥ 28 → 14 dias; senão 21 dias.
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

async function bucketFileToDataUrl(supabaseAdmin: any, path: string): Promise<{ name: string; dataUrl: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from("base-conhecimento").download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
    return { name: path, dataUrl: `data:${mime};base64,${b64}` };
  } catch {
    return null;
  }
}

function extrairObjetoJson(texto: string): string | null {
  const limpo = texto.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const inicio = limpo.indexOf("{");
  if (inicio < 0) return null;

  let profundidade = 0;
  let emString = false;
  let escape = false;

  for (let i = inicio; i < limpo.length; i++) {
    const ch = limpo[i];
    if (emString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') emString = false;
      continue;
    }
    if (ch === '"') emString = true;
    else if (ch === "{") profundidade++;
    else if (ch === "}") {
      profundidade--;
      if (profundidade === 0) return limpo.slice(inicio, i + 1);
    }
  }
  return null;
}

function parseLaudoJson(texto: string): any | null {
  const candidato = extrairObjetoJson(texto);
  if (!candidato) return null;

  const tentativas = [
    candidato,
    candidato.replace(/,\s*([}\]])/g, "$1"),
  ];

  for (const tentativa of tentativas) {
    try {
      return JSON.parse(tentativa);
    } catch {
      // tenta a próxima variação
    }
  }
  return null;
}

function laudoTemBlocosValidos(parsed: any) {
  return typeof parsed?.bloco_2_justificativa === "string" &&
    parsed.bloco_2_justificativa.trim().length > 30 &&
    typeof parsed?.bloco_3_conduta === "string" &&
    parsed.bloco_3_conduta.trim().length > 30;
}

function limparTextoIA(texto: string) {
  return texto
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResp({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Body
    const { paciente_id, consulta_id, cenario_clinico: cenarioBody } = await req.json();
    if (!paciente_id || !consulta_id) return jsonResp({ error: "paciente_id e consulta_id obrigatórios" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega dados
    const [{ data: profissional }, { data: paciente }, { data: consultas }, { data: exames }, { data: laudosAnteriores }] = await Promise.all([
      supabaseAdmin.from("profissionais").select("*").eq("user_id", userId).single(),
      supabaseAdmin.from("pacientes").select("*").eq("id", paciente_id).single(),
      supabaseAdmin.from("consultas").select("*").eq("paciente_id", paciente_id).order("numero_sequencial", { ascending: true }),
      supabaseAdmin.from("exames_glicemia").select("*").eq("paciente_id", paciente_id).order("data_exame", { ascending: true }),
      supabaseAdmin.from("laudos").select("id, cenario_clinico, conteudo_laudo, created_at").eq("paciente_id", paciente_id).neq("consulta_id", consulta_id).order("created_at"),
    ]);

    if (!profissional) return jsonResp({ error: "Profissional não encontrado" }, 404);
    if (!paciente) return jsonResp({ error: "Paciente não encontrado" }, 404);

    const consultaAtual = consultas?.find((c: any) => c.id === consulta_id);
    if (!consultaAtual) return jsonResp({ error: "Consulta não encontrada" }, 404);

    // Verifica e consome quota de laudos
    const { data: quota, error: quotaErr } = await supabaseAdmin.rpc("pode_gerar_laudo", { p_profissional_id: profissional.id });
    if (quotaErr) return jsonResp({ error: "Erro ao verificar quota", details: quotaErr.message }, 500);
    if (quota && (quota as any).allowed === false) {
      return jsonResp({ error: "Limite de laudos atingido", laudos_limite: (quota as any).laudos_limite }, 402);
    }

    // Normaliza cenário e ficha_tipo — aceita do body como fallback
    const cenarioId = normalizarCenario(consultaAtual.cenario_clinico) ?? normalizarCenario(cenarioBody);
    if (!cenarioId) return jsonResp({ error: "Cenário clínico inválido ou ausente", recebido: consultaAtual.cenario_clinico ?? cenarioBody ?? null }, 400);

    // Persiste o cenário na consulta caso veio só do body
    if (!consultaAtual.cenario_clinico && cenarioId) {
      await supabaseAdmin.from("consultas").update({ cenario_clinico: cenarioId }).eq("id", consulta_id);
    }

    const fichaTipo = derivarFichaTipo(consultaAtual.tipo);

    // IG atual
    const igAtual = calcularIG(paciente.dum, paciente.usg_data, paciente.usg_ig_semanas, paciente.usg_ig_dias);
    const proximaConsulta = calcularProximaConsulta(cenarioId, igAtual?.semanas ?? null);

    // Roteamento de módulos: confere disponibilidade sem anexar PDFs grandes à IA.
    // PDFs em base64 estouravam CPU/contexto e causavam respostas JSON truncadas.
    const arquivosAlvo = modulosParaCenario(cenarioId);
    const { data: storageItems } = await supabaseAdmin.storage.from("base-conhecimento").list("", { limit: 100 });
    const nomesDisponiveis = new Set((storageItems ?? []).map((item: any) => item.name));
    const arquivosBaixados = arquivosAlvo
      .filter((name) => nomesDisponiveis.has(name))
      .map((name) => ({ name, dataUrl: "" }));
    const arquivosFaltantes = arquivosAlvo.filter((p) => !nomesDisponiveis.has(p));

    // Bloqueia se PROTOCOLO ausente (Bloco 2 é impossível sem ele)
    if (!arquivosBaixados.find((a) => a.name === "PROTOCOLO_DMG_Brasil_2016.pdf")) {
      return jsonResp({
        error: "Base de Conhecimento incompleta",
        details: "O PROTOCOLO_DMG_Brasil_2016.pdf é obrigatório para gerar qualquer laudo. Peça ao admin para fazer o upload em /admin/base-conhecimento.",
        arquivos_faltantes: arquivosFaltantes,
      }, 412);
    }

    // Cria laudo "processando"
    const { data: laudo, error: laudoErr } = await supabaseAdmin
      .from("laudos")
      .insert({
        paciente_id,
        consulta_id,
        profissional_id: profissional.id,
        cenario_clinico: cenarioId,
        status: "processando",
        metadata: { ficha_tipo: fichaTipo, ig_atual: igAtual, proxima_consulta: proximaConsulta, arquivos_faltantes: arquivosFaltantes },
      })
      .select()
      .single();

    if (laudoErr || !laudo) return jsonResp({ error: "Erro ao criar laudo", details: laudoErr?.message }, 500);

    // Payload de dados clínicos enviado como user message
    const dadosClinicosPayload = {
      cenario_clinico: cenarioId,
      ficha_tipo: fichaTipo,
      proxima_consulta: proximaConsulta,
      dados_paciente: {
        nome: paciente.nome,
        data_nascimento: paciente.data_nascimento,
        dum: paciente.dum,
        usg: { data: paciente.usg_data, ig_semanas: paciente.usg_ig_semanas, ig_dias: paciente.usg_ig_dias },
        ig_atual: igAtual,
        dmg_gestacao_anterior: paciente.dmg_gestacao_anterior,
        status_ficha: paciente.status_ficha,
      },
      consulta_atual: consultaAtual,
      historico_consultas: consultas,
      exames_glicemia: exames,
      laudos_anteriores: laudosAnteriores,
      profissional: { nome: profissional.nome, crm: profissional.crm, especialidade: profissional.especialidade },
      arquivos_de_contexto: arquivosBaixados.map((a) => a.name),
    };

    // Monta mensagem multimodal: texto + PDFs como image_url (Gemini aceita PDF assim no gateway)
    const buildTextPart = (modo: "json" | "texto") => ({
      type: "text",
      text: `${modo === "json"
        ? "Gere os Blocos 2 e 3 do laudo conforme suas regras. Retorne APENAS um JSON válido com as chaves bloco_2_justificativa e bloco_3_conduta."
        : "Gere os Blocos 2 e 3 do laudo conforme suas regras, mas NÃO use JSON. Responda em texto com os marcadores exatos: BLOCO_2: e BLOCO_3:."}

Dados clínicos:\n\n\`\`\`json\n${JSON.stringify(dadosClinicosPayload, null, 2)}\n\`\`\``,
    });
    const buildContent = (arquivos: Array<{ name: string; dataUrl: string }>, modo: "json" | "texto") => {
      const c: any[] = [buildTextPart(modo)];
      for (const arq of arquivos) c.push({ type: "image_url", image_url: { url: arq.dataUrl } });
      return c;
    };

    const callAI = async (arquivos: Array<{ name: string; dataUrl: string }>, modo: "json" | "texto" = "json") => {
      return await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT_MARI_V52 },
            { role: "user", content: buildContent(arquivos, modo) },
          ],
          ...(modo === "json" ? { response_format: { type: "json_object" } } : {}),
          max_tokens: 8192,
          temperature: 0.2,
        }),
      });
    };

    // Processa IA em BACKGROUND para evitar WORKER_RESOURCE_LIMIT.
    // Frontend faz polling no registro `laudos` pelo status.
    const processarLaudoEmBackground = async () => {
      try {
        let aiResp = await callAI([]);
        let errText = "";

        if (!aiResp.ok && aiResp.status >= 400 && aiResp.status < 500) {
          errText = await aiResp.text();
        }

        if (!aiResp.ok) {
          if (!errText) errText = await aiResp.text();
          await supabaseAdmin.from("laudos").update({
            status: "erro",
            metadata: { ...laudo.metadata, erro: `AI ${aiResp.status}: ${errText.slice(0, 500)}` },
          }).eq("id", laudo.id);
          return;
        }

        const lerConteudo = async (resp: Response) => {
          const json = await resp.json();
          return json.choices?.[0]?.message?.content ?? "";
        };

        let conteudoStr = await lerConteudo(aiResp);
        let parsed: any = parseLaudoJson(conteudoStr);

        if (!laudoTemBlocosValidos(parsed)) {
          const fallbackResp = await callAI([], "texto");
          if (fallbackResp.ok) {
            const fallbackText = limparTextoIA(await lerConteudo(fallbackResp));
            const bloco2Match = fallbackText.match(/BLOCO_2:\s*([\s\S]*?)(?=\n\s*BLOCO_3:|$)/i);
            const bloco3Match = fallbackText.match(/BLOCO_3:\s*([\s\S]*)$/i);
            if (bloco2Match?.[1]?.trim() && bloco3Match?.[1]?.trim()) {
              conteudoStr = fallbackText;
              parsed = {
                bloco_2_justificativa: bloco2Match[1].trim(),
                bloco_3_conduta: bloco3Match[1].trim(),
                referencias_citadas: [{ fonte: "Protocolo Brasileiro de DMG (2016) e módulos clínicos entregues", relevancia: "Base de conhecimento usada para geração dos Blocos 2 e 3" }],
                metadados_do_laudo: { fallback_texto_sem_json: true, cenario_processado: cenarioId },
              };
            }
          }
        }

        if (!laudoTemBlocosValidos(parsed)) {
          await supabaseAdmin.from("laudos").update({
            status: "erro",
            metadata: { ...laudo.metadata, erro: "JSON inválido retornado pela IA", raw: conteudoStr.slice(0, 2000) },
          }).eq("id", laudo.id);
          return;
        }

        await supabaseAdmin.from("laudos").update({
          conteudo_laudo: JSON.stringify(parsed),
          status: "gerado",
          metadata: { ...laudo.metadata, modelo: MODEL, arquivos_enviados: arquivosBaixados.map((a) => a.name), referencias: parsed.referencias_citadas, metadados_do_laudo: parsed.metadados_do_laudo },
        }).eq("id", laudo.id);

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
      } catch (e) {
        await supabaseAdmin.from("laudos").update({
          status: "erro",
          metadata: { ...laudo.metadata, erro: `Exceção: ${(e as Error).message}` },
        }).eq("id", laudo.id);
      }
    };

    // @ts-ignore EdgeRuntime existe no runtime Supabase
    EdgeRuntime.waitUntil(processarLaudoEmBackground());

    // Resposta imediata — frontend faz polling pelo laudo_id
    return jsonResp({
      success: true,
      processing: true,
      laudo_id: laudo.id,
      cenario: cenarioId,
      ficha_tipo: fichaTipo,
      proxima_consulta: proximaConsulta,
      arquivos_usados: arquivosBaixados.map((a) => a.name),
      arquivos_faltantes: arquivosAlvo.filter((p) => !arquivosBaixados.find((a) => a.name === p)),
    }, 202);

  } catch (error) {
    return jsonResp({ error: "Erro interno", details: (error as Error).message }, 500);
  }
});

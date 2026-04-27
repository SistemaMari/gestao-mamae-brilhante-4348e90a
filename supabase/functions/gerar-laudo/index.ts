// Edge function: gerar-laudo
// Gera Blocos 2 e 3 do laudo de DMG via Lovable AI Gateway (Gemini 2.5 Pro)
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
const MODEL = "google/gemini-2.5-pro"; // contexto longo + raciocínio para laudo clínico

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResp({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Body
    const { paciente_id, consulta_id } = await req.json();
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

    // Normaliza cenário e ficha_tipo
    const cenarioId = normalizarCenario(consultaAtual.cenario_clinico);
    if (!cenarioId) return jsonResp({ error: "Cenário clínico inválido ou ausente", recebido: consultaAtual.cenario_clinico }, 400);

    const fichaTipo = derivarFichaTipo(consultaAtual.tipo);

    // IG atual
    const igAtual = calcularIG(paciente.dum, paciente.usg_data, paciente.usg_ig_semanas, paciente.usg_ig_dias);
    const proximaConsulta = calcularProximaConsulta(cenarioId, igAtual?.semanas ?? null);

    // Cria laudo "processando"
    const { data: laudo, error: laudoErr } = await supabaseAdmin
      .from("laudos")
      .insert({
        paciente_id,
        consulta_id,
        profissional_id: profissional.id,
        cenario_clinico: cenarioId,
        status: "processando",
        metadata: { ficha_tipo: fichaTipo, ig_atual: igAtual, proxima_consulta: proximaConsulta },
      })
      .select()
      .single();

    if (laudoErr || !laudo) return jsonResp({ error: "Erro ao criar laudo", details: laudoErr?.message }, 500);

    // Roteamento de módulos: tenta baixar do bucket os PDFs pertinentes
    const arquivosAlvo = modulosParaCenario(cenarioId);
    const arquivosBaixados = (await Promise.all(arquivosAlvo.map((p) => bucketFileToDataUrl(supabaseAdmin, p))))
      .filter(Boolean) as Array<{ name: string; dataUrl: string }>;

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
    const userContent: any[] = [
      { type: "text", text: `Gere os Blocos 2 e 3 do laudo conforme suas regras. Dados clínicos:\n\n\`\`\`json\n${JSON.stringify(dadosClinicosPayload, null, 2)}\n\`\`\`` },
    ];
    for (const arq of arquivosBaixados) {
      userContent.push({ type: "image_url", image_url: { url: arq.dataUrl } });
    }

    // Chamada Lovable AI Gateway (não-streaming, queremos JSON completo)
    const aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_MARI_V52 },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      await supabaseAdmin.from("laudos").update({ status: "erro", metadata: { ...laudo.metadata, erro: `AI ${aiResp.status}: ${errText.slice(0, 500)}` } }).eq("id", laudo.id);
      if (aiResp.status === 429) return jsonResp({ error: "Limite de requisições à IA excedido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return jsonResp({ error: "Créditos da IA esgotados. Adicione fundos em Settings → Workspace → Usage." }, 402);
      return jsonResp({ error: "Erro na IA", status: aiResp.status, details: errText.slice(0, 500) }, 502);
    }

    const aiJson = await aiResp.json();
    const conteudoStr = aiJson.choices?.[0]?.message?.content ?? "";

    // Tenta parsear o JSON retornado
    let parsed: any = null;
    try { parsed = JSON.parse(conteudoStr); } catch {
      // tenta extrair bloco JSON entre {} caso o modelo embrulhe em texto
      const m = conteudoStr.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    if (!parsed?.bloco_2_justificativa || !parsed?.bloco_3_conduta) {
      await supabaseAdmin.from("laudos").update({
        status: "erro",
        metadata: { ...laudo.metadata, erro: "JSON inválido retornado pela IA", raw: conteudoStr.slice(0, 2000) },
      }).eq("id", laudo.id);
      return jsonResp({ error: "Resposta da IA inválida", raw: conteudoStr.slice(0, 500) }, 502);
    }

    // Salva o laudo final (conteudo_laudo = JSON serializado para preservar estrutura)
    await supabaseAdmin.from("laudos").update({
      conteudo_laudo: JSON.stringify(parsed),
      status: "gerado",
      metadata: { ...laudo.metadata, modelo: MODEL, arquivos_enviados: arquivosBaixados.map((a) => a.name), referencias: parsed.referencias_citadas, metadados_do_laudo: parsed.metadados_do_laudo },
    }).eq("id", laudo.id);

    return jsonResp({
      success: true,
      laudo_id: laudo.id,
      cenario: cenarioId,
      ficha_tipo: fichaTipo,
      proxima_consulta: proximaConsulta,
      bloco_2: parsed.bloco_2_justificativa,
      bloco_3: parsed.bloco_3_conduta,
      referencias: parsed.referencias_citadas,
      arquivos_usados: arquivosBaixados.map((a) => a.name),
      arquivos_faltantes: arquivosAlvo.filter((p) => !arquivosBaixados.find((a) => a.name === p)),
    });

  } catch (error) {
    return jsonResp({ error: "Erro interno", details: (error as Error).message }, 500);
  }
});

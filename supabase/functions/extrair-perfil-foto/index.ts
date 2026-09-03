// Edge function: extrair-perfil-foto
// MARI · Especificação de back-end — Extração de Perfil por Foto
//
// Lê a foto do controle glicêmico da gestante (papel manuscrito, formulário
// impresso etc.) via modelo de visão (Claude, Anthropic) e devolve os valores
// estruturados, indexados por data, para conferência do profissional. Nunca
// salva glicemia sozinha — quem grava é o fluxo de sempre, após confirmação.
//
// Etapa 3 do plano (bucket+SQL já feitos): responde com dados fixos enquanto
// ANTHROPIC_API_KEY não está configurado (depende do Raul) — isso já
// desbloqueia o front. Assim que o segredo existir no Supabase, a mesma
// função passa a chamar o modelo de verdade, sem precisar de novo deploy.

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

// ── Guarda 1 (custo) — interruptor de emergência. Mesmo padrão de
// LAUDO_GERACAO_ATIVA: em 'false', bloqueia sem precisar de deploy.
const EXTRACAO_FOTO_ATIVA =
  (Deno.env.get("EXTRACAO_FOTO_ATIVA") ?? "true").toLowerCase() !== "false";

// Teto de extrações por profissional por dia. Sugestão inicial do doc: 50.
const LIMITE_DIARIO_PADRAO = 50;
const LIMITE_DIARIO = Number(Deno.env.get("EXTRACAO_FOTO_LIMITE_DIARIO")) || LIMITE_DIARIO_PADRAO;

const BUCKET = "controles-glicemia";

const PONTOS = ["jejum", "pos_cafe", "pre_almoco", "pos_almoco", "pre_jantar", "pos_jantar"] as const;
type Ponto = (typeof PONTOS)[number];

const RES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["leituras", "incertos", "observacoes"],
  properties: {
    leituras: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["data"],
        properties: {
          data: { type: "string" },
          jejum: { type: ["integer", "null"] },
          pos_cafe: { type: ["integer", "null"] },
          pre_almoco: { type: ["integer", "null"] },
          pos_almoco: { type: ["integer", "null"] },
          pre_jantar: { type: ["integer", "null"] },
          pos_jantar: { type: ["integer", "null"] },
        },
      },
    },
    incertos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["data", "ponto", "motivo"],
        properties: {
          data: { type: "string" },
          ponto: { type: "string" },
          motivo: { type: "string" },
        },
      },
    },
    observacoes: { type: "array", items: { type: "string" } },
  },
} as const;

// Prompt versionado junto com a função — artefato de produto, calibrado
// contra fotos reais. Alterações passam pelo time de produto.
function montarPrompt(params: {
  pontos: readonly Ponto[];
  dataInicio: string;
  dataFim: string;
  janelaPos: "1h" | "2h";
}): string {
  const listaPontos = params.pontos.map((p) => `- ${p}`).join("\n");
  return `Você lê fotografias de controles de glicemia capilar preenchidos à mão por
gestantes em acompanhamento de diabetes gestacional. Devolve os valores em
formato estruturado, para conferência por um profissional de saúde.

O QUE ESPERAR
O papel é uma tabela com uma linha por dia e uma coluna por horário de
medição. Pode ser um formulário impresso, uma folha de caderno, uma tabela
desenhada à mão ou um papel de outro serviço. A caligrafia varia, a foto
pode estar torta, com sombra ou fora de foco.

O QUE EXTRAIR
Para cada dia legível, os valores destes pontos:
${listaPontos}
Período de interesse: de ${params.dataInicio} até ${params.dataFim}.
Pós-prandial pactuado nesta ficha: ${params.janelaPos} após a refeição.

REGRAS
1. NUNCA ADIVINHE. Este é o ponto mais importante. Se um número está
   borrado, rasurado, cortado pela borda, ambíguo entre dois dígitos ou
   escondido por sombra, devolva null e registre em "incertos" com o
   motivo. Um valor errado aqui altera a decisão de tratamento. Deixar em
   branco é sempre melhor que arriscar.
2. ALINHE PELA DATA. Use a data escrita na linha, não a posição dela.
   Se a data estiver sem ano, assuma o ano do período de interesse.
   Se um dia aparecer duas vezes, registre em "observacoes" e devolva a
   primeira ocorrência.
   Descarte linhas fora do período de interesse.
   Se o papel NÃO tiver datas, use a ordem das linhas a partir de
   ${params.dataInicio} e registre em "observacoes" que a data foi inferida.
3. MAPEIE OS RÓTULOS que encontrar para os nossos pontos:
   jejum       ← jejum, em jejum, ao acordar, antes do café, pré-café
   pos_cafe    ← após café, pós-café, depois do café, pós-desjejum
   pre_almoco  ← antes do almoço, pré-almoço
   pos_almoco  ← após almoço, pós-almoço, depois do almoço
   pre_jantar  ← antes do jantar, pré-jantar, antes da janta
   pos_jantar  ← após jantar, pós-jantar, depois da janta, ceia
   Coluna que não corresponda a nenhum destes (insulina, peso, pressão,
   observações) deve ser IGNORADA e citada em "observacoes".
4. CONFIRA A JANELA PÓS-PRANDIAL. Se o papel indicar um intervalo
   diferente de ${params.janelaPos} (por exemplo, marca 2h e a ficha é 1h),
   extraia os valores normalmente e registre um aviso em "observacoes".
   As metas mudam conforme a janela — quem decide é o profissional.
5. VALORES PLAUSÍVEIS: glicemia capilar entre 20 e 600 mg/dL, número
   inteiro. Fora dessa faixa, trate como incerto. Um valor de dois
   dígitos que poderia ser de três (ex.: "12" que talvez seja "125"
   cortado) é incerto, não é 12.
6. NÃO INTERPRETE CLINICAMENTE. Não diga se está bom ou ruim, não calcule
   médias, não sugira conduta. Só transcreva.
7. SEM GRADE NENHUMA na imagem: devolva "leituras" vazio e explique em
   "observacoes". Não tente inventar estrutura.
8. Escreva "incertos" e "observacoes" em português do Brasil, em
   linguagem direta, para um profissional de saúde ler na tela.`;
}

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function inicioDoDiaIso(): string {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
}

type Leitura = { data: string } & Partial<Record<Ponto, number | null>>;
type Incerto = { data: string; ponto: string; motivo: string };
type ResultadoModelo = {
  leituras: Leitura[];
  incertos: Incerto[];
  observacoes: string[];
  tokens_entrada: number;
  tokens_saida: number;
  custo_usd: number;
  modelo: string;
};

// Resposta fixa — mantém o front desbloqueado enquanto ANTHROPIC_API_KEY não
// existe (depende do Raul). Formato idêntico ao que o modelo real devolverá.
function respostaFixaDeExemplo(dataInicio: string): ResultadoModelo {
  return {
    leituras: [
      {
        data: dataInicio,
        jejum: 92,
        pos_cafe: 112,
        pos_almoco: 120,
        pos_jantar: 125,
        pre_almoco: null,
        pre_jantar: null,
      },
      {
        data: somarDias(dataInicio, 1),
        jejum: null,
        pos_cafe: 114,
        pos_almoco: 120,
        pos_jantar: 125,
        pre_almoco: null,
        pre_jantar: null,
      },
    ],
    incertos: [
      { data: somarDias(dataInicio, 1), ponto: "jejum", motivo: "rasura sobre o número (resposta de exemplo — ANTHROPIC_API_KEY não configurado)" },
    ],
    observacoes: [
      "Resposta de exemplo: ANTHROPIC_API_KEY ainda não configurado no Supabase. A função está respondendo dados fixos para não travar o desenvolvimento do front.",
    ],
    tokens_entrada: 0,
    tokens_saida: 0,
    custo_usd: 0,
    modelo: "stub-sem-chamada-real",
  };
}

// Preço por token do claude-opus-5 (USD). Ajustar se a tabela de preços mudar.
// Tabela oficial (set/2026): claude-opus-5 = US$ 5 / MTok entrada, US$ 25 / MTok saída.
// (Os valores 15/75 anteriores eram do Opus 4.1, já aposentado — infla o custo ~3x.)
const PRECO_ENTRADA_POR_TOKEN = 5 / 1_000_000;
const PRECO_SAIDA_POR_TOKEN = 25 / 1_000_000;

async function chamarModelo(params: {
  apiKey: string;
  imagemBase64: string;
  mediaType: string;
  prompt: string;
}): Promise<ResultadoModelo> {
  const corpo = {
    model: "claude-opus-5",
    // Teto amplo: o raciocínio (thinking) consome desse mesmo limite; com 4000 a
    // resposta podia voltar cortada e virar erro. 16000 dá folga para a grade.
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // A saída estruturada precisa do invólucro { type: "json_schema", schema }.
    // Passar o esquema cru (sem o "type") faz a API recusar o pedido com 400.
    output_config: { format: { type: "json_schema", schema: RES_JSON_SCHEMA }, effort: "high" },
    system: params.prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: params.mediaType, data: params.imagemBase64 },
          },
          {
            type: "text",
            text: "Leia a imagem anexada seguindo exatamente as regras do system prompt e devolva o JSON estruturado.",
          },
        ],
      },
    ],
  };

  // No máximo uma segunda tentativa, e só para falha de rede/429 — nunca para
  // erro de conteúdo (Guarda 1: repetição automática custa dinheiro).
  let ultimoErro: unknown = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(corpo),
      });

      if (resp.status === 429 && tentativa === 0) {
        ultimoErro = new Error("rate_limited");
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (!resp.ok) {
        const texto = await resp.text();
        throw new Error(`Anthropic API ${resp.status}: ${texto.slice(0, 300)}`);
      }

      const dados = await resp.json();
      const blocoTexto = Array.isArray(dados.content)
        ? dados.content.find((b: any) => b.type === "text")
        : null;
      const parsed = blocoTexto?.text ? JSON.parse(blocoTexto.text) : dados;

      const tokensEntrada = Number(dados.usage?.input_tokens ?? 0);
      const tokensSaida = Number(dados.usage?.output_tokens ?? 0);
      const custoUsd = tokensEntrada * PRECO_ENTRADA_POR_TOKEN + tokensSaida * PRECO_SAIDA_POR_TOKEN;

      return {
        leituras: Array.isArray(parsed.leituras) ? parsed.leituras : [],
        incertos: Array.isArray(parsed.incertos) ? parsed.incertos : [],
        observacoes: Array.isArray(parsed.observacoes) ? parsed.observacoes : [],
        tokens_entrada: tokensEntrada,
        tokens_saida: tokensSaida,
        custo_usd: Number(custoUsd.toFixed(5)),
        modelo: "claude-opus-5",
      };
    } catch (err) {
      ultimoErro = err;
      if (tentativa === 0 && err instanceof TypeError) {
        // Falha de rede — tenta mais uma vez.
        continue;
      }
      break;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha desconhecida ao chamar o modelo");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ ok: false, codigo: "method_not_allowed" }, 405);

  try {
    // ── Guarda 2 (autorização) ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ ok: false, codigo: "nao_autenticado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResp({ ok: false, codigo: "nao_autenticado" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body) return jsonResp({ ok: false, codigo: "corpo_invalido" }, 400);

    const {
      paciente_id: pacienteId,
      consulta_id: consultaId = null,
      storage_path: storagePath,
      tipo_perfil: tipoPerfil,
      janela_pos: janelaPos,
      data_inicio: dataInicio,
      dias,
    } = body as Record<string, unknown>;

    if (
      typeof pacienteId !== "string" ||
      typeof storagePath !== "string" ||
      (tipoPerfil !== "4_pontos" && tipoPerfil !== "6_pontos") ||
      (janelaPos !== "1h" && janelaPos !== "2h") ||
      typeof dataInicio !== "string" ||
      typeof dias !== "number"
    ) {
      return jsonResp({ ok: false, codigo: "corpo_invalido" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Profissional ativo dono da chamada (nunca confiar em paciente_id sem checar).
    const { data: profissional, error: profErro } = await supabaseAdmin
      .from("profissionais")
      .select("id, unidade_id, acesso_revogado")
      .eq("user_id", userId)
      .maybeSingle();
    if (profErro || !profissional || profissional.acesso_revogado) {
      return jsonResp({ ok: false, codigo: "paciente_nao_vinculada" }, 403);
    }

    // Ownership da paciente via cliente autenticado — respeita RLS. Se a
    // policy não deixar ver, a linha simplesmente não volta.
    const { data: pacienteAcesso, error: pacErro } = await supabase
      .from("pacientes")
      .select("id")
      .eq("id", pacienteId)
      .maybeSingle();
    if (pacErro || !pacienteAcesso) {
      return jsonResp({ ok: false, codigo: "paciente_nao_vinculada" }, 403);
    }

    if (consultaId != null) {
      if (typeof consultaId !== "string") {
        return jsonResp({ ok: false, codigo: "corpo_invalido" }, 400);
      }
      const { data: consultaAcesso, error: consErro } = await supabase
        .from("consultas")
        .select("id")
        .eq("id", consultaId)
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      if (consErro || !consultaAcesso) {
        return jsonResp({ ok: false, codigo: "paciente_nao_vinculada" }, 403);
      }
    }

    // storage_path precisa apontar para a pasta desta paciente — sem isso um
    // caminho forjado leria o arquivo de outra gestante (Guarda 2).
    const prefixoEsperado = `${BUCKET}/${pacienteId}/`;
    if (!storagePath.startsWith(prefixoEsperado)) {
      return jsonResp({ ok: false, codigo: "paciente_nao_vinculada" }, 403);
    }

    // ── Guarda 1 (custo) — interruptor de emergência ───────────────────
    if (!EXTRACAO_FOTO_ATIVA) {
      return jsonResp({
        ok: false,
        codigo: "extracao_desativada",
        mensagem: "Extração por foto temporariamente desativada (EXTRACAO_FOTO_ATIVA=false). Use a digitação manual.",
      }, 503);
    }

    // ── Guarda 1 (custo) — teto diário por profissional ────────────────
    const { count: usadasHoje, error: contagemErro } = await supabaseAdmin
      .from("fotos_perfil")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profissional.id)
      .gte("created_at", inicioDoDiaIso());
    if (contagemErro) {
      return jsonResp({ ok: false, codigo: "erro_interno", detalhes: contagemErro.message }, 500);
    }
    if ((usadasHoje ?? 0) >= LIMITE_DIARIO) {
      return jsonResp({
        ok: false,
        codigo: "limite_diario",
        limite: LIMITE_DIARIO,
        usadas: usadasHoje ?? 0,
      }, 429);
    }

    // ── Chamada ao modelo (real, quando a chave existir; senão, dados fixos) ──
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const dataFim = somarDias(dataInicio as string, (dias as number) - 1);
    const pontos = tipoPerfil === "6_pontos" ? PONTOS : (["jejum", "pos_cafe", "pos_almoco", "pos_jantar"] as const);

    let resultado: ResultadoModelo;
    if (!apiKey) {
      // Nenhum dado clínico real é lido nem logado neste modo — é só o
      // exemplo fixo do contrato, para o front trabalhar em paralelo.
      resultado = respostaFixaDeExemplo(dataInicio as string);
    } else {
      const { data: arquivo, error: downloadErro } = await supabaseAdmin.storage
        .from(BUCKET)
        .download(storagePath.slice(BUCKET.length + 1));
      if (downloadErro || !arquivo) {
        return jsonResp({ ok: false, codigo: "imagem_ilegivel", mensagem: "Não foi possível ler o arquivo da imagem." }, 422);
      }
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
      const imagemBase64 = btoa(binario);
      const mediaType = arquivo.type || "image/jpeg";

      const prompt = montarPrompt({
        pontos,
        dataInicio: dataInicio as string,
        dataFim,
        janelaPos: janelaPos as "1h" | "2h",
      });

      try {
        resultado = await chamarModelo({ apiKey, imagemBase64, mediaType, prompt });
      } catch (err) {
        // Registra a chamada que falhou (com custo — mesmo em erro, se soubermos)
        // mas nunca conteúdo clínico nem a imagem.
        await supabaseAdmin.from("fotos_perfil").insert({
          consulta_id: consultaId,
          paciente_id: pacienteId,
          profissional_id: profissional.id,
          storage_path: storagePath,
          modelo: "claude-opus-5",
          status: "descartada",
        });
        console.error("[extrair-perfil-foto] falha ao chamar o modelo:", (err as Error).message);
        return jsonResp({ ok: false, codigo: "modelo_indisponivel" }, 502);
      }

      // Regra 7 do prompt: sem grade nenhuma, o modelo devolve leituras vazio
      // (com observação explicando). Isso não é sucesso — vira erro para o
      // front sugerir refazer a foto, como o contrato define.
      if (resultado.leituras.length === 0) {
        return jsonResp({ ok: false, codigo: "imagem_ilegivel", observacoes: resultado.observacoes }, 422);
      }
    }

    // Descarta datas fora do período pedido (defesa extra — o front também filtra).
    resultado.leituras = resultado.leituras.filter((l) => l.data >= (dataInicio as string) && l.data <= dataFim);

    // Auditoria de uso e custo — nunca o conteúdo clínico, nunca a imagem.
    const { error: insertErro } = await supabaseAdmin.from("fotos_perfil").insert({
      consulta_id: consultaId,
      paciente_id: pacienteId,
      profissional_id: profissional.id,
      storage_path: storagePath,
      modelo: resultado.modelo,
      tokens_entrada: resultado.tokens_entrada,
      tokens_saida: resultado.tokens_saida,
      custo_usd: resultado.custo_usd,
      status: "extraida",
    });
    if (insertErro) {
      console.error("[extrair-perfil-foto] falha ao registrar auditoria:", insertErro.message);
      // Não bloqueia a resposta ao profissional por causa disso — mas fica no log.
    }

    return jsonResp({
      ok: true,
      leituras: resultado.leituras,
      incertos: resultado.incertos,
      observacoes: resultado.observacoes,
      uso: {
        tokens_entrada: resultado.tokens_entrada,
        tokens_saida: resultado.tokens_saida,
        custo_usd: resultado.custo_usd,
      },
    });
  } catch (error) {
    console.error("[extrair-perfil-foto] erro interno:", (error as Error).message);
    return jsonResp({ ok: false, codigo: "erro_interno" }, 500);
  }
});

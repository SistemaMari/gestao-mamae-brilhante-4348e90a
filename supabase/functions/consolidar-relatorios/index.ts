// Edge Function: consolidar-relatorios
// Recebe IDs de relatórios mensais selecionados pelo gestor geral, agrega métricas,
// chama Lovable AI (Gemini 2.5 Flash) para análise comparativa, gera PDF + CSV,
// salva no Storage e devolve signed URLs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.5-flash';

// As 21 chaves do schema 18A
const METRIC_KEYS = [
  'total_gestantes',
  'total_dmg_confirmado',
  'taxa_dmg_percent',
  'total_overt',
  'dmg_retorno1',
  'dmg_gtt',
  'controle_adequado_sem_insulina',
  'controle_com_insulina',
  'controle_adequado_com_insulina',
  'encaminhadas_especialista',
  'partos_registrados',
  'partos_vaginal',
  'partos_cesarea',
  'rn_aig',
  'rn_gig',
  'rn_pig',
  'intercorrencias_maternas',
  'intercorrencias_neonatais',
  'profissionais_ativos',
  'total_laudos',
] as const;

type MetricKey = typeof METRIC_KEYS[number];
type Metricas = Record<MetricKey, number> & { unidade_nome?: string };

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizarMetricas(raw: unknown): Metricas {
  const out: Metricas = Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as Metricas;
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const k of METRIC_KEYS) {
    const v = obj[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  if (typeof obj.unidade_nome === 'string') out.unidade_nome = obj.unidade_nome as string;
  return out;
}

function somar(unidades: Array<{ metricas: Metricas }>): Metricas {
  const total: Metricas = Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as Metricas;
  for (const u of unidades) {
    for (const k of METRIC_KEYS) {
      // Para percentuais, recalcular depois — não somar
      if (k === 'taxa_dmg_percent') continue;
      total[k] += u.metricas[k] || 0;
    }
  }
  total.taxa_dmg_percent = total.total_gestantes > 0
    ? Number(((total.total_dmg_confirmado / total.total_gestantes) * 100).toFixed(1))
    : 0;
  return total;
}

// ============================================================
// Prompt de sistema para a IA
// ============================================================
const SYSTEM_PROMPT = `Você é um analista de dados epidemiológicos do sistema Dra. Mari DMG Diagnóstica.
Você recebe dados agregados de múltiplas unidades de saúde e gera um relatório consolidado em JSON.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (JSON puro, sem markdown):
{
  "somatorio_geral": { ...21 chaves, percentuais recalculados a partir dos absolutos },
  "comparativo_unidades": [ { "nome_unidade": "...", ...21 chaves } ],
  "rankings": {
    "maior_taxa_dmg": { "unidade": "...", "valor": 0 },
    "menor_taxa_dmg": { "unidade": "...", "valor": 0 },
    "melhor_controle_adequado": { "unidade": "...", "valor": 0 },
    "mais_encaminhamentos": { "unidade": "...", "valor": 0 },
    "mais_partos_cesarea_percent": { "unidade": "...", "valor": 0 },
    "mais_gig_percent": { "unidade": "...", "valor": 0 }
  },
  "destaques": ["3 a 6 insights narrativos"]
}

REGRAS:
- Use APENAS os dados fornecidos. Não invente números.
- Tom técnico, objetivo, profissional.
- Use 'diabete' no masculino e singular (terminologia do sistema).
- NÃO some percentuais — recalcule a partir dos absolutos.
- Responda APENAS com JSON puro. Sem texto antes/depois. Sem backticks.`;

function montarPromptUsuario(unidades: Array<{ nome: string; periodo: string; metricas: Metricas }>): string {
  const blocos = unidades.map((u) => {
    const linhas = [
      `UNIDADE: ${u.nome}`,
      `Período: ${u.periodo}`,
      ...METRIC_KEYS.map((k) => `${k}: ${u.metricas[k]}`),
    ];
    return linhas.join('\n');
  });
  return `${blocos.join('\n\n')}\n\nResponda APENAS em JSON conforme o schema exigido.`;
}

// ============================================================
// Chamada IA com retry e limpeza de JSON
// ============================================================
function limparJson(s: string): string {
  let t = s.trim();
  // Remove backticks markdown
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Pega do primeiro { ao último }
  const i = t.indexOf('{');
  const j = t.lastIndexOf('}');
  if (i >= 0 && j > i) t = t.slice(i, j + 1);
  return t;
}

async function chamarIa(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY ausente.');

  const tentar = async () => {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) throw new Error('IA_RATE_LIMIT');
    if (resp.status === 402) throw new Error('IA_SEM_CREDITO');
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`IA HTTP ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('IA retornou conteúdo vazio.');
    return JSON.parse(limparJson(content));
  };

  try {
    return await tentar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'IA_RATE_LIMIT' || msg === 'IA_SEM_CREDITO') throw e;
    // Retry 1x
    console.warn('Primeira tentativa falhou, fazendo retry:', msg);
    return await tentar();
  }
}

// ============================================================
// Geração de CSV
// ============================================================
function escapeCsv(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function gerarCsv(unidades: Array<{ nome: string; periodo: string; metricas: Metricas }>, total: Metricas): string {
  const headers = ['nome_unidade', 'periodo', ...METRIC_KEYS];
  const rows: string[] = [headers.join(',')];
  for (const u of unidades) {
    const cols = [u.nome, u.periodo, ...METRIC_KEYS.map((k) => u.metricas[k])];
    rows.push(cols.map(escapeCsv).join(','));
  }
  // Total
  const totalRow = ['TOTAL CONSOLIDADO', '', ...METRIC_KEYS.map((k) => total[k])];
  rows.push(totalRow.map(escapeCsv).join(','));
  return rows.join('\n');
}

// ============================================================
// Geração de PDF consolidado
// ============================================================
async function gerarPdfConsolidado(params: {
  unidades: Array<{ nome: string; periodo: string; metricas: Metricas }>;
  somatorio: Metricas;
  rankings: Record<string, { unidade: string; valor: number }>;
  destaques: string[];
  periodoInicio: string;
  periodoFim: string;
  gestorNome: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const cLilas = rgb(0.608, 0.529, 0.961);
  const cRoxo = rgb(0.494, 0.412, 0.671);
  const cTexto = rgb(0.15, 0.15, 0.18);
  const cMuted = rgb(0.45, 0.45, 0.5);
  const cBgCard = rgb(0.97, 0.97, 1);

  // ----- CAPA -----
  let page = pdf.addPage([595, 842]);
  let { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 150, width, height: 150, color: cLilas });
  page.drawText('Relatório Consolidado', { x: 40, y: height - 70, size: 24, font: helvBold, color: rgb(1,1,1) });
  page.drawText('Dra. Mari DMG Diagnóstica', { x: 40, y: height - 100, size: 14, font: helv, color: rgb(1,1,1) });
  page.drawText(`Análise comparativa entre unidades`, { x: 40, y: height - 125, size: 11, font: helv, color: rgb(1,1,1) });

  let y = height - 200;
  const linhasCapa: Array<[string, string]> = [
    ['Gestor responsável', params.gestorNome],
    ['Período', `${formatarData(params.periodoInicio)} a ${formatarData(params.periodoFim)}`],
    ['Unidades incluídas', String(params.unidades.length)],
    ['Data de geração', new Date().toLocaleString('pt-BR')],
  ];
  for (const [k, v] of linhasCapa) {
    page.drawText(`${k}:`, { x: 40, y, size: 10, font: helvBold, color: cMuted });
    page.drawText(v, { x: 180, y, size: 10, font: helv, color: cTexto });
    y -= 22;
  }

  // ----- SEÇÃO 1: SOMATÓRIO GERAL -----
  page = pdf.addPage([595, 842]);
  ({ width, height } = page.getSize());
  y = height - 50;
  y = desenharCabecalhoSecao(page, helvBold, '1. Somatório Geral', y, cLilas, cRoxo);
  const somKpis: Array<[string, string | number]> = [
    ['Total gestantes', params.somatorio.total_gestantes],
    ['DMG confirmado', params.somatorio.total_dmg_confirmado],
    ['Taxa DMG (%)', params.somatorio.taxa_dmg_percent],
    ['Overt diabetes', params.somatorio.total_overt],
    ['DMG via Retorno 1', params.somatorio.dmg_retorno1],
    ['DMG via GTT', params.somatorio.dmg_gtt],
    ['Adequado s/ insulina', params.somatorio.controle_adequado_sem_insulina],
    ['Em insulina', params.somatorio.controle_com_insulina],
    ['Adequado c/ insulina', params.somatorio.controle_adequado_com_insulina],
    ['Encaminhamentos', params.somatorio.encaminhadas_especialista],
    ['Partos', params.somatorio.partos_registrados],
    ['Vaginais', params.somatorio.partos_vaginal],
    ['Cesáreas', params.somatorio.partos_cesarea],
    ['RN AIG', params.somatorio.rn_aig],
    ['RN GIG', params.somatorio.rn_gig],
    ['RN PIG', params.somatorio.rn_pig],
    ['Inter. maternas', params.somatorio.intercorrencias_maternas],
    ['Inter. neonatais', params.somatorio.intercorrencias_neonatais],
    ['Profissionais', params.somatorio.profissionais_ativos],
    ['Laudos', params.somatorio.total_laudos],
  ];
  y = desenharGridKpis(page, helv, helvBold, somKpis, y, cBgCard, cTexto, cMuted);

  // ----- SEÇÃO 2: VISÃO POR UNIDADE (tabela) -----
  page = pdf.addPage([595, 842]);
  ({ width, height } = page.getSize());
  y = height - 50;
  y = desenharCabecalhoSecao(page, helvBold, '2. Visão por Unidade', y, cLilas, cRoxo);
  // Tabela: 6 métricas-chave x N unidades
  const colsTabela: Array<{ label: string; key: MetricKey }> = [
    { label: 'Gestantes', key: 'total_gestantes' },
    { label: 'DMG', key: 'total_dmg_confirmado' },
    { label: 'Taxa%', key: 'taxa_dmg_percent' },
    { label: 'Em Insul', key: 'controle_com_insulina' },
    { label: 'Partos', key: 'partos_registrados' },
    { label: 'Cesárea', key: 'partos_cesarea' },
  ];
  y = desenharTabelaUnidades(page, helv, helvBold, params.unidades, colsTabela, y, cBgCard, cTexto, cRoxo);

  // ----- SEÇÃO 3: RANKINGS -----
  if (y < 200) { page = pdf.addPage([595, 842]); ({ width, height } = page.getSize()); y = height - 50; }
  y -= 20;
  y = desenharCabecalhoSecao(page, helvBold, '3. Rankings', y, cLilas, cRoxo);
  const rkLabels: Record<string, string> = {
    maior_taxa_dmg: 'Maior taxa de DMG',
    menor_taxa_dmg: 'Menor taxa de DMG',
    melhor_controle_adequado: 'Melhor controle adequado',
    mais_encaminhamentos: 'Mais encaminhamentos',
    mais_partos_cesarea_percent: 'Maior % de cesárea',
    mais_gig_percent: 'Maior % de RN GIG',
  };
  for (const [k, lbl] of Object.entries(rkLabels)) {
    const r = params.rankings[k];
    if (!r) continue;
    page.drawText(`${lbl}:`, { x: 40, y, size: 10, font: helvBold, color: cRoxo });
    page.drawText(`${r.unidade} (${r.valor})`, { x: 220, y, size: 10, font: helv, color: cTexto });
    y -= 18;
    if (y < 80) { page = pdf.addPage([595, 842]); ({ width, height } = page.getSize()); y = height - 50; }
  }

  // ----- SEÇÃO 4: DESTAQUES -----
  if (y < 200) { page = pdf.addPage([595, 842]); ({ width, height } = page.getSize()); y = height - 50; }
  y -= 30;
  y = desenharCabecalhoSecao(page, helvBold, '4. Destaques Automáticos', y, cLilas, cRoxo);
  for (const d of params.destaques) {
    const linhas = quebrarTexto(d, 90);
    page.drawText('•', { x: 40, y, size: 10, font: helvBold, color: cLilas });
    for (let i = 0; i < linhas.length; i++) {
      page.drawText(linhas[i], { x: 55, y, size: 10, font: helv, color: cTexto });
      y -= 14;
      if (y < 80) { page = pdf.addPage([595, 842]); ({ width, height } = page.getSize()); y = height - 50; }
    }
    y -= 6;
  }

  // ----- RODAPÉ na última página -----
  page.drawLine({ start: { x: 40, y: 50 }, end: { x: width - 40, y: 50 }, thickness: 0.5, color: cMuted });
  page.drawText('Gerado automaticamente pelo sistema Dra. Mari DMG Diagnóstica. Dados anonimizados.', {
    x: 40, y: 35, size: 8, font: helv, color: cMuted,
  });

  return await pdf.save();
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function quebrarTexto(t: string, max: number): string[] {
  const palavras = t.split(/\s+/);
  const linhas: string[] = [];
  let cur = '';
  for (const p of palavras) {
    if ((cur + ' ' + p).trim().length > max) {
      if (cur) linhas.push(cur.trim());
      cur = p;
    } else {
      cur = (cur + ' ' + p).trim();
    }
  }
  if (cur) linhas.push(cur);
  return linhas;
}

function desenharCabecalhoSecao(page: any, font: any, titulo: string, y: number, corBarra: any, corTexto: any): number {
  page.drawRectangle({ x: 40, y: y - 4, width: 4, height: 18, color: corBarra });
  page.drawText(titulo, { x: 52, y, size: 13, font, color: corTexto });
  return y - 28;
}

function desenharGridKpis(
  page: any, fontReg: any, fontBold: any,
  kpis: Array<[string, string | number]>,
  yStart: number, cBg: any, cTexto: any, cMuted: any,
): number {
  const cardW = 100, cardH = 50, gap = 8, startX = 40;
  let x = startX, y = yStart;
  kpis.forEach((kpi, i) => {
    if (i > 0 && i % 5 === 0) { x = startX; y -= cardH + gap; }
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: cBg });
    page.drawText(String(kpi[1]), { x: x + 8, y: y - 22, size: 16, font: fontBold, color: cTexto });
    page.drawText(kpi[0].slice(0, 18), { x: x + 8, y: y - 40, size: 7, font: fontReg, color: cMuted });
    x += cardW + gap;
  });
  return y - cardH - gap;
}

function desenharTabelaUnidades(
  page: any, fontReg: any, fontBold: any,
  unidades: Array<{ nome: string; metricas: Metricas }>,
  cols: Array<{ label: string; key: MetricKey }>,
  yStart: number, cBg: any, cTexto: any, cRoxo: any,
): number {
  const colNomeW = 150;
  const colMetricaW = 60;
  const rowH = 22;
  const startX = 40;
  let y = yStart;

  // Header
  page.drawRectangle({ x: startX, y: y - rowH, width: colNomeW + cols.length * colMetricaW, height: rowH, color: cRoxo });
  page.drawText('Unidade', { x: startX + 6, y: y - 15, size: 9, font: fontBold, color: rgb(1,1,1) });
  cols.forEach((c, i) => {
    page.drawText(c.label, { x: startX + colNomeW + i * colMetricaW + 6, y: y - 15, size: 9, font: fontBold, color: rgb(1,1,1) });
  });
  y -= rowH;

  // Rows
  unidades.forEach((u, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: startX, y: y - rowH, width: colNomeW + cols.length * colMetricaW, height: rowH, color: cBg });
    }
    page.drawText(u.nome.slice(0, 24), { x: startX + 6, y: y - 15, size: 8, font: fontReg, color: cTexto });
    cols.forEach((c, i) => {
      page.drawText(String(u.metricas[c.key]), { x: startX + colNomeW + i * colMetricaW + 6, y: y - 15, size: 8, font: fontReg, color: cTexto });
    });
    y -= rowH;
  });

  return y;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ status: 'erro', mensagem: 'Método não permitido.' }, 405);

  try {
    // ----- Auth -----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ status: 'erro', mensagem: 'Não autenticado.' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ status: 'erro', mensagem: 'Sessão inválida.' }, 401);
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ----- Parse body -----
    let body: { relatorio_ids?: string[]; gestor_geral_id?: string; formato_saida?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ status: 'erro', mensagem: 'Body JSON inválido.' }, 400);
    }
    const relatorioIds = Array.isArray(body.relatorio_ids) ? body.relatorio_ids.filter((s) => typeof s === 'string') : [];
    const gestorGeralId = (body.gestor_geral_id ?? '').trim();
    const formatoSaida = (body.formato_saida ?? 'ambos') as 'pdf' | 'csv' | 'ambos';

    if (relatorioIds.length === 0) {
      return jsonResponse({ status: 'erro', mensagem: 'Nenhum relatório selecionado.' }, 400);
    }
    if (!['pdf', 'csv', 'ambos'].includes(formatoSaida)) {
      return jsonResponse({ status: 'erro', mensagem: 'formato_saida inválido.' }, 400);
    }
    if (!gestorGeralId) {
      return jsonResponse({ status: 'erro', mensagem: 'gestor_geral_id obrigatório.' }, 400);
    }

    // ----- Validar gestor_geral -----
    const { data: gg, error: ggErr } = await admin
      .from('gestores_gerais')
      .select('id, user_id, nome')
      .eq('id', gestorGeralId)
      .maybeSingle();

    if (ggErr || !gg) {
      return jsonResponse({ status: 'erro', mensagem: 'Gestor geral não encontrado.' }, 401);
    }
    if (gg.user_id !== userId) {
      return jsonResponse({ status: 'erro', mensagem: 'gestor_geral_id não corresponde ao usuário autenticado.' }, 403);
    }

    // ----- Buscar relatórios -----
    const { data: relatorios, error: relErr } = await admin
      .from('relatorios_unidade')
      .select('id, unidade_id, periodo_inicio, periodo_fim, metricas_resumo, arquivo_path')
      .in('id', relatorioIds);

    if (relErr) {
      console.error('Erro ao buscar relatórios:', relErr);
      return jsonResponse({ status: 'erro', mensagem: 'Falha ao buscar relatórios.' }, 500);
    }
    if (!relatorios || relatorios.length === 0) {
      return jsonResponse({ status: 'erro', mensagem: 'Nenhum relatório encontrado para os IDs informados.' }, 404);
    }

    // ----- Validar acesso por unidade -----
    const unidadeIds = Array.from(new Set(relatorios.map((r) => r.unidade_id as string)));
    const { data: vinculos } = await admin
      .from('gestores_gerais_unidades')
      .select('unidade_id')
      .eq('gestor_geral_id', gestorGeralId)
      .in('unidade_id', unidadeIds);

    const unidadesPermitidas = new Set((vinculos ?? []).map((v) => v.unidade_id as string));
    const naoPermitidos = unidadeIds.filter((u) => !unidadesPermitidas.has(u));
    if (naoPermitidos.length > 0) {
      return jsonResponse({
        status: 'erro',
        mensagem: 'Você não tem acesso a um ou mais relatórios selecionados.',
      }, 403);
    }

    // ----- Buscar nomes das unidades -----
    const { data: unidadesRows } = await admin
      .from('unidades')
      .select('id, nome')
      .in('id', unidadeIds);
    const nomeUnidade = new Map<string, string>();
    (unidadesRows ?? []).forEach((u) => nomeUnidade.set(u.id as string, u.nome as string));

    // ----- Montar dados consolidados -----
    interface ItemUnidade { nome: string; periodo: string; metricas: Metricas; }
    const dadosUnidades: ItemUnidade[] = [];
    const notas: string[] = [];

    for (const r of relatorios) {
      const nome = nomeUnidade.get(r.unidade_id as string) ?? '(sem nome)';
      const periodo = `${r.periodo_inicio} a ${r.periodo_fim}`;

      let metricas: Metricas | null = null;
      if (r.metricas_resumo && typeof r.metricas_resumo === 'object') {
        metricas = normalizarMetricas(r.metricas_resumo);
      } else {
        // Fallback: dados não extraíveis (parsing de PDF não implementado nesta versão)
        notas.push(`Relatório ${nome} excluído: dados não extraíveis (metricas_resumo ausente).`);
        continue;
      }

      dadosUnidades.push({ nome, periodo, metricas });
    }

    if (dadosUnidades.length === 0) {
      return jsonResponse({
        status: 'erro',
        mensagem: 'Nenhum relatório com dados utilizáveis. Todos foram excluídos.',
        notas,
      }, 422);
    }

    // ----- Somatório local (fallback se IA falhar no campo) -----
    const somatorioLocal = somar(dadosUnidades);

    // ----- Período consolidado -----
    const todasInicios = relatorios.map((r) => String(r.periodo_inicio)).sort();
    const todosFins = relatorios.map((r) => String(r.periodo_fim)).sort();
    const periodoInicio = todasInicios[0];
    const periodoFim = todosFins[todosFins.length - 1];

    // ----- Chamar IA -----
    let analiseIa: any;
    try {
      const userPrompt = montarPromptUsuario(dadosUnidades);
      analiseIa = await chamarIa(SYSTEM_PROMPT, userPrompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Falha IA:', msg);
      if (msg === 'IA_RATE_LIMIT') {
        return jsonResponse({ status: 'erro', mensagem: 'IA temporariamente indisponível (limite de uso). Tente novamente em instantes.' }, 429);
      }
      if (msg === 'IA_SEM_CREDITO') {
        return jsonResponse({ status: 'erro', mensagem: 'Créditos de IA esgotados. Entre em contato com o suporte.' }, 402);
      }
      return jsonResponse({ status: 'erro', mensagem: 'Erro ao gerar análise consolidada. Tente novamente.' }, 500);
    }

    // Extrai e normaliza
    const somatorioFinal = analiseIa?.somatorio_geral
      ? normalizarMetricas(analiseIa.somatorio_geral)
      : somatorioLocal;
    const rankings = (analiseIa?.rankings && typeof analiseIa.rankings === 'object') ? analiseIa.rankings : {};
    const destaques: string[] = Array.isArray(analiseIa?.destaques)
      ? analiseIa.destaques.filter((d: unknown) => typeof d === 'string').slice(0, 6)
      : ['Sem destaques disponíveis.'];

    // ----- Gerar arquivos -----
    const timestamp = Date.now();
    const baseDir = `${gestorGeralId}/${timestamp}`;
    let pdfPath: string | null = null;
    let csvPath: string | null = null;

    try {
      if (formatoSaida === 'pdf' || formatoSaida === 'ambos') {
        const pdfBytes = await gerarPdfConsolidado({
          unidades: dadosUnidades,
          somatorio: somatorioFinal,
          rankings,
          destaques,
          periodoInicio,
          periodoFim,
          gestorNome: gg.nome ?? 'Gestor Geral',
        });
        pdfPath = `${baseDir}/consolidado.pdf`;
        const { error: upErr } = await admin.storage
          .from('consolidados')
          .upload(pdfPath, new Blob([pdfBytes], { type: 'application/pdf' }), {
            contentType: 'application/pdf',
            upsert: false,
          });
        if (upErr) throw new Error(`Upload PDF: ${upErr.message}`);
      }

      if (formatoSaida === 'csv' || formatoSaida === 'ambos') {
        const csv = gerarCsv(dadosUnidades, somatorioFinal);
        csvPath = `${baseDir}/consolidado.csv`;
        const { error: upErr } = await admin.storage
          .from('consolidados')
          .upload(csvPath, new Blob([csv], { type: 'text/csv' }), {
            contentType: 'text/csv; charset=utf-8',
            upsert: false,
          });
        if (upErr) throw new Error(`Upload CSV: ${upErr.message}`);
      }
    } catch (e) {
      console.error('Erro upload Storage:', e);
      const msg = e instanceof Error ? e.message : 'desconhecido';
      // Cleanup parcial
      if (pdfPath) await admin.storage.from('consolidados').remove([pdfPath]).catch(() => {});
      if (csvPath) await admin.storage.from('consolidados').remove([csvPath]).catch(() => {});
      return jsonResponse({ status: 'erro', mensagem: `Erro ao salvar arquivos: ${msg}` }, 500);
    }

    // ----- Registrar consolidação -----
    const { data: consolidacao, error: consErr } = await admin
      .from('consolidacoes')
      .insert({
        gestor_geral_id: gestorGeralId,
        relatorio_ids: relatorios.map((r) => r.id),
        unidades_incluidas: unidadeIds.length,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        pdf_path: pdfPath,
        csv_path: csvPath,
        notas: notas.length > 0 ? { mensagens: notas } : null,
      })
      .select('id')
      .single();

    if (consErr || !consolidacao) {
      console.error('Erro insert consolidacoes:', consErr);
      // Cleanup
      if (pdfPath) await admin.storage.from('consolidados').remove([pdfPath]).catch(() => {});
      if (csvPath) await admin.storage.from('consolidados').remove([csvPath]).catch(() => {});
      return jsonResponse({ status: 'erro', mensagem: 'Falha ao registrar consolidação.' }, 500);
    }

    // ----- Signed URLs (1h) -----
    let pdfUrl: string | null = null;
    let csvUrl: string | null = null;
    if (pdfPath) {
      const { data: signed } = await admin.storage.from('consolidados').createSignedUrl(pdfPath, 3600);
      pdfUrl = signed?.signedUrl ?? null;
    }
    if (csvPath) {
      const { data: signed } = await admin.storage.from('consolidados').createSignedUrl(csvPath, 3600);
      csvUrl = signed?.signedUrl ?? null;
    }

    return jsonResponse({
      status: 'consolidado',
      consolidacao_id: consolidacao.id,
      unidades_incluidas: unidadeIds.length,
      pdf_url: pdfUrl,
      csv_url: csvUrl,
      notas: notas.length > 0 ? notas : undefined,
    }, 200);

  } catch (err) {
    console.error('consolidar-relatorios erro inesperado:', err);
    const mensagem = err instanceof Error ? err.message : 'Erro interno.';
    return jsonResponse({ status: 'erro', mensagem }, 500);
  }
});

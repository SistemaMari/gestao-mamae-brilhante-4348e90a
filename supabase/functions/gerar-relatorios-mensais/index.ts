// Edge Function: gerar-relatorios-mensais
// Disparada por pg_cron todo dia 1 do mês às 03:00 BRT.
// Itera todas as unidades ativas, agrega métricas do mês anterior e gera PDF
// arquivado em relatorios_unidade com origem='automatico'.
//
// Pode ser chamada também manualmente (admin) com body:
//   { "periodo_inicio": "2026-03-01", "periodo_fim": "2026-03-31" }
// para regerar um período específico.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// Cálculo de período padrão (mês anterior)
// ============================================================
function calcularMesAnterior(): { inicio: string; fim: string; rotuloMes: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const rotuloMes = `${meses[inicio.getMonth()]}/${inicio.getFullYear()}`;
  return { inicio: fmt(inicio), fim: fmt(fim), rotuloMes };
}

// ============================================================
// Agregação de métricas por unidade — schema 18A (21 chaves)
// ============================================================
export interface MetricasUnidade {
  // Identidade
  unidade_id: string;
  unidade_nome: string;
  // Núcleo
  total_gestantes: number;            // = total de pacientes ativos no período
  total_dmg_confirmado: number;
  taxa_dmg_percent: number;           // derivado: total_dmg_confirmado / total_gestantes * 100
  total_overt: number;                // overt diabetes (cenário clínico)
  // Diagnóstico por momento
  dmg_retorno1: number;               // DMG diagnosticado a partir de Retorno 1
  dmg_gtt: number;                    // DMG diagnosticado por GTT
  // Controle glicêmico
  controle_adequado_sem_insulina: number;
  controle_com_insulina: number;
  controle_adequado_com_insulina: number;
  encaminhadas_especialista: number;
  // Partos
  partos_registrados: number;
  partos_vaginal: number;
  partos_cesarea: number;
  rn_aig: number;
  rn_gig: number;
  rn_pig: number;
  intercorrencias_maternas: number;
  intercorrencias_neonatais: number;
  // Operacional
  profissionais_ativos: number;
  total_laudos: number;
}

export async function agregarMetricas(
  admin: ReturnType<typeof createClient>,
  unidadeId: string,
  unidadeNome: string,
  periodoInicio: string,
  periodoFim: string,
): Promise<MetricasUnidade> {
  // ---------- Pacientes da unidade no período ----------
  const { data: pacientes } = await admin
    .from('pacientes')
    .select('id, status_ficha, dmg_gestacao_anterior, created_at')
    .eq('unidade_id', unidadeId)
    .gte('created_at', `${periodoInicio}T00:00:00Z`)
    .lte('created_at', `${periodoFim}T23:59:59Z`);

  const pacientesArr = pacientes ?? [];
  const total_gestantes = pacientesArr.length;
  const idsPacientes = pacientesArr.map((p) => p.id as string);

  const encaminhadas_especialista = pacientesArr.filter((p) => {
    const s = ((p.status_ficha as string | null) ?? '').toLowerCase();
    return s.includes('encaminh') || s.includes('especialista');
  }).length;

  // ---------- Laudos do período ----------
  let total_laudos = 0;
  let total_dmg_confirmado = 0;
  let total_overt = 0;
  const dmgSet = new Set<string>();
  const overtSet = new Set<string>();

  if (idsPacientes.length > 0) {
    const { data: laudos } = await admin
      .from('laudos')
      .select('paciente_id, cenario_clinico, created_at')
      .in('paciente_id', idsPacientes)
      .gte('created_at', `${periodoInicio}T00:00:00Z`)
      .lte('created_at', `${periodoFim}T23:59:59Z`);

    const laudosArr = laudos ?? [];
    total_laudos = laudosArr.length;

    laudosArr.forEach((l) => {
      const c = ((l.cenario_clinico as string | null) ?? '').toLowerCase();
      if (!c) return;
      if (c.includes('overt')) {
        overtSet.add(l.paciente_id as string);
      }
      // DMG confirmado: cenário menciona dmg e NÃO inclui "sem dmg"/"nao tem"
      if (c.includes('dmg') && !c.includes('sem dmg') && !c.includes('não tem') && !c.includes('nao tem')) {
        dmgSet.add(l.paciente_id as string);
      }
    });
    total_dmg_confirmado = dmgSet.size;
    total_overt = overtSet.size;
  }

  const taxa_dmg_percent = total_gestantes > 0
    ? Number(((total_dmg_confirmado / total_gestantes) * 100).toFixed(1))
    : 0;

  // ---------- Diagnóstico por consulta (retorno 1, gtt) ----------
  let dmg_retorno1 = 0;
  let dmg_gtt = 0;
  if (dmgSet.size > 0) {
    const dmgIds = Array.from(dmgSet);
    const { data: consultas } = await admin
      .from('consultas')
      .select('paciente_id, tipo, status_gerado, cenario_clinico')
      .in('paciente_id', dmgIds);

    const consultasArr = consultas ?? [];
    const retornoSet = new Set<string>();
    const gttSet = new Set<string>();
    consultasArr.forEach((c) => {
      const cc = ((c.cenario_clinico as string | null) ?? '').toLowerCase();
      const isDmg = cc.includes('dmg') && !cc.includes('sem dmg');
      if (!isDmg) return;
      if (c.tipo === 'retorno_1') retornoSet.add(c.paciente_id as string);
      if (c.tipo === 'gtt') gttSet.add(c.paciente_id as string);
    });
    dmg_retorno1 = retornoSet.size;
    dmg_gtt = gttSet.size;
  }

  // ---------- Controle glicêmico (perfis_glicemicos) ----------
  let controle_adequado_sem_insulina = 0;
  let controle_com_insulina = 0;
  let controle_adequado_com_insulina = 0;

  if (idsPacientes.length > 0) {
    const { data: perfis } = await admin
      .from('perfis_glicemicos')
      .select('paciente_id, decisao, percentual_meta, data_fim')
      .in('paciente_id', idsPacientes);

    const perfisArr = perfis ?? [];
    // Pega o perfil mais recente por paciente (data_fim DESC)
    const ultimoPorPaciente = new Map<string, { decisao: string | null; percentual_meta: number }>();
    perfisArr
      .sort((a, b) => String(b.data_fim).localeCompare(String(a.data_fim)))
      .forEach((p) => {
        const pid = p.paciente_id as string;
        if (!ultimoPorPaciente.has(pid)) {
          ultimoPorPaciente.set(pid, {
            decisao: (p.decisao as string | null),
            percentual_meta: Number(p.percentual_meta) || 0,
          });
        }
      });

    ultimoPorPaciente.forEach((perfil) => {
      const dec = (perfil.decisao ?? '').toLowerCase();
      const adequado = perfil.percentual_meta >= 70;
      if (dec === 'insulina') {
        controle_com_insulina++;
        if (adequado) controle_adequado_com_insulina++;
      } else if (dec === 'manter_dieta' || dec === 'dieta' || adequado) {
        controle_adequado_sem_insulina++;
      }
    });
  }

  // ---------- Partos no período ----------
  const { data: partos } = await admin
    .from('partos')
    .select('via_parto, classificacao_rn, intercorrencia_materna, intercorrencia_neonatal')
    .eq('unidade_id', unidadeId)
    .gte('data_parto', periodoInicio)
    .lte('data_parto', periodoFim);

  const partosArr = partos ?? [];
  const partos_registrados = partosArr.length;
  const partos_vaginal = partosArr.filter((p) => p.via_parto === 'vaginal').length;
  const partos_cesarea = partosArr.filter((p) => p.via_parto === 'cesarea').length;
  const rn_aig = partosArr.filter((p) => p.classificacao_rn === 'AIG').length;
  const rn_gig = partosArr.filter((p) => p.classificacao_rn === 'GIG').length;
  const rn_pig = partosArr.filter((p) => p.classificacao_rn === 'PIG').length;
  const intercorrencias_maternas = partosArr.filter((p) => p.intercorrencia_materna).length;
  const intercorrencias_neonatais = partosArr.filter((p) => p.intercorrencia_neonatal).length;

  // ---------- Profissionais ativos ----------
  const { count: profissionais_ativos } = await admin
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .neq('perfil_institucional', 'sistema');

  return {
    unidade_id: unidadeId,
    unidade_nome: unidadeNome,
    total_gestantes,
    total_dmg_confirmado,
    taxa_dmg_percent,
    total_overt,
    dmg_retorno1,
    dmg_gtt,
    controle_adequado_sem_insulina,
    controle_com_insulina,
    controle_adequado_com_insulina,
    encaminhadas_especialista,
    partos_registrados,
    partos_vaginal,
    partos_cesarea,
    rn_aig,
    rn_gig,
    rn_pig,
    intercorrencias_maternas,
    intercorrencias_neonatais,
    profissionais_ativos: profissionais_ativos ?? 0,
    total_laudos,
  };
}

// ============================================================
// Geração de PDF programático com pdf-lib
// ============================================================
async function gerarPdfRelatorio(params: {
  metricas: MetricasUnidade;
  periodoInicio: string;
  periodoFim: string;
  rotuloMes: string;
}): Promise<Uint8Array> {
  const { metricas, periodoInicio, periodoFim, rotuloMes } = params;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Cores semânticas (lilás/roxo da marca)
  const cLilas = rgb(0.608, 0.529, 0.961);   // #9b87f5
  const cRoxo = rgb(0.494, 0.412, 0.671);    // #7E69AB
  const cTexto = rgb(0.15, 0.15, 0.18);
  const cMuted = rgb(0.45, 0.45, 0.5);
  const cBgCard = rgb(0.97, 0.97, 1);

  let y = height - 50;

  // Cabeçalho
  page.drawRectangle({ x: 0, y: y - 10, width, height: 60, color: cLilas });
  page.drawText('Dra. Mari DMG Diagnóstica', {
    x: 40, y: y + 25, size: 18, font: helvBold, color: rgb(1, 1, 1),
  });
  page.drawText('Relatório Mensal de Gestão (gerado automaticamente)', {
    x: 40, y: y + 5, size: 10, font: helv, color: rgb(1, 1, 1),
  });

  y -= 80;

  // Subcabeçalho — unidade e período
  page.drawText(metricas.unidade_nome, {
    x: 40, y, size: 14, font: helvBold, color: cRoxo,
  });
  y -= 18;
  page.drawText(`Período: ${formatarData(periodoInicio)} a ${formatarData(periodoFim)} (${rotuloMes})`, {
    x: 40, y, size: 10, font: helv, color: cMuted,
  });
  y -= 30;

  // KPIs gerais
  y = desenharSecao(page, helvBold, 'Visão Geral', y, cRoxo);
  const kpis: Array<[string, string | number]> = [
    ['Gestantes no período', metricas.total_gestantes],
    ['DMG confirmado', metricas.total_dmg_confirmado],
    ['Taxa de DMG (%)', metricas.taxa_dmg_percent],
    ['Overt diabetes', metricas.total_overt],
    ['Profissionais', metricas.profissionais_ativos],
  ];
  y = desenharGridKpis(page, helv, helvBold, kpis, y, cBgCard, cTexto, cMuted);

  // Diagnóstico por momento
  y -= 20;
  y = desenharSecao(page, helvBold, 'Diagnóstico de DMG', y, cRoxo);
  const dxKpis: Array<[string, string | number]> = [
    ['DMG via Retorno 1', metricas.dmg_retorno1],
    ['DMG via GTT', metricas.dmg_gtt],
    ['Total laudos', metricas.total_laudos],
  ];
  y = desenharGridKpis(page, helv, helvBold, dxKpis, y, cBgCard, cTexto, cMuted);

  // Controle glicêmico
  y -= 20;
  y = desenharSecao(page, helvBold, 'Controle glicêmico', y, cRoxo);
  const ctrlKpis: Array<[string, string | number]> = [
    ['Adequado s/ insulina', metricas.controle_adequado_sem_insulina],
    ['Em insulina', metricas.controle_com_insulina],
    ['Adequado c/ insulina', metricas.controle_adequado_com_insulina],
    ['Encaminhadas', metricas.encaminhadas_especialista],
  ];
  y = desenharGridKpis(page, helv, helvBold, ctrlKpis, y, cBgCard, cTexto, cMuted);

  // Partos
  y -= 20;
  y = desenharSecao(page, helvBold, 'Partos no período', y, cRoxo);
  const partosKpis: Array<[string, string | number]> = [
    ['Total de partos', metricas.partos_registrados],
    ['Vaginais', metricas.partos_vaginal],
    ['Cesáreas', metricas.partos_cesarea],
  ];
  y = desenharGridKpis(page, helv, helvBold, partosKpis, y, cBgCard, cTexto, cMuted);

  // Classificação RN
  y -= 20;
  y = desenharSecao(page, helvBold, 'Classificação do recém-nascido', y, cRoxo);
  const rnKpis: Array<[string, string | number]> = [
    ['AIG (adequado)', metricas.rn_aig],
    ['GIG (grande)', metricas.rn_gig],
    ['PIG (pequeno)', metricas.rn_pig],
  ];
  y = desenharGridKpis(page, helv, helvBold, rnKpis, y, cBgCard, cTexto, cMuted);

  // Intercorrências
  y -= 20;
  y = desenharSecao(page, helvBold, 'Intercorrências', y, cRoxo);
  const interKpis: Array<[string, string | number]> = [
    ['Maternas', metricas.intercorrencias_maternas],
    ['Neonatais', metricas.intercorrencias_neonatais],
  ];
  y = desenharGridKpis(page, helv, helvBold, interKpis, y, cBgCard, cTexto, cMuted);

  // Aviso se vazio
  if (metricas.total_gestantes === 0 && metricas.partos_registrados === 0) {
    y -= 30;
    page.drawRectangle({
      x: 40, y: y - 5, width: width - 80, height: 30,
      color: rgb(1, 0.97, 0.85),
    });
    page.drawText('Nenhum atendimento registrado para esta unidade no período.', {
      x: 50, y: y + 8, size: 10, font: helvBold, color: rgb(0.6, 0.4, 0),
    });
    y -= 40;
  }

  // Rodapé
  const rodapeY = 40;
  page.drawLine({
    start: { x: 40, y: rodapeY + 20 },
    end: { x: width - 40, y: rodapeY + 20 },
    thickness: 0.5,
    color: cMuted,
  });
  page.drawText(`Gerado automaticamente pelo sistema em ${new Date().toLocaleString('pt-BR')}`, {
    x: 40, y: rodapeY + 5, size: 8, font: helv, color: cMuted,
  });
  page.drawText('Origem: AUTOMÁTICO', {
    x: width - 150, y: rodapeY + 5, size: 8, font: helvBold, color: cLilas,
  });

  return await pdf.save();
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function desenharSecao(page: any, font: any, titulo: string, y: number, cor: any): number {
  page.drawText(titulo, { x: 40, y, size: 12, font, color: cor });
  page.drawLine({
    start: { x: 40, y: y - 4 },
    end: { x: 200, y: y - 4 },
    thickness: 1,
    color: cor,
  });
  return y - 22;
}

function desenharGridKpis(
  page: any,
  fontReg: any,
  fontBold: any,
  kpis: Array<[string, string | number]>,
  yStart: number,
  cBg: any,
  cTexto: any,
  cMuted: any,
): number {
  const cardW = 100;
  const cardH = 50;
  const gap = 10;
  const startX = 40;
  let x = startX;
  let y = yStart;

  kpis.forEach((kpi, i) => {
    if (i > 0 && i % 5 === 0) {
      x = startX;
      y -= cardH + gap;
    }
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: cBg });
    page.drawText(String(kpi[1]), {
      x: x + 8, y: y - 22, size: 18, font: fontBold, color: cTexto,
    });
    page.drawText(kpi[0], {
      x: x + 8, y: y - 40, size: 7, font: fontReg, color: cMuted,
    });
    x += cardW + gap;
  });

  return y - cardH - gap;
}

// ============================================================
// Loop principal
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Permite override de período via body (para regeração manual por admin)
  let periodoInicio: string;
  let periodoFim: string;
  let rotuloMes: string;

  try {
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (body.periodo_inicio && body.periodo_fim) {
        periodoInicio = body.periodo_inicio;
        periodoFim = body.periodo_fim;
        rotuloMes = `${periodoInicio} a ${periodoFim}`;
      } else {
        const m = calcularMesAnterior();
        periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
      }
    } else {
      const m = calcularMesAnterior();
      periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
    }
  } catch {
    const m = calcularMesAnterior();
    periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
  }

  // Verifica execução duplicada
  const { data: emAndamento } = await admin
    .from('execucoes_cron')
    .select('id')
    .eq('job_nome', 'gerar-relatorios-mensais')
    .eq('status', 'em_andamento')
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fim', periodoFim)
    .maybeSingle();

  if (emAndamento) {
    return jsonResponse(
      { status: 'abortado', mensagem: 'Já existe execução em andamento para este período.', execucao_id: emAndamento.id },
      409,
    );
  }

  // Cria registro de execução
  const { data: execucao, error: execErr } = await admin
    .from('execucoes_cron')
    .insert({
      job_nome: 'gerar-relatorios-mensais',
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      status: 'em_andamento',
    })
    .select('id')
    .single();

  if (execErr || !execucao) {
    console.error('Falha ao criar execucao_cron:', execErr);
    return jsonResponse({ status: 'erro', mensagem: 'Falha ao iniciar execução.' }, 500);
  }
  const execucaoId = execucao.id;

  try {
    // Busca unidades ativas
    const { data: unidades, error: uniErr } = await admin
      .from('unidades')
      .select('id, nome')
      .eq('ativa', true);

    if (uniErr) throw uniErr;
    const unidadesArr = unidades ?? [];

    const resultados = {
      sucesso: [] as Array<{ unidade_id: string; relatorio_id: string; arquivo_path: string }>,
      vazias: [] as Array<{ unidade_id: string; relatorio_id: string }>,
      falha: [] as Array<{ unidade_id: string; erro: string }>,
    };

    for (const unidade of unidadesArr) {
      try {
        const metricas = await agregarMetricas(
          admin, unidade.id as string, unidade.nome as string, periodoInicio, periodoFim,
        );

        const ehVazia = metricas.total_gestantes === 0 && metricas.partos_registrados === 0;

        const pdfBytes = await gerarPdfRelatorio({
          metricas, periodoInicio, periodoFim, rotuloMes,
        });

        // Salva via salvar-relatorio (passando service_role para o auth header)
        const fd = new FormData();
        fd.append('pdf_file', new Blob([pdfBytes], { type: 'application/pdf' }), `relatorio-${unidade.id}.pdf`);
        fd.append('unidade_id', unidade.id as string);
        fd.append('gestor_id', SYSTEM_USER_UUID);
        fd.append('periodo_inicio', periodoInicio);
        fd.append('periodo_fim', periodoFim);
        fd.append('origem', 'automatico');
        fd.append('metricas_resumo', JSON.stringify(metricas));

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/salvar-relatorio`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
          body: fd,
        });
        const respJson = await resp.json();

        if (!resp.ok || respJson.status !== 'salvo') {
          throw new Error(respJson.mensagem ?? `HTTP ${resp.status}`);
        }

        if (ehVazia) {
          resultados.vazias.push({ unidade_id: unidade.id as string, relatorio_id: respJson.relatorio_id });
        } else {
          resultados.sucesso.push({
            unidade_id: unidade.id as string,
            relatorio_id: respJson.relatorio_id,
            arquivo_path: respJson.arquivo_path,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Falha unidade ${unidade.id}:`, msg);
        resultados.falha.push({ unidade_id: unidade.id as string, erro: msg });
      }
    }

    // Retry uma vez para falhas
    if (resultados.falha.length > 0) {
      const falhasOriginais = [...resultados.falha];
      resultados.falha = [];

      for (const falha of falhasOriginais) {
        try {
          const uni = unidadesArr.find((u) => u.id === falha.unidade_id);
          if (!uni) {
            resultados.falha.push(falha);
            continue;
          }
          const metricas = await agregarMetricas(
            admin, uni.id as string, uni.nome as string, periodoInicio, periodoFim,
          );
          const ehVazia = metricas.total_gestantes === 0 && metricas.partos_registrados === 0;
          const pdfBytes = await gerarPdfRelatorio({ metricas, periodoInicio, periodoFim, rotuloMes });

          const fd = new FormData();
          fd.append('pdf_file', new Blob([pdfBytes], { type: 'application/pdf' }), `relatorio-${uni.id}.pdf`);
          fd.append('unidade_id', uni.id as string);
          fd.append('gestor_id', SYSTEM_USER_UUID);
          fd.append('periodo_inicio', periodoInicio);
          fd.append('periodo_fim', periodoFim);
          fd.append('origem', 'automatico');
          fd.append('metricas_resumo', JSON.stringify(metricas));

          const resp = await fetch(`${SUPABASE_URL}/functions/v1/salvar-relatorio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
            body: fd,
          });
          const respJson = await resp.json();

          if (!resp.ok || respJson.status !== 'salvo') {
            throw new Error(respJson.mensagem ?? `HTTP ${resp.status}`);
          }

          if (ehVazia) {
            resultados.vazias.push({ unidade_id: uni.id as string, relatorio_id: respJson.relatorio_id });
          } else {
            resultados.sucesso.push({
              unidade_id: uni.id as string,
              relatorio_id: respJson.relatorio_id,
              arquivo_path: respJson.arquivo_path,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido';
          resultados.falha.push({ unidade_id: falha.unidade_id, erro: `[retry] ${msg}` });
        }
      }
    }

    // Encerra execução
    const status = resultados.falha.length === 0 ? 'sucesso' : 'parcial';
    await admin.from('execucoes_cron').update({
      status,
      total_unidades: unidadesArr.length,
      total_sucesso: resultados.sucesso.length,
      total_vazias: resultados.vazias.length,
      total_falha: resultados.falha.length,
      detalhe_falhas: resultados.falha.length > 0 ? resultados.falha : null,
      finalizado_em: new Date().toISOString(),
    }).eq('id', execucaoId);

    return jsonResponse({
      status,
      execucao_id: execucaoId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      total_unidades: unidadesArr.length,
      total_sucesso: resultados.sucesso.length,
      total_vazias: resultados.vazias.length,
      total_falha: resultados.falha.length,
      falhas: resultados.falha,
    }, 200);

  } catch (err) {
    console.error('Falha total:', err);
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    await admin.from('execucoes_cron').update({
      status: 'falha_total',
      detalhe_falhas: [{ erro_global: msg }],
      finalizado_em: new Date().toISOString(),
    }).eq('id', execucaoId);
    return jsonResponse({ status: 'falha_total', execucao_id: execucaoId, mensagem: msg }, 500);
  }
});

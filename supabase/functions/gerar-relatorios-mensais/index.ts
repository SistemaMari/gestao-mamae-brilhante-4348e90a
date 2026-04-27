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
// Agregação de métricas por unidade
// ============================================================
interface MetricasUnidade {
  unidade_id: string;
  unidade_nome: string;
  total_pacientes_periodo: number;
  total_fichas_ativas: number;
  total_dmg_positivo: number;
  total_em_insulina: number;
  total_partos: number;
  partos_vaginais: number;
  partos_cesarea: number;
  rn_aig: number;
  rn_gig: number;
  rn_pig: number;
  intercorrencias_maternas: number;
  intercorrencias_neonatais: number;
  total_profissionais: number;
}

async function agregarMetricas(
  admin: ReturnType<typeof createClient>,
  unidadeId: string,
  unidadeNome: string,
  periodoInicio: string,
  periodoFim: string,
): Promise<MetricasUnidade> {
  // Pacientes da unidade no período
  const { data: pacientes } = await admin
    .from('pacientes')
    .select('id, status_ficha, dmg_gestacao_anterior, created_at')
    .eq('unidade_id', unidadeId)
    .gte('created_at', `${periodoInicio}T00:00:00Z`)
    .lte('created_at', `${periodoFim}T23:59:59Z`);

  const pacientesArr = pacientes ?? [];
  const total_pacientes_periodo = pacientesArr.length;
  const total_fichas_ativas = pacientesArr.filter(
    (p) => p.status_ficha && !['encerrado', 'arquivado'].includes(p.status_ficha as string),
  ).length;

  // DMG positivo (status_ficha contém 'dmg' OU laudos com cenário positivo)
  const idsPacientes = pacientesArr.map((p) => p.id as string);
  let total_dmg_positivo = 0;
  let total_em_insulina = 0;

  if (idsPacientes.length > 0) {
    const { data: laudos } = await admin
      .from('laudos')
      .select('paciente_id, cenario_clinico')
      .in('paciente_id', idsPacientes);

    const dmgSet = new Set<string>();
    (laudos ?? []).forEach((l) => {
      const c = (l.cenario_clinico as string | null) ?? '';
      if (c.toLowerCase().includes('dmg') && !c.toLowerCase().includes('sem dmg')) {
        dmgSet.add(l.paciente_id as string);
      }
    });
    total_dmg_positivo = dmgSet.size;

    // Em insulina: perfis_glicemicos.decisao = 'insulina'
    const { data: perfis } = await admin
      .from('perfis_glicemicos')
      .select('paciente_id, decisao')
      .in('paciente_id', idsPacientes)
      .eq('decisao', 'insulina');
    const insulinaSet = new Set<string>();
    (perfis ?? []).forEach((p) => insulinaSet.add(p.paciente_id as string));
    total_em_insulina = insulinaSet.size;
  }

  // Partos no período
  const { data: partos } = await admin
    .from('partos')
    .select('via_parto, classificacao_rn, intercorrencia_materna, intercorrencia_neonatal')
    .eq('unidade_id', unidadeId)
    .gte('data_parto', periodoInicio)
    .lte('data_parto', periodoFim);

  const partosArr = partos ?? [];
  const total_partos = partosArr.length;
  const partos_vaginais = partosArr.filter((p) => p.via_parto === 'vaginal').length;
  const partos_cesarea = partosArr.filter((p) => p.via_parto === 'cesarea').length;
  const rn_aig = partosArr.filter((p) => p.classificacao_rn === 'AIG').length;
  const rn_gig = partosArr.filter((p) => p.classificacao_rn === 'GIG').length;
  const rn_pig = partosArr.filter((p) => p.classificacao_rn === 'PIG').length;
  const intercorrencias_maternas = partosArr.filter((p) => p.intercorrencia_materna).length;
  const intercorrencias_neonatais = partosArr.filter((p) => p.intercorrencia_neonatal).length;

  // Profissionais ativos da unidade
  const { count: total_profissionais } = await admin
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .neq('perfil_institucional', 'sistema');

  return {
    unidade_id: unidadeId,
    unidade_nome: unidadeNome,
    total_pacientes_periodo,
    total_fichas_ativas,
    total_dmg_positivo,
    total_em_insulina,
    total_partos,
    partos_vaginais,
    partos_cesarea,
    rn_aig,
    rn_gig,
    rn_pig,
    intercorrencias_maternas,
    intercorrencias_neonatais,
    total_profissionais: total_profissionais ?? 0,
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
    ['Fichas no período', metricas.total_pacientes_periodo],
    ['Fichas ativas', metricas.total_fichas_ativas],
    ['Histórico de DMG', metricas.total_dmg_positivo],
    ['Em uso de insulina', metricas.total_em_insulina],
    ['Profissionais', metricas.total_profissionais],
  ];
  y = desenharGridKpis(page, helv, helvBold, kpis, y, cBgCard, cTexto, cMuted);

  // Partos
  y -= 20;
  y = desenharSecao(page, helvBold, 'Partos no período', y, cRoxo);
  const partosKpis: Array<[string, string | number]> = [
    ['Total de partos', metricas.total_partos],
    ['Vaginais', metricas.partos_vaginais],
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
  if (metricas.total_pacientes_periodo === 0 && metricas.total_partos === 0) {
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

        const ehVazia = metricas.total_pacientes_periodo === 0 && metricas.total_partos === 0;

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
          const ehVazia = metricas.total_pacientes_periodo === 0 && metricas.total_partos === 0;
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

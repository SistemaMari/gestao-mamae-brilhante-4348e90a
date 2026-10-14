// Relatório mensal por unidade: agregação de métricas (schema 18A) + PDF.
// Extraído de gerar-relatorios-mensais para ser reutilizado SEM disparar a
// geração para todas as unidades (ex.: carga da Rede de Demonstração, que
// gera só as unidades dela). Comportamento idêntico ao que estava inline.

import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

// ============================================================
// Agregação de métricas por unidade — schema 18A (21 chaves)
// ============================================================
export interface MetricasUnidade {
  // Identidade
  unidade_id: string;
  unidade_nome: string;
  // Núcleo
  total_gestantes: number;            // = gestantes ACOMPANHADAS no mês (com consulta no mês)
  gestantes_novas: number;            // cadastradas no mês
  gestantes_rastreadas: number;       // com Retorno 1 ou GTT no mês (denominador da taxa)
  total_dmg_confirmado: number;       // gestantes com DMG confirmado (1/6/6B) no mês
  taxa_dmg_percent: number;           // derivado: total_dmg_confirmado / gestantes_rastreadas * 100
  total_overt: number;                // overt diabetes (cenário clínico)
  // Diagnóstico por momento
  dmg_retorno1: number;               // DMG diagnosticado a partir de Retorno 1
  dmg_gtt: number;                    // DMG diagnosticado por GTT 75g
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

// cenario_clinico é gravado CRU pelo gerar-laudo ('1','6','6B','8'...). Aceita
// também o formato legado prefixado ('cenario_1') e o texto livre antigo
// ("DMG confirmado", "overt"), para não zerar relatórios de dados antigos.
// DMG = Retorno 1 (1) ou GTT (6 / 6B); overt (8) é contado à parte.
const CENARIOS_DMG = new Set(['1', '6', '6b', 'cenario_1', 'cenario_6', 'cenario_6b']);
const CENARIOS_OVERT = new Set(['8', 'cenario_8']);

export function ehCenarioDmg(cenario: string | null | undefined): boolean {
  const c = (cenario ?? '').trim().toLowerCase();
  if (!c) return false;
  if (CENARIOS_DMG.has(c)) return true;
  return c.includes('dmg') && !c.includes('sem dmg') && !c.includes('não tem') && !c.includes('nao tem');
}

export function ehCenarioOvert(cenario: string | null | undefined): boolean {
  const c = (cenario ?? '').trim().toLowerCase();
  if (!c) return false;
  return CENARIOS_OVERT.has(c) || c.includes('overt');
}

// Busca todas as linhas de uma consulta paginando de 1000 em 1000 (limite do PostgREST).
async function todasAsLinhas(montar: (de: number, ate: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    const pagina: any[] = data ?? [];
    out.push(...pagina);
    if (pagina.length < 1000) return out;
  }
}

/**
 * Métricas do mês de uma unidade. Definições (revisadas em 14/out/2026, iguais
 * às dos painéis):
 *  - total_gestantes = gestantes ACOMPANHADAS no mês (com consulta no mês).
 *    Antes contava só as cadastradas no mês: quem chegou antes sumia do
 *    relatório dos meses seguintes. As cadastradas viram `gestantes_novas`.
 *  - taxa_dmg_percent = gestantes com DMG confirmado (1/6/6B) no mês ÷
 *    gestantes rastreadas no mês (Retorno 1 ou GTT). Overt (8) à parte.
 *  - partos = encerramentos por parto no mês (a tabela partos não é mais
 *    gravada; registros antigos dela seguem contando, sem duplicar).
 *  - profissionais_ativos = profissionais que atenderam no mês (sem gestores).
 * As chaves de "com insulina", via de parto, RN e intercorrências seguem no
 * JSON por compatibilidade (só vêm da tabela partos antiga), mas saíram do PDF.
 */
export async function agregarMetricas(
  admin: any,
  unidadeId: string,
  unidadeNome: string,
  periodoInicio: string,
  periodoFim: string,
): Promise<MetricasUnidade> {
  // ---------- Consultas do mês (base de "acompanhadas" e do rastreio) ----------
  const consultas = await todasAsLinhas((de, ate) => admin
    .from('consultas')
    .select('id, paciente_id, profissional_id, tipo, cenario_clinico, pacientes!inner(unidade_id, is_rascunho)')
    .eq('pacientes.unidade_id', unidadeId)
    .eq('pacientes.is_rascunho', false)
    .eq('is_rascunho', false)
    .gte('data', periodoInicio)
    .lte('data', periodoFim)
    .order('id', { ascending: true })
    .range(de, ate));

  const acompanhadas = new Set<string>(consultas.map((c) => c.paciente_id as string));
  const total_gestantes = acompanhadas.size;

  const rastreadas = new Set<string>();
  const dmgSet = new Set<string>();
  const overtSet = new Set<string>();
  const retornoSet = new Set<string>();
  const gttSet = new Set<string>();
  for (const c of consultas) {
    const pid = c.paciente_id as string;
    if (c.tipo === 'retorno_1' || c.tipo === 'gtt') rastreadas.add(pid);
    if (ehCenarioOvert(c.cenario_clinico)) overtSet.add(pid);
    if (ehCenarioDmg(c.cenario_clinico)) {
      dmgSet.add(pid);
      if (c.tipo === 'retorno_1') retornoSet.add(pid);
      if (c.tipo === 'gtt') gttSet.add(pid);
    }
  }
  const total_dmg_confirmado = dmgSet.size;
  const total_overt = overtSet.size;
  const taxa_dmg_percent = rastreadas.size > 0
    ? Number(((total_dmg_confirmado / rastreadas.size) * 100).toFixed(1))
    : 0;

  // ---------- Novas gestantes (cadastradas no mês) ----------
  const { count: gestantes_novas } = await admin
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .eq('is_rascunho', false)
    .gte('created_at', `${periodoInicio}T03:00:00Z`)
    .lt('created_at', `${proximoDia(periodoFim)}T03:00:00Z`);

  // ---------- Gestantes acompanhadas: status e perfis ----------
  const idsAcompanhadas = Array.from(acompanhadas);
  let encaminhadas_especialista = 0;
  let controle_adequado_sem_insulina = 0;
  const controle_com_insulina = 0;
  const controle_adequado_com_insulina = 0;
  for (let i = 0; i < idsAcompanhadas.length; i += 200) {
    const lote = idsAcompanhadas.slice(i, i + 200);
    const { data: pacs } = await admin.from('pacientes').select('id, status_ficha').in('id', lote);
    encaminhadas_especialista += ((pacs ?? []) as any[]).filter((p) => {
      const s = ((p.status_ficha as string | null) ?? '').toLowerCase();
      return s.includes('encaminh') || s.includes('especialista');
    }).length;

    const { data: perfis } = await admin
      .from('perfis_glicemicos')
      .select('paciente_id, percentual_meta, data_fim')
      .in('paciente_id', lote)
      .lte('data_fim', periodoFim);
    // Perfil mais recente (até o fim do mês) por gestante: adequado = ≥ 70% na meta.
    const ultimo = new Map<string, number>();
    ((perfis ?? []) as any[])
      .sort((a, b) => String(b.data_fim).localeCompare(String(a.data_fim)))
      .forEach((p) => { if (!ultimo.has(p.paciente_id)) ultimo.set(p.paciente_id, Number(p.percentual_meta) || 0); });
    ultimo.forEach((pct) => { if (pct >= 70) controle_adequado_sem_insulina++; });
  }

  // ---------- Laudos do mês ----------
  const { count: total_laudos } = await admin
    .from('laudos')
    .select('id, pacientes!inner(unidade_id)', { count: 'exact', head: true })
    .eq('pacientes.unidade_id', unidadeId)
    .gte('created_at', `${periodoInicio}T03:00:00Z`)
    .lt('created_at', `${proximoDia(periodoFim)}T03:00:00Z`);

  // ---------- Partos do mês: encerramento por parto (+ tabela partos antiga) ----------
  const { data: encerradasParto } = await admin
    .from('pacientes')
    .select('id, data_encerramento, data_ultima_consulta, motivo_encerramento, status_ficha')
    .eq('unidade_id', unidadeId)
    .eq('is_rascunho', false)
    .or('motivo_encerramento.eq.parto,status_ficha.eq.resultado_parto');
  const partoPorGestante = new Map<string, string>();
  for (const p of (encerradasParto ?? []) as any[]) {
    const d = (p.data_encerramento ?? p.data_ultima_consulta) as string | null;
    if (d && d >= periodoInicio && d <= periodoFim) partoPorGestante.set(p.id, d);
  }
  const { data: partos } = await admin
    .from('partos')
    .select('paciente_id, via_parto, classificacao_rn, intercorrencia_materna, intercorrencia_neonatal')
    .eq('unidade_id', unidadeId)
    .eq('is_rascunho', false)
    .gte('data_parto', periodoInicio)
    .lte('data_parto', periodoFim);
  const partosArr: any[] = partos ?? [];
  for (const p of partosArr) partoPorGestante.set(p.paciente_id, 'tabela');
  const partos_registrados = partoPorGestante.size;
  const partos_vaginal = partosArr.filter((p) => p.via_parto === 'vaginal').length;
  const partos_cesarea = partosArr.filter((p) => p.via_parto === 'cesarea').length;
  const rn_aig = partosArr.filter((p) => p.classificacao_rn === 'AIG').length;
  const rn_gig = partosArr.filter((p) => p.classificacao_rn === 'GIG').length;
  const rn_pig = partosArr.filter((p) => p.classificacao_rn === 'PIG').length;
  const intercorrencias_maternas = partosArr.filter((p) => p.intercorrencia_materna).length;
  const intercorrencias_neonatais = partosArr.filter((p) => p.intercorrencia_neonatal).length;

  // ---------- Profissionais que atenderam no mês (sem gestor/sistema/revogados) ----------
  const idsProfs = Array.from(new Set(consultas.map((c) => c.profissional_id as string).filter(Boolean)));
  let profissionais_ativos = 0;
  if (idsProfs.length > 0) {
    const { data: profs } = await admin
      .from('profissionais')
      .select('id, perfil_institucional, acesso_revogado')
      .in('id', idsProfs);
    profissionais_ativos = ((profs ?? []) as any[]).filter((p) =>
      !p.acesso_revogado && p.perfil_institucional !== 'gestor' && p.perfil_institucional !== 'sistema').length;
  }

  return {
    unidade_id: unidadeId,
    unidade_nome: unidadeNome,
    total_gestantes,
    gestantes_novas: gestantes_novas ?? 0,
    gestantes_rastreadas: rastreadas.size,
    total_dmg_confirmado,
    taxa_dmg_percent,
    total_overt,
    dmg_retorno1: retornoSet.size,
    dmg_gtt: gttSet.size,
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
    profissionais_ativos,
    total_laudos: total_laudos ?? 0,
  };
}

/** 'YYYY-MM-DD' do dia seguinte (para fechar o mês em horário de Brasília). */
function proximoDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// Geração de PDF programático com pdf-lib
// ============================================================
export async function gerarPdfRelatorio(params: {
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
  page.drawText('MARI', {
    x: 40, y: y + 25, size: 18, font: helvBold, color: rgb(1, 1, 1),
  });
  page.drawText('Relatório Mensal de Gestão (gerado automaticamente)', {
    x: 40, y: y + 5, size: 10, font: helv, color: rgb(1, 1, 1),
  });

  y -= 80;

  // Subcabeçalho — unidade e período
  page.drawText(textoPdf(metricas.unidade_nome), {
    x: 40, y, size: 14, font: helvBold, color: cRoxo,
  });
  y -= 18;
  page.drawText(textoPdf(`Período: ${formatarData(periodoInicio)} a ${formatarData(periodoFim)} (${rotuloMes})`), {
    x: 40, y, size: 10, font: helv, color: cMuted,
  });
  y -= 30;

  // KPIs gerais
  y = desenharSecao(page, helvBold, 'Visão Geral', y, cRoxo);
  const kpis: Array<[string, string | number]> = [
    ['Acompanhadas no mês', metricas.total_gestantes],
    ['Novas no mês', metricas.gestantes_novas],
    ['Rastreadas (GJ/GTT)', metricas.gestantes_rastreadas],
    ['Profissionais atenderam', metricas.profissionais_ativos],
    ['Laudos no mês', metricas.total_laudos],
  ];
  y = desenharGridKpis(page, helv, helvBold, kpis, y, cBgCard, cTexto, cMuted);

  // Diagnóstico por momento
  y -= 20;
  y = desenharSecao(page, helvBold, 'Diagnóstico de DMG', y, cRoxo);
  const dxKpis: Array<[string, string | number]> = [
    ['DMG confirmado', metricas.total_dmg_confirmado],
    ['Taxa de DMG (%)', metricas.taxa_dmg_percent],
    ['DMG via Retorno 1', metricas.dmg_retorno1],
    ['DMG via GTT 75g', metricas.dmg_gtt],
    ['Overt (à parte)', metricas.total_overt],
  ];
  y = desenharGridKpis(page, helv, helvBold, dxKpis, y, cBgCard, cTexto, cMuted);

  // Controle glicêmico e desfechos. "Com insulina" saiu (o app não registra
  // uso de insulina — a jornada encerra na indicação), assim como via de parto,
  // RN e intercorrências (só vinham da tabela partos, que não é mais gravada).
  y -= 20;
  y = desenharSecao(page, helvBold, 'Controle glicêmico e desfechos', y, cRoxo);
  const ctrlKpis: Array<[string, string | number]> = [
    ['Controle adequado (70%+)', metricas.controle_adequado_sem_insulina],
    ['Partos no mês', metricas.partos_registrados],
  ];
  y = desenharGridKpis(page, helv, helvBold, ctrlKpis, y, cBgCard, cTexto, cMuted);

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
  page.drawText(textoPdf(`Gerado automaticamente pelo sistema em ${new Date().toLocaleString('pt-BR')}`), {
    x: 40, y: rodapeY + 5, size: 8, font: helv, color: cMuted,
  });
  page.drawText('Origem: AUTOMÁTICO', {
    x: width - 150, y: rodapeY + 5, size: 8, font: helvBold, color: cLilas,
  });

  return await pdf.save();
}

// As fontes padrão do pdf-lib só codificam WinAnsi (Latin-1 + extras do
// CP1252). Qualquer outro caractere (ex.: "≥") derruba a geração inteira com
// "WinAnsi cannot encode" — troca pelos equivalentes ou por "?".
const WINANSI_EXTRAS = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);
function textoPdf(texto: string): string {
  return Array.from(String(texto ?? ''))
    .map((ch) => {
      if (ch === '≥') return '>=';
      if (ch === '≤') return '<=';
      const c = ch.codePointAt(0) ?? 0;
      return c <= 255 || WINANSI_EXTRAS.has(ch) ? ch : '?';
    })
    .join('');
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
    page.drawText(textoPdf(kpi[0]), {
      x: x + 8, y: y - 40, size: 7, font: fontReg, color: cMuted,
    });
    x += cardW + gap;
  });

  return y - cardH - gap;
}


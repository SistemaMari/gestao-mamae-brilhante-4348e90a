// Relatório mensal por unidade: agregação de métricas (schema 18A) + PDF.
// Extraído de gerar-relatorios-mensais para ser reutilizado SEM disparar a
// geração para todas as unidades (ex.: carga da Rede de Demonstração, que
// gera só as unidades dela). Comportamento idêntico ao que estava inline.

import { gerarPdfRelatorio, textoPdf, type DadosExtrasRelatorio } from './relatorioMensalPdf.ts';

// O desenho do PDF mora em relatorioMensalPdf.ts (mesmo visual do PDF do painel).
export { gerarPdfRelatorio, textoPdf };
export type { DadosExtrasRelatorio };

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
  total_dmg_confirmado: number;       // gestantes com diabetes confirmado (DMG 1/6/6B + overt 8) no mês
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
  // Gestantes encerradas na MARI por indicação de insulina no mês (motivo
  // 'insulinizacao'): a insulina encerra o acompanhamento da MARI.
  encaminhadas_insulina: number;
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
// Diabetes confirmado na gestação = DMG por Retorno 1 (1) ou GTT (6 / 6B) E
// overt (8) — decisão de 15/out/2026: overt entra na taxa (igual aos painéis).
// total_overt segue contado para mostrar quantos dos diagnósticos são overt.
const CENARIOS_DMG = new Set(['1', '6', '6b', '8', 'cenario_1', 'cenario_6', 'cenario_6b', 'cenario_8']);
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
 *  - taxa_dmg_percent = gestantes com diabetes confirmado no mês — DMG (1/6/6B)
 *    E overt (8), que conta DENTRO da taxa — ÷ gestantes rastreadas no mês
 *    (Retorno 1 ou GTT). total_overt mostra quantos desses são overt.
 *  - partos = encerramentos por parto no mês (a tabela partos não é mais
 *    gravada; registros antigos dela seguem contando, sem duplicar).
 *  - encaminhadas_insulina = encerramentos por insulinização no mês (a
 *    indicação de insulina encerra a MARI; a gestante segue no serviço de
 *    insulina).
 *  - profissionais_ativos = profissionais que atenderam no mês (sem gestores).
 * As chaves controle_com_insulina / controle_adequado_com_insulina, via de
 * parto, RN e intercorrências seguem no JSON por compatibilidade (o
 * consolidar-relatorios ainda as lê; só vêm da tabela partos antiga ou ficam
 * 0), mas NÃO aparecem no PDF — não há dado para elas.
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

  // ---------- Encerramentos do mês: parto (+ tabela partos antiga) e insulina ----------
  const { data: encerradas } = await admin
    .from('pacientes')
    .select('id, data_encerramento, data_ultima_consulta, motivo_encerramento, status_ficha')
    .eq('unidade_id', unidadeId)
    .eq('is_rascunho', false)
    .or('motivo_encerramento.in.(parto,insulinizacao),status_ficha.eq.resultado_parto');
  const partoPorGestante = new Map<string, string>();
  let encaminhadas_insulina = 0;
  for (const p of (encerradas ?? []) as any[]) {
    const d = String(p.data_encerramento ?? p.data_ultima_consulta ?? '').slice(0, 10);
    if (!d || d < periodoInicio || d > periodoFim) continue;
    if (p.motivo_encerramento === 'insulinizacao') encaminhadas_insulina++;
    else partoPorGestante.set(p.id, d);
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
    encaminhadas_insulina,
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
// PDF completo: métricas do mês + mês anterior + linha de cuidado/tendência/metas
// ============================================================

/** Primeiro e último dia do mês-calendário anterior ao período. */
export function mesAnterior(periodoInicio: string): { inicio: string; fim: string } {
  const [a, m] = periodoInicio.split('-').map(Number);
  const ini = new Date(Date.UTC(a, m - 2, 1));
  const fim = new Date(Date.UTC(a, m - 1, 0));
  return { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/** Linha de cuidado, 6 meses e metas da rede (migration 20261015200000). Null se ainda não existir. */
export async function buscarExtrasRelatorio(
  admin: any,
  unidadeId: string,
  periodoInicio: string,
  periodoFim: string,
): Promise<DadosExtrasRelatorio | null> {
  const { data, error } = await admin.rpc('_relatorio_mensal_dados', {
    p_unidade_id: unidadeId,
    p_inicio: periodoInicio,
    p_fim: periodoFim,
  });
  if (error) {
    console.warn('[relatorioMensal] _relatorio_mensal_dados indisponível:', error.message);
    return null;
  }
  return (data ?? null) as DadosExtrasRelatorio | null;
}

/**
 * Gera o PDF do mês com a comparação com o mês anterior e os dados extras.
 * Se algo extra falhar, o PDF sai mesmo assim (só sem aquela parte).
 */
export async function gerarPdfRelatorioCompleto(
  admin: any,
  params: { metricas: MetricasUnidade; periodoInicio: string; periodoFim: string; rotuloMes: string },
): Promise<Uint8Array> {
  const { metricas, periodoInicio, periodoFim, rotuloMes } = params;
  const ant = mesAnterior(periodoInicio);
  const [anterior, extras] = await Promise.all([
    agregarMetricas(admin, metricas.unidade_id, metricas.unidade_nome, ant.inicio, ant.fim).catch((e) => {
      console.warn('[relatorioMensal] métricas do mês anterior:', e?.message ?? e);
      return null;
    }),
    buscarExtrasRelatorio(admin, metricas.unidade_id, periodoInicio, periodoFim).catch(() => null),
  ]);
  return gerarPdfRelatorio({ metricas, periodoInicio, periodoFim, rotuloMes, anterior, extras });
}

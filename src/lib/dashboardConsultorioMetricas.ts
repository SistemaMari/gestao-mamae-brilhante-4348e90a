/**
 * Métricas do "Meu Dashboard" (consultório/institucional) — funções puras.
 *
 * Blocos: Controle glicêmico, Perfil das gestantes, Desfechos do parto e
 * Engajamento. Tudo sai de dados que o app já grava:
 *  - pacientes (data_nascimento, dmg_gestacao_anterior, data_encerramento…)
 *  - consultas (cenário, IG, data; o registro de parto guarda os dados do
 *    parto como JSON em `observacoes`, tipo 'registro_parto')
 *  - perfis_glicemicos (percentual_meta de cada perfil)
 *  - partos (tabela usada pelas redes/seeds — fallback do registro de parto)
 */
import { differenceInDays } from 'date-fns';
import { parseDateLocal } from '@/lib/dateUtils';

export interface PacienteMetrica {
  id: string;
  created_at: string;
  data_nascimento?: string | null;
  dmg_gestacao_anterior?: boolean | null;
  data_encerramento?: string | null;
  data_ultima_consulta?: string | null;
}

export interface ConsultaMetrica {
  id: string;
  paciente_id: string;
  tipo: string;
  cenario_clinico: string | null;
  data?: string | null;
  ig_semanas?: number | null;
  ig_dias?: number | null;
  observacoes?: string | null;
}

export interface PerfilMetrica {
  paciente_id: string;
  percentual_meta: number | null;
  data_inicio?: string | null;
  created_at: string;
}

export interface PartoTabela {
  paciente_id: string;
  via_parto: string | null;
  classificacao_rn: string | null;
  peso_rn_g: number | null;
  ig_parto_semanas: number | null;
  ig_parto_dias: number | null;
  intercorrencia_materna: boolean | null;
  intercorrencia_neonatal: boolean | null;
}

export interface PartoRegistro {
  paciente_id: string;
  via_parto: string | null;
  classificacao_rn: string | null;
  peso_rn_g: number | null;
  /** IG no parto em semanas decimais (ex.: 38,4). */
  ig: number | null;
  intercorrencia_materna: boolean;
  intercorrencia_neonatal: boolean;
  aleitamento_sala_parto: boolean | null;
}

const cen = (c: ConsultaMetrica) => (c.cenario_clinico ?? '').trim().toUpperCase();

/** Consulta que FECHOU o diagnóstico de DMG/Overt (Retorno 1 com GJ ≥92 ou Overt; GTT alterado). */
export function consultaDiagnosticaDmg(c: ConsultaMetrica): boolean {
  const k = cen(c);
  if (k === '6' || k === '6B' || k === '8') return true;
  return c.tipo === 'retorno_1' && k === '1';
}

const igDecimal = (sem: number | null | undefined, dias: number | null | undefined): number | null =>
  sem == null ? null : sem + (dias ?? 0) / 7;

const media = (xs: number[]): number | null =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;

/** Idade em anos completos na data de referência. */
export function idadeNaData(nascimento: string | null | undefined, ref: Date): number | null {
  const nasc = parseDateLocal(nascimento ?? null);
  if (!nasc) return null;
  let idade = ref.getFullYear() - nasc.getFullYear();
  const m = ref.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade >= 10 && idade <= 60 ? idade : null; // descarta datas digitadas erradas
}

export const FAIXAS_ETARIAS = ['<25', '25–29', '30–34', '35–39', '≥40'] as const;
export type FaixaEtaria = (typeof FAIXAS_ETARIAS)[number];

export function faixaEtaria(idade: number): FaixaEtaria {
  if (idade < 25) return '<25';
  if (idade < 30) return '25–29';
  if (idade < 35) return '30–34';
  if (idade < 40) return '35–39';
  return '≥40';
}

/** Data (yyyy-MM-dd) e IG da 1ª consulta que diagnosticou DMG, por gestante. */
export function diagnosticoPorPaciente(consultas: ConsultaMetrica[]) {
  const out = new Map<string, { data: string | null; ig: number | null }>();
  const ordenadas = [...consultas]
    .filter(consultaDiagnosticaDmg)
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  for (const c of ordenadas) {
    if (out.has(c.paciente_id)) continue;
    out.set(c.paciente_id, { data: c.data ?? null, ig: igDecimal(c.ig_semanas, c.ig_dias) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Perfil das gestantes
// ---------------------------------------------------------------------------

export function perfilGestantes<P extends PacienteMetrica>(
  pacientes: P[],
  temDmg: (p: P) => boolean,
  consultas: ConsultaMetrica[],
) {
  const idades: number[] = [];
  const faixas = FAIXAS_ETARIAS.map((faixa) => ({ faixa, total: 0, dmg: 0 }));
  for (const p of pacientes) {
    const idade = idadeNaData(p.data_nascimento, new Date(p.created_at));
    if (idade == null) continue;
    idades.push(idade);
    const f = faixas.find((x) => x.faixa === faixaEtaria(idade))!;
    f.total++;
    if (temDmg(p)) f.dmg++;
  }

  // Faixa de maior prevalência = maior taxa de DMG entre as faixas com ≥2
  // gestantes (com 1 só, qualquer DMG vira "100%" e engana). Empate → mais casos.
  const candidatas = faixas.filter((f) => f.total >= 2 && f.dmg > 0);
  const faixaMaiorPrevalencia = candidatas.length
    ? candidatas.reduce((a, b) => {
        const ta = a.dmg / a.total, tb = b.dmg / b.total;
        if (tb > ta) return b;
        if (tb === ta && b.dmg > a.dmg) return b;
        return a;
      })
    : null;

  const dmg = pacientes.filter(temDmg);
  const comDmgAnterior = pacientes.filter((p) => p.dmg_gestacao_anterior === true);
  const dmgComAnterior = dmg.filter((p) => p.dmg_gestacao_anterior === true);

  const diag = diagnosticoPorPaciente(consultas);
  const igsDiag = dmg
    .map((p) => diag.get(p.id)?.ig)
    .filter((x): x is number => x != null);

  return {
    idadeMedia: media(idades),
    comIdade: idades.length,
    faixas,
    faixaMaiorPrevalencia,
    dmgTotal: dmg.length,
    /** gestantes com DMG agora que também tiveram em gestação anterior */
    dmgComAnterior,
    /** gestantes com DMG prévio (todas) — base da recorrência */
    comDmgAnterior,
    igMediaDiagnostico: media(igsDiag),
    comIgDiagnostico: igsDiag.length,
  };
}

// ---------------------------------------------------------------------------
// Controle glicêmico
// ---------------------------------------------------------------------------

export function controleGlicemico<P extends PacienteMetrica>(
  dmg: P[],
  insulinaIds: Set<string>,
  perfis: PerfilMetrica[],
  consultas: ConsultaMetrica[],
) {
  const soDieta = dmg.filter((p) => !insulinaIds.has(p.id));
  const comInsulina = dmg.filter((p) => insulinaIds.has(p.id));

  // % de medidas na meta: último perfil de cada gestante com DMG.
  const ultimoPerfil = new Map<string, PerfilMetrica>();
  for (const pf of perfis) {
    if (pf.percentual_meta == null) continue;
    const atual = ultimoPerfil.get(pf.paciente_id);
    const chave = (x: PerfilMetrica) => `${x.data_inicio ?? ''}|${x.created_at}`;
    if (!atual || chave(pf) > chave(atual)) ultimoPerfil.set(pf.paciente_id, pf);
  }
  const metas = dmg
    .map((p) => ultimoPerfil.get(p.id)?.percentual_meta)
    .filter((x): x is number => x != null);

  // Dias do diagnóstico até a indicação de insulina (data_encerramento).
  const diag = diagnosticoPorPaciente(consultas);
  const dias: number[] = [];
  for (const p of comInsulina) {
    const d0 = parseDateLocal(diag.get(p.id)?.data ?? null);
    const d1 = parseDateLocal(p.data_encerramento ?? null);
    if (d0 && d1 && d1 >= d0) dias.push(differenceInDays(d1, d0));
  }

  return {
    soDieta,
    comInsulina,
    mediaNaMeta: media(metas),
    comPerfil: metas.length,
    diasAteInsulina: media(dias),
    comDiasAteInsulina: dias.length,
  };
}

// ---------------------------------------------------------------------------
// Desfechos do parto
// ---------------------------------------------------------------------------

/**
 * Junta os partos: o registro de parto do app (consulta 'registro_parto' com o
 * JSON em `observacoes`) e, para quem não tem, a tabela `partos`.
 */
export function extrairPartos(consultas: ConsultaMetrica[], tabela: PartoTabela[]): PartoRegistro[] {
  const porPaciente = new Map<string, PartoRegistro>();
  for (const c of consultas) {
    if (c.tipo !== 'registro_parto' || !c.observacoes) continue;
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(c.observacoes);
    } catch {
      continue;
    }
    if (!d || typeof d !== 'object') continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    porPaciente.set(c.paciente_id, {
      paciente_id: c.paciente_id,
      via_parto: typeof d.via_parto === 'string' ? d.via_parto : null,
      classificacao_rn: typeof d.classificacao_rn === 'string' ? d.classificacao_rn : null,
      peso_rn_g: num(d.peso_rn_g) || null,
      ig: igDecimal(num(d.ig_semanas) ?? c.ig_semanas, num(d.ig_dias) ?? c.ig_dias),
      intercorrencia_materna: d.intercorrencias_maternas === true,
      intercorrencia_neonatal: d.intercorrencias_neonatais === true,
      aleitamento_sala_parto: typeof d.aleitamento_sala_parto === 'boolean' ? d.aleitamento_sala_parto : null,
    });
  }
  for (const t of tabela) {
    if (porPaciente.has(t.paciente_id)) continue;
    porPaciente.set(t.paciente_id, {
      paciente_id: t.paciente_id,
      via_parto: t.via_parto,
      classificacao_rn: t.classificacao_rn,
      peso_rn_g: t.peso_rn_g || null,
      ig: igDecimal(t.ig_parto_semanas, t.ig_parto_dias),
      intercorrencia_materna: !!t.intercorrencia_materna,
      intercorrencia_neonatal: !!t.intercorrencia_neonatal,
      aleitamento_sala_parto: null,
    });
  }
  return [...porPaciente.values()];
}

export function desfechosParto(partos: PartoRegistro[]) {
  const igs = partos.map((p) => p.ig).filter((x): x is number => x != null);
  const pesos = partos.map((p) => p.peso_rn_g).filter((x): x is number => x != null);
  const comAleitamento = partos.filter((p) => p.aleitamento_sala_parto != null);
  return {
    total: partos.length,
    cesarea: partos.filter((p) => p.via_parto === 'cesarea'),
    vaginal: partos.filter((p) => p.via_parto === 'vaginal'),
    igMedia: media(igs),
    /** prematuro = parto antes de 37 semanas */
    prematuros: partos.filter((p) => p.ig != null && p.ig < 37),
    comIg: igs.length,
    pesoMedio: media(pesos),
    /** macrossomia = RN com 4.000 g ou mais */
    macrossomia: partos.filter((p) => p.peso_rn_g != null && p.peso_rn_g >= 4000),
    comPeso: pesos.length,
    aig: partos.filter((p) => p.classificacao_rn === 'AIG'),
    gig: partos.filter((p) => p.classificacao_rn === 'GIG'),
    pig: partos.filter((p) => p.classificacao_rn === 'PIG'),
    intercorrenciaMaterna: partos.filter((p) => p.intercorrencia_materna),
    intercorrenciaNeonatal: partos.filter((p) => p.intercorrencia_neonatal),
    aleitamento: comAleitamento.filter((p) => p.aleitamento_sala_parto === true).length,
    comAleitamento: comAleitamento.length,
  };
}

// ---------------------------------------------------------------------------
// Engajamento
// ---------------------------------------------------------------------------

export function engajamento(
  pacientes: PacienteMetrica[],
  consultas: ConsultaMetrica[],
  perfis: PerfilMetrica[],
  dmgTotal: number,
  encerrada: (p: PacienteMetrica) => boolean,
  hoje: Date = new Date(),
) {
  const ids = new Set(pacientes.map((p) => p.id));
  const consultasDoGrupo = consultas.filter((c) => ids.has(c.paciente_id));
  const perfisDoGrupo = perfis.filter((pf) => ids.has(pf.paciente_id));

  // Tempo de acompanhamento: cadastro → encerramento (ou hoje, se ativa).
  const semanas: number[] = [];
  for (const p of pacientes) {
    const ini = new Date(p.created_at);
    const fim = encerrada(p)
      ? parseDateLocal(p.data_encerramento ?? p.data_ultima_consulta ?? null)
      : hoje;
    if (fim && fim >= ini) semanas.push(differenceInDays(fim, ini) / 7);
  }

  return {
    consultas: consultasDoGrupo.length,
    consultasPorGestante: pacientes.length ? consultasDoGrupo.length / pacientes.length : null,
    perfis: perfisDoGrupo.length,
    perfisPorDmg: dmgTotal ? perfisDoGrupo.length / dmgTotal : null,
    semanasAcompanhamento: media(semanas),
  };
}

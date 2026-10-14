// Indicadores da linha de cuidado (RPCs get_painel_linha_cuidado e
// get_linha_cuidado_gestor_geral). Tipos + cálculos de apresentação
// (variação vs. período anterior, faixas de idade, etapas do funil).
// As CONTAS clínicas ficam no banco (_linha_cuidado_calc); os limiares
// provisórios (perfil completo / na meta) vêm no próprio payload ('criterios').

import type { Periodo } from "@/lib/periodo";

export type MotivoEncerramentoLC = "insulinizacao" | "parto" | "aborto" | "nao_retornou" | "outro";

export interface LinhaCuidadoBloco {
  periodo: Periodo;
  criterios: {
    perfil_min_dias: number;
    meta_pct: number;
    ig_limite_semanas: number;
    provisorio: boolean;
  };
  funil: {
    rastreadas: number;
    diagnosticadas: number;
    em_acompanhamento: number;
    encerradas: Record<MotivoEncerramentoLC, number>;
    encerradas_total: number;
    taxa_diagnostico_pct: number | null;
    perda_seguimento_pct: number | null;
  };
  adesao: {
    diagnosticadas: number;
    com_perfil: number;
    com_perfil_completo: number;
    perfil_completo_pct: number | null;
    ultimo_na_meta: number;
    ultimo_na_meta_pct: number | null;
  };
  tempos: {
    gj_gtt_mediana_dias: number | null;
    gj_gtt_n: number;
    diag_perfil_mediana_dias: number | null;
    diag_perfil_n: number;
    diag_insulina_mediana_dias: number | null;
    diag_insulina_n: number;
    diag_com_ig: number;
    diag_antes_28s: number;
    diag_antes_28s_pct: number | null;
  };
  perfil_gestantes: {
    atendidas: number;
    faixas_idade: Record<FaixaIdade, number>;
    dmg_anterior: number;
    dmg_anterior_pct: number | null;
  };
}

export interface LinhaCuidadoResposta {
  atual: LinhaCuidadoBloco;
  anterior: LinhaCuidadoBloco;
}

// ── variação vs. período anterior ──────────────────────────────────────────

/** Como ler a subida: mais rastreio é bom; mais perda de seguimento é ruim; mais diagnóstico é neutro. */
export type SentidoIndicador = "bom_subir" | "ruim_subir" | "neutro";
/** contagem → variação absoluta (+ %); pct → pontos percentuais; dias → diferença em dias. */
export type UnidadeIndicador = "contagem" | "pct" | "dias";

export interface Variacao {
  direcao: "subiu" | "caiu" | "igual" | "sem_base";
  /** atual − anterior (na unidade do indicador). */
  delta: number | null;
  /** Só para contagem com anterior > 0: variação relativa em %. */
  deltaPct: number | null;
  tom: "bom" | "ruim" | "neutro";
}

const arred1 = (n: number) => Math.round(n * 10) / 10;

export function compararIndicador(
  atual: number | null | undefined,
  anterior: number | null | undefined,
  unidade: UnidadeIndicador,
  sentido: SentidoIndicador,
): Variacao {
  if (atual == null || anterior == null || Number.isNaN(atual) || Number.isNaN(anterior)) {
    return { direcao: "sem_base", delta: null, deltaPct: null, tom: "neutro" };
  }
  const delta = arred1(Number(atual) - Number(anterior));
  const deltaPct =
    unidade === "contagem" && Number(anterior) > 0 ? arred1((delta / Number(anterior)) * 100) : null;
  if (delta === 0) return { direcao: "igual", delta: 0, deltaPct: unidade === "contagem" && Number(anterior) > 0 ? 0 : null, tom: "neutro" };
  const direcao = delta > 0 ? "subiu" : "caiu";
  let tom: Variacao["tom"] = "neutro";
  if (sentido === "bom_subir") tom = delta > 0 ? "bom" : "ruim";
  if (sentido === "ruim_subir") tom = delta > 0 ? "ruim" : "bom";
  return { direcao, delta, deltaPct, tom };
}

/** Número com até 1 casa decimal e sinal (+/−), no idioma da tela. */
export function formatarComSinal(n: number, locale = "pt-BR"): string {
  const abs = Math.abs(n).toLocaleString(locale, { maximumFractionDigits: 1 });
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

/**
 * Texto curto da variação, sem a unidade de dias (a tela traduz):
 * contagem "+3 (+25%)", pct "+2,5 p.p.", dias "−4".
 */
export function textoVariacao(v: Variacao, unidade: UnidadeIndicador, locale = "pt-BR"): string {
  if (v.delta == null) return "";
  const base = formatarComSinal(v.delta, locale);
  if (unidade === "pct") return `${base} p.p.`;
  if (unidade === "contagem" && v.deltaPct != null && v.delta !== 0) {
    return `${base} (${formatarComSinal(v.deltaPct, locale)}%)`;
  }
  return base;
}

// ── faixas de idade ─────────────────────────────────────────────────────────

export type FaixaIdade = "menos_20" | "de_20_34" | "de_35_39" | "mais_40" | "sem_info";
export const FAIXAS_IDADE: FaixaIdade[] = ["menos_20", "de_20_34", "de_35_39", "mais_40", "sem_info"];

/** Mesmas faixas do banco (idade em anos completos). */
export function faixaDaIdade(idade: number | null | undefined): FaixaIdade {
  if (idade == null || Number.isNaN(idade)) return "sem_info";
  if (idade < 20) return "menos_20";
  if (idade <= 34) return "de_20_34";
  if (idade <= 39) return "de_35_39";
  return "mais_40";
}

export interface FaixaPct {
  faixa: FaixaIdade;
  n: number;
  /** % sobre o total de atendidas (inclui "sem data de nascimento"). */
  pct: number;
}

export function faixasComPct(faixas: Partial<Record<FaixaIdade, number>> | null | undefined): FaixaPct[] {
  const total = FAIXAS_IDADE.reduce((s, f) => s + (faixas?.[f] ?? 0), 0);
  return FAIXAS_IDADE.map((faixa) => {
    const n = faixas?.[faixa] ?? 0;
    return { faixa, n, pct: total > 0 ? arred1((n / total) * 100) : 0 };
  });
}

// ── funil ───────────────────────────────────────────────────────────────────

export type EtapaFunil = "rastreadas" | "diagnosticadas" | "em_acompanhamento" | MotivoEncerramentoLC;
export const MOTIVOS_ENCERRAMENTO_LC: MotivoEncerramentoLC[] = [
  "insulinizacao",
  "parto",
  "aborto",
  "nao_retornou",
  "outro",
];

export interface LinhaFunil {
  etapa: EtapaFunil;
  n: number;
  /** % sobre as rastreadas (topo do funil), para o comprimento da barra. */
  pctDoTopo: number;
  /** % sobre as diagnosticadas (para os desfechos). */
  pctDasDiagnosticadas: number | null;
  grupo: "rastreio" | "desfecho";
}

export function linhasFunil(f: LinhaCuidadoBloco["funil"]): LinhaFunil[] {
  const topo = f.rastreadas;
  const pTopo = (n: number) => (topo > 0 ? arred1((n / topo) * 100) : 0);
  const pDiag = (n: number) => (f.diagnosticadas > 0 ? arred1((n / f.diagnosticadas) * 100) : null);
  const linhas: LinhaFunil[] = [
    { etapa: "rastreadas", n: f.rastreadas, pctDoTopo: pTopo(f.rastreadas), pctDasDiagnosticadas: null, grupo: "rastreio" },
    { etapa: "diagnosticadas", n: f.diagnosticadas, pctDoTopo: pTopo(f.diagnosticadas), pctDasDiagnosticadas: null, grupo: "rastreio" },
    {
      etapa: "em_acompanhamento",
      n: f.em_acompanhamento,
      pctDoTopo: pTopo(f.em_acompanhamento),
      pctDasDiagnosticadas: pDiag(f.em_acompanhamento),
      grupo: "desfecho",
    },
  ];
  for (const m of MOTIVOS_ENCERRAMENTO_LC) {
    const n = f.encerradas?.[m] ?? 0;
    linhas.push({ etapa: m, n, pctDoTopo: pTopo(n), pctDasDiagnosticadas: pDiag(n), grupo: "desfecho" });
  }
  return linhas;
}

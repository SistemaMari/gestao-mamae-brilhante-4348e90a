// Formatação e textos do relatório em PDF (pt-BR, como os demais PDFs do app).
import {
  compararIndicador,
  textoVariacao,
  type LinhaCuidadoBloco,
  type SentidoIndicador,
  type UnidadeIndicador,
} from "@/lib/linhaCuidado";
import { avaliarIndicador, CFG_META, type IndicadorMeta, type MetasRede } from "@/lib/metas";
import type { Tom } from "@/components/relatorioPdf/primitivos";

export const num = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));

export function pct(n: number | null | undefined, casas = 1): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 })}%`;
}

export const plural = (n: number, singular: string, pluralTxt: string) => (n === 1 ? singular : pluralTxt);

export function dias(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${v} ${Number(n) === 1 ? "dia" : "dias"}`;
}

/** Idade gestacional em dias → "19 sem 4 d". */
export function ig(totalDias: number | null | undefined): string {
  if (totalDias == null || Number.isNaN(Number(totalDias))) return "—";
  const t = Math.round(Number(totalDias));
  return `${Math.floor(t / 7)} sem ${t % 7} d`;
}

const br = (iso: string) => iso.split("-").reverse().join("/");

export function periodoTexto(p: { inicio: string; fim: string } | null | undefined): string {
  if (!p?.inicio || !p?.fim) return "";
  return `${br(p.inicio)} a ${br(p.fim)}`;
}

export function dataBr(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}

/** Pílula "+3 vs. período anterior" com a cor certa (mais perda de seguimento é ruim etc.). */
export function variacao(
  atual: number | null | undefined,
  anterior: number | null | undefined,
  unidade: UnidadeIndicador,
  sentido: SentidoIndicador,
): { texto: string; tom: Tom } | null {
  const v = compararIndicador(atual, anterior, unidade, sentido);
  if (v.direcao === "sem_base") return null;
  if (v.direcao === "igual") return { texto: "igual ao período anterior", tom: "neutro" };
  const base = textoVariacao(v, unidade);
  return { texto: `${base}${unidade === "dias" ? " dias" : ""} vs. período anterior`, tom: v.tom };
}

/** Selo da meta da rede para um indicador (null quando a rede não definiu meta). */
export function seloMeta(
  bloco: LinhaCuidadoBloco,
  indicador: IndicadorMeta,
  metas: MetasRede | null | undefined,
): { texto: string; tom: Tom; meta: string } | null {
  const r = avaliarIndicador(bloco, indicador, metas);
  if (r.situacao === "sem_meta" || r.meta == null) return null;
  const cfg = CFG_META[indicador];
  const metaTxt = `Meta: ${cfg.sentido === "minimo" ? "mínimo" : "máximo"} ${cfg.unidade === "pct" ? pct(r.meta) : dias(r.meta)}`;
  switch (r.situacao) {
    case "atingida":
      return { texto: "Meta atingida", tom: "bom", meta: metaTxt };
    case "nao_atingida":
      return { texto: cfg.sentido === "minimo" ? "Abaixo da meta" : "Acima do limite", tom: "alerta", meta: metaTxt };
    case "poucos_dados":
      return { texto: "Poucos dados", tom: "neutro", meta: metaTxt };
    default:
      return { texto: "Sem dados no período", tom: "neutro", meta: metaTxt };
  }
}

export const NOME_INDICADOR_META: Record<IndicadorMeta, string> = {
  diag_antes_28s_pct: "Diagnosticadas antes de 28 semanas",
  perda_seguimento_pct: "Perda de seguimento",
  perfil_completo_pct: "Perfil glicêmico completo",
  ultimo_na_meta_pct: "Último perfil com glicemia controlada",
  gj_gtt_mediana_dias: "Tempo da glicemia de jejum à curva glicêmica",
};

export function valorIndicadorTexto(bloco: LinhaCuidadoBloco, indicador: IndicadorMeta): string {
  const r = avaliarIndicador(bloco, indicador, null);
  return CFG_META[indicador].unidade === "pct" ? pct(r.valor) : dias(r.valor);
}

/** Faixa da taxa de diagnóstico em palavras. */
export function leituraFaixa(taxa: number | null | undefined, min: number, max: number): string {
  if (taxa == null) return "";
  if (taxa < min) return `abaixo da faixa esperada (${min}–${max}%) — pode indicar diagnósticos que estão escapando`;
  if (taxa > max) return `acima da faixa esperada (${min}–${max}%) — população de risco mais alto`;
  return `dentro da faixa esperada (${min}–${max}%)`;
}

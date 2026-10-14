// Metas da rede (tabela metas_rede; RPCs definir_meta_rede / remover_meta_rede).
// O gestor geral define, por rede, uma meta para alguns indicadores da linha de
// cuidado; os painéis mostram se a unidade/rede atingiu. Aqui fica a lógica de
// comparação (mínimo × máximo, poucos dados) — fonte única para as telas.

import type { LinhaCuidadoBloco } from "@/lib/linhaCuidado";

/** Mesma lista do CHECK de metas_rede.indicador. */
export type IndicadorMeta =
  | "diag_antes_28s_pct"
  | "perda_seguimento_pct"
  | "perfil_completo_pct"
  | "ultimo_na_meta_pct"
  | "gj_gtt_mediana_dias";

/** minimo = quanto maior melhor (meta é o piso); maximo = quanto menor melhor (meta é o teto). */
export type SentidoMeta = "minimo" | "maximo";
export type UnidadeMeta = "pct" | "dias";

export interface IndicadorMetaCfg {
  chave: IndicadorMeta;
  sentido: SentidoMeta;
  unidade: UnidadeMeta;
  /** Faixa aceita no campo (a RPC valida a mesma faixa). */
  min: number;
  max: number;
}

export const INDICADORES_META: IndicadorMetaCfg[] = [
  { chave: "diag_antes_28s_pct", sentido: "minimo", unidade: "pct", min: 0, max: 100 },
  { chave: "perda_seguimento_pct", sentido: "maximo", unidade: "pct", min: 0, max: 100 },
  { chave: "perfil_completo_pct", sentido: "minimo", unidade: "pct", min: 0, max: 100 },
  { chave: "ultimo_na_meta_pct", sentido: "minimo", unidade: "pct", min: 0, max: 100 },
  { chave: "gj_gtt_mediana_dias", sentido: "maximo", unidade: "dias", min: 0, max: 365 },
];

export const CFG_META: Record<IndicadorMeta, IndicadorMetaCfg> = Object.fromEntries(
  INDICADORES_META.map((c) => [c.chave, c]),
) as Record<IndicadorMeta, IndicadorMetaCfg>;

/**
 * Abaixo deste número de gestantes na base do indicador a tela mostra
 * "poucos dados" em vez de atingiu/não atingiu (1 gestante muda tudo).
 */
export const BASE_MINIMA_META = 5;

/** Uma linha da RPC get_linha_cuidado_por_unidade_gestor_geral. */
export interface LinhaCuidadoPorUnidade {
  unidade_id: string;
  unidade_nome: string;
  contratante_id: string | null;
  atual: LinhaCuidadoBloco;
}

/** Metas de UMA rede: indicador → valor. Indicador ausente = sem meta. */
export type MetasRede = Partial<Record<IndicadorMeta, number>>;

export interface LinhaMetaRede {
  contratante_id: string;
  indicador: string;
  valor: number | string;
}

/** A rede definiu ao menos uma meta? */
export function temMetas(metas: MetasRede | null | undefined): boolean {
  return !!metas && INDICADORES_META.some(({ chave }) => metas[chave] != null);
}

/** Agrupa as linhas da tabela por rede (ignora indicador desconhecido). */
export function agruparMetas(linhas: LinhaMetaRede[] | null | undefined): Record<string, MetasRede> {
  const out: Record<string, MetasRede> = {};
  for (const l of linhas ?? []) {
    if (!(l.indicador in CFG_META)) continue;
    const v = Number(l.valor);
    if (Number.isNaN(v)) continue;
    (out[l.contratante_id] ??= {})[l.indicador as IndicadorMeta] = v;
  }
  return out;
}

/** Valor do indicador e tamanho da base (nº de gestantes que entram na conta). */
export function valorDoIndicador(
  bloco: LinhaCuidadoBloco,
  indicador: IndicadorMeta,
): { valor: number | null; base: number } {
  const n = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
  switch (indicador) {
    case "diag_antes_28s_pct":
      return { valor: n(bloco.tempos.diag_antes_28s_pct), base: bloco.tempos.diag_com_ig ?? 0 };
    case "perda_seguimento_pct":
      return { valor: n(bloco.funil.perda_seguimento_pct), base: bloco.funil.diagnosticadas ?? 0 };
    case "perfil_completo_pct":
      return { valor: n(bloco.adesao.perfil_completo_pct), base: bloco.adesao.diagnosticadas ?? 0 };
    case "ultimo_na_meta_pct":
      return { valor: n(bloco.adesao.ultimo_na_meta_pct), base: bloco.adesao.com_perfil ?? 0 };
    case "gj_gtt_mediana_dias":
      return { valor: n(bloco.tempos.gj_gtt_mediana_dias), base: bloco.tempos.gj_gtt_n ?? 0 };
  }
}

/**
 * sem_meta     → a rede não definiu meta (sem selo)
 * sem_dados    → nenhuma gestante na base do período
 * poucos_dados → base < BASE_MINIMA_META
 * atingida     → mínimo: valor ≥ meta; máximo: valor ≤ meta
 * nao_atingida → o contrário (texto: "abaixo da meta" / "acima do limite")
 */
export type SituacaoMeta = "sem_meta" | "sem_dados" | "poucos_dados" | "atingida" | "nao_atingida";

export function avaliarMeta(
  valor: number | null | undefined,
  base: number | null | undefined,
  meta: number | null | undefined,
  sentido: SentidoMeta,
  baseMinima = BASE_MINIMA_META,
): SituacaoMeta {
  if (meta == null || Number.isNaN(Number(meta))) return "sem_meta";
  const b = Number(base ?? 0);
  if (valor == null || Number.isNaN(Number(valor)) || b <= 0) return "sem_dados";
  if (b < baseMinima) return "poucos_dados";
  const v = Number(valor);
  const m = Number(meta);
  const ok = sentido === "minimo" ? v >= m : v <= m;
  return ok ? "atingida" : "nao_atingida";
}

/** Atalho: avalia um indicador do bloco da linha de cuidado contra as metas da rede. */
export function avaliarIndicador(
  bloco: LinhaCuidadoBloco,
  indicador: IndicadorMeta,
  metas: MetasRede | null | undefined,
): { situacao: SituacaoMeta; valor: number | null; base: number; meta: number | null } {
  const { valor, base } = valorDoIndicador(bloco, indicador);
  const meta = metas?.[indicador] ?? null;
  return { situacao: avaliarMeta(valor, base, meta, CFG_META[indicador].sentido), valor, base, meta };
}

/**
 * Texto do campo → número válido para a meta, ou erro.
 * Aceita vírgula decimal. Vazio = "sem meta" (null, sem erro).
 */
export function lerValorMeta(
  texto: string,
  indicador: IndicadorMeta,
): { valor: number | null; erro: "invalido" | "faixa" | null } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return { valor: null, erro: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { valor: null, erro: "invalido" };
  const v = Math.round(Number(t) * 10) / 10;
  const { min, max } = CFG_META[indicador];
  if (v < min || v > max) return { valor: null, erro: "faixa" };
  return { valor: v, erro: null };
}

/**
 * Metas que valem para um conjunto de unidades: só quando TODAS são da mesma
 * rede (metas são por rede). Unidades de redes diferentes → null (a tela manda
 * para a tabela "Metas por unidade").
 */
export function metasDaSelecao(
  unidadeIds: string[],
  redeDaUnidade: Record<string, string | null | undefined>,
  metasPorRede: Record<string, MetasRede>,
): { redeId: string | null; metas: MetasRede | null; variasRedes: boolean } {
  const redes = new Set(unidadeIds.map((u) => redeDaUnidade[u]).filter((r): r is string => !!r));
  if (redes.size !== 1) return { redeId: null, metas: null, variasRedes: redes.size > 1 };
  const [redeId] = [...redes];
  return { redeId, metas: metasPorRede[redeId] ?? {}, variasRedes: false };
}

/** Resumo de uma unidade/rede: quantas metas definidas foram atingidas (ignora poucos dados). */
export function resumoMetas(
  bloco: LinhaCuidadoBloco,
  metas: MetasRede | null | undefined,
): { definidas: number; avaliadas: number; atingidas: number } {
  let definidas = 0;
  let avaliadas = 0;
  let atingidas = 0;
  for (const { chave } of INDICADORES_META) {
    const s = avaliarIndicador(bloco, chave, metas).situacao;
    if (s === "sem_meta") continue;
    definidas++;
    if (s === "atingida" || s === "nao_atingida") avaliadas++;
    if (s === "atingida") atingidas++;
  }
  return { definidas, avaliadas, atingidas };
}

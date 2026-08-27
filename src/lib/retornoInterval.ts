/**
 * 38B-C (#17) — Regra ÚNICA de intervalo de retorno (em dias) usada para calcular
 * `data_proximo_retorno` e as labels "× N dias". Antes estava hardcoded e
 * duplicada (binária ≤30/>30) em FichaACForm, FichaBDForm, FichaEForm e
 * FichaPacientePage. Corte de 30 sem confirmado pelas especialistas.
 *
 * Regra, na ordem em que é avaliada:
 *  - Ficha E (perfil de 6 pontos sem insulina — caminho "Regra 4 → memória
 *    confirma"): intervalo próprio = 7 dias.
 *  - REFORÇAR MEV (Regra 2): 7 dias. Perfil INADEQUADO com falha de adesão é a
 *    situação mais urgente da ficha — o fluxograma das especialistas pede
 *    reavaliação em 7 a 10 dias, e a equipe fixou 7 como prazo MÁXIMO. Por ser
 *    teto, vence inclusive o 10 do primeiro perfil.
 *  - 1º perfil glicêmico pós-diagnóstico (1ª Ficha A/C = Retorno 2): 10 dias.
 *  - Demais perfis: > 30 sem = 7 dias; ≤ 30 sem = 15 dias.
 *
 * O corte de 30 semanas e o prazo do reforço de MEV foram confirmados pelas
 * especialistas (fluxograma de agosto/2026).
 */
export function calcularIntervaloRetornoDias(params: {
  /** Ficha E (6 pontos sem insulina) tem intervalo próprio de 7 dias. */
  ehFichaE: boolean;
  /** 1º perfil glicêmico após o diagnóstico (1ª Ficha A/C). */
  ehPrimeiroPerfil: boolean;
  /** IG em semanas na data da consulta (fonte: calcular_ig / IG da ficha). */
  igSemanas: number | null;
  /** Regra do motor da Ficha A/C. `regra_2` (reforçar MEV) tem teto próprio. */
  regraAplicada?: string | null;
}): number {
  if (params.ehFichaE) return 7;
  if (params.regraAplicada === 'regra_2') return 7;
  if (params.ehPrimeiroPerfil) return 10;
  return (params.igSemanas ?? 0) > 30 ? 7 : 15;
}

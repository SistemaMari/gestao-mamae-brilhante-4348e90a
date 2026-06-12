/**
 * 38B-C (#17) — Regra ÚNICA de intervalo de retorno (em dias) usada para calcular
 * `data_proximo_retorno` e as labels "× N dias". Antes estava hardcoded e
 * duplicada (binária ≤30/>30) em FichaACForm, FichaBDForm, FichaEForm e
 * FichaPacientePage. Corte de 30 sem confirmado pelas especialistas.
 *
 * Regra (ternária):
 *  - Ficha E (perfil de 6 pontos sem insulina — caminho "Regra 4 → memória
 *    confirma"): intervalo próprio = 7 dias.
 *  - 1º perfil glicêmico pós-diagnóstico (1ª Ficha A/C = Retorno 2): 10 dias.
 *  - Demais perfis: > 30 sem = 7 dias; ≤ 30 sem = 15 dias.
 */
export function calcularIntervaloRetornoDias(params: {
  /** Ficha E (6 pontos sem insulina) tem intervalo próprio de 7 dias. */
  ehFichaE: boolean;
  /** 1º perfil glicêmico após o diagnóstico (1ª Ficha A/C). */
  ehPrimeiroPerfil: boolean;
  /** IG em semanas na data da consulta (fonte: calcular_ig / IG da ficha). */
  igSemanas: number | null;
}): number {
  if (params.ehFichaE) return 7;
  if (params.ehPrimeiroPerfil) return 10;
  return (params.igSemanas ?? 0) > 30 ? 7 : 15;
}

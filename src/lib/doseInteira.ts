/**
 * Sugestão de dose de insulina em número inteiro.
 *
 * A dose calculada (0,5 UI/kg/dia, ⅔ manhã + ⅓ noite) costuma sair quebrada
 * (ex.: 27,3 UI + 13,7 UI), o que é difícil de aplicar na seringa/caneta.
 * Decisão clínica (out/2026): o sistema CONTINUA mostrando o valor exato e
 * acrescenta uma SUGESTÃO de ajuste para o inteiro mais próximo — meio (x,5)
 * arredonda PARA CIMA. Cada dose (manhã/noite) é arredondada separadamente,
 * porque é o que a gestante aplica.
 */

/** Inteiro mais próximo; x,5 sobe (27,3 → 27 · 13,7 → 14 · 13,5 → 14). */
export function arredondarDoseInteira(n: number): number {
  return Math.round(n);
}

/** true quando a dose tem fração e, portanto, merece a sugestão de ajuste. */
export function doseQuebrada(n: number | null | undefined): n is number {
  return n != null && !Number.isNaN(n) && !Number.isInteger(n);
}

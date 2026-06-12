/**
 * Helper único de veredito de controle glicêmico.
 * Consumido pelo card de resultado (FichaBDResultCard) e pelo pop-up de
 * encerramento (FichaBDForm) para garantir que NUNCA divirjam.
 *
 * Regra única: SEMPRE exibir "% DENTRO da meta" — nunca "fora".
 */

export function formatPctDentroPtBr(pct: number): string {
  const n = Number.isFinite(pct) ? pct : 0;
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export interface VereditoControle {
  adequado: boolean;
  titulo: string;
}

export function vereditoControle(pct: number): VereditoControle {
  const adequado = pct >= 70;
  const pctFmt = formatPctDentroPtBr(pct);
  return {
    adequado,
    titulo: adequado
      ? `Controle adequado — ${pctFmt} dentro da meta`
      : `Controle inadequado — apenas ${pctFmt} dentro da meta`,
  };
}

// Contas da promoção de lançamento exibidas nas telas de planos e de pagamento.
// O desconto é sempre 50% (decisão comercial). A cobrança no Asaas usa a mesma
// conta em supabase/functions/_shared/planoPorValor.ts — manter as duas iguais.

export const DESCONTO_LANCAMENTO_PCT = 50;

const PARCELAS_POR_ANO = 12;

/** Preço mensal com o desconto de lançamento, arredondado ao centavo. */
export function precoLancamento(precoMensal: number): number {
  return Math.round(precoMensal * (100 - DESCONTO_LANCAMENTO_PCT)) / 100;
}

/** Total das 12 parcelas do ano. */
export function anuidade(precoMensal: number): number {
  return Math.round(precoMensal * PARCELAS_POR_ANO * 100) / 100;
}

/** Quanto custa cada gestante por mês, usando o limite do plano. */
export function precoPorGestante(precoMensal: number, pacientesMax: number | null): number | null {
  if (!pacientesMax || pacientesMax <= 0) return null;
  return Math.round((precoMensal / pacientesMax) * 100) / 100;
}

/** "R$ 79" quando o valor é inteiro, "R$ 39,50" quando tem centavos. */
export function formatarBRL(valor: number, idioma: string, sempreCentavos = false): string {
  const inteiro = Number.isInteger(valor);
  return valor.toLocaleString(idioma, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: inteiro && !sempreCentavos ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

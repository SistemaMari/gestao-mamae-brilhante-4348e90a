// Identifica o plano pelo valor da cobrança que chega no webhook do Asaas.
// Links de pagamento avulsos (página de vendas, institucionais) não carregam o
// slug do plano, então o valor é a única pista disponível.

// Preço cheio mensal de cada plano, em centavos.
const PRECO_CHEIO_CENTAVOS: ReadonlyArray<readonly [number, string]> = [
  [7900, "inicial"],
  [13900, "intermediaria"],
  [29900, "profissional"],
  [299700, "institucional-1000"],
  [499700, "institucional-5000"],
];

// Planos que podem ser vendidos com o desconto de lançamento (sempre 50%).
// O valor com desconto é reconhecido SEMPRE, mesmo com a promoção desligada:
// quem comprou na promoção paga o valor reduzido nas 12 parcelas do 1º ano.
const COM_DESCONTO_LANCAMENTO = new Set(["inicial", "intermediaria", "profissional"]);

// Mesma folga da regra antiga (Math.round): até 49 centavos para cima ou para baixo.
const FOLGA_CENTAVOS = 49;

const bate = (centavos: number, alvo: number) => Math.abs(centavos - alvo) <= FOLGA_CENTAVOS;

export function planoSlugPorValor(valor: number): string | null {
  const centavos = Math.round(Number(valor) * 100);
  if (!Number.isFinite(centavos) || centavos <= 0) return null;
  for (const [cheio, slug] of PRECO_CHEIO_CENTAVOS) {
    if (bate(centavos, cheio)) return slug;
    if (COM_DESCONTO_LANCAMENTO.has(slug) && bate(centavos, cheio / 2)) return slug;
  }
  return null;
}

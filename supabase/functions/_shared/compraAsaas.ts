// Regras de identificação de compra usadas pelo webhook do Asaas.
// Funções puras, testadas em src/lib/compraAsaas.test.ts.

/** Código do link de pagamento: o último trecho do endereço (asaas.com/.../c/<código>). */
export function codigoDoLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const semQuery = String(url).trim().split(/[?#]/)[0].replace(/\/+$/, "");
  const ultimo = semQuery.split("/").pop() ?? "";
  return ultimo ? ultimo.toLowerCase() : null;
}

export interface PlanoComLinks {
  slug: string;
  link_pagamento_asaas: string | null;
  links_pagamento_anteriores?: string[] | null;
}

/**
 * Plano dono do link: compara com o link atual e com os anteriores de cada
 * plano (quem pagou com Pix/boleto de um link já trocado continua reconhecida).
 */
export function slugPorCodigoDeLink(
  codigo: string | null,
  planos: ReadonlyArray<PlanoComLinks>,
): string | null {
  if (!codigo) return null;
  for (const p of planos) {
    const links = [p.link_pagamento_asaas, ...(p.links_pagamento_anteriores ?? [])];
    if (links.some((l) => codigoDoLink(l) === codigo)) return p.slug;
  }
  return null;
}

export interface PagamentoAsaas {
  id?: string | null;
  subscription?: string | null;
  installment?: string | null;
}

/**
 * - Assinatura (mensalidade criada pelo app): cada cobrança vale 1 mês.
 * - Sem assinatura (link de pagamento, à vista ou parcelado): compra ANUAL.
 * `compraId` identifica a compra: todas as parcelas de um parcelamento
 * compartilham o mesmo `installment`, então não contam como compras novas.
 */
export function identificarCompra(p: PagamentoAsaas): { compraId: string | null; anual: boolean } {
  const anual = !p.subscription;
  const compraId = p.subscription ?? p.installment ?? p.id ?? null;
  return { compraId, anual };
}

export interface PlanoComPrecos {
  slug: string;
  preco_mensal: number | null;
  parcela_12x_cartao?: number | null;
  parcela_12x_cartao_promo?: number | null;
}

const centavos = (v: number | null | undefined) => Math.round(Number(v ?? 0) * 100);

/**
 * Plano pelo valor de uma cobrança da compra anual, para quando o pagamento
 * chega sem o link (ou o link não está cadastrado): a parcela em 12× (cheia ou
 * da promoção) ou o ano à vista (cheio ou com 50% de lançamento).
 * Comparação exata ao centavo — valores de planos diferentes nunca se cruzam.
 */
export function slugPorValorDaCompraAnual(
  valor: number,
  planos: ReadonlyArray<PlanoComPrecos>,
): string | null {
  const alvo = centavos(valor);
  if (alvo <= 0) return null;
  for (const p of planos) {
    const anoCheio = centavos(p.preco_mensal) * 12;
    const candidatos = [
      centavos(p.parcela_12x_cartao),
      centavos(p.parcela_12x_cartao_promo),
      anoCheio,
      anoCheio / 2,
    ].filter((c) => c > 0);
    if (candidatos.includes(alvo)) return p.slug;
  }
  return null;
}

/**
 * Endereço da API do Asaas. A própria chave diz o ambiente ($aact_prod_… é
 * produção, $aact_hmlg_… é sandbox) e vence o ASAAS_ENV: chave de produção
 * chamando o sandbox (ou o contrário) dá 401 em toda compra.
 */
export function asaasBaseUrl(apiKey: string | null | undefined, asaasEnv: string | null | undefined): string {
  const PROD = "https://api.asaas.com/v3";
  const SANDBOX = "https://api-sandbox.asaas.com/v3";
  const chave = String(apiKey ?? "");
  if (chave.includes("_prod_")) return PROD;
  if (chave.includes("_hmlg_")) return SANDBOX;
  return String(asaasEnv ?? "sandbox").toLowerCase() === "production" ? PROD : SANDBOX;
}

export const MESES_COMPRA_ANUAL = 12;

export function somarMeses(data: Date, meses: number): Date {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

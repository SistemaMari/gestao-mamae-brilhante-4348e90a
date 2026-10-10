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

export const MESES_COMPRA_ANUAL = 12;

export function somarMeses(data: Date, meses: number): Date {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

import { describe, it, expect } from 'vitest';
import {
  codigoDoLink, slugPorCodigoDeLink, identificarCompra, somarMeses,
  slugPorValorDaCompraAnual, asaasBaseUrl,
} from '../../supabase/functions/_shared/compraAsaas.ts';

const planos = [
  { slug: 'inicial', link_pagamento_asaas: 'https://www.asaas.com/000/c/nrfjsycnquvauzim', links_pagamento_anteriores: ['https://www.asaas.com/c/antigo123'] },
  { slug: 'profissional', link_pagamento_asaas: 'https://www.asaas.com/000/c/09aiyqhk3vvvifu6', links_pagamento_anteriores: [] },
  { slug: 'sem-link', link_pagamento_asaas: null },
];

describe('codigoDoLink', () => {
  it('pega o último trecho do endereço, em qualquer formato do Asaas', () => {
    expect(codigoDoLink('https://www.asaas.com/000/c/nrfjsycnquvauzim')).toBe('nrfjsycnquvauzim');
    expect(codigoDoLink('https://www.asaas.com/c/291089675759')).toBe('291089675759');
    expect(codigoDoLink('https://www.asaas.com/c/ABC123/?utm=x#y')).toBe('abc123');
  });
  it('vazio vira null', () => {
    expect(codigoDoLink(null)).toBeNull();
    expect(codigoDoLink('')).toBeNull();
  });
});

describe('slugPorCodigoDeLink', () => {
  it('reconhece o link atual do plano', () => {
    expect(slugPorCodigoDeLink('nrfjsycnquvauzim', planos)).toBe('inicial');
    expect(slugPorCodigoDeLink('09aiyqhk3vvvifu6', planos)).toBe('profissional');
  });
  it('reconhece um link antigo (trocado depois da compra)', () => {
    expect(slugPorCodigoDeLink('antigo123', planos)).toBe('inicial');
  });
  it('link desconhecido ou ausente não vira plano', () => {
    expect(slugPorCodigoDeLink('naoexiste', planos)).toBeNull();
    expect(slugPorCodigoDeLink(null, planos)).toBeNull();
  });
});

describe('identificarCompra', () => {
  it('mensalidade do app: não é anual, a compra é a assinatura', () => {
    expect(identificarCompra({ id: 'pay_1', subscription: 'sub_9' })).toEqual({ compraId: 'sub_9', anual: false });
  });
  it('link parcelado: anual, todas as parcelas são a mesma compra', () => {
    const p1 = identificarCompra({ id: 'pay_1', installment: 'inst_7' });
    const p2 = identificarCompra({ id: 'pay_2', installment: 'inst_7' });
    expect(p1).toEqual({ compraId: 'inst_7', anual: true });
    expect(p2.compraId).toBe(p1.compraId);
  });
  it('link à vista (Pix): anual, a compra é o próprio pagamento', () => {
    expect(identificarCompra({ id: 'pay_3' })).toEqual({ compraId: 'pay_3', anual: true });
  });
});

describe('somarMeses', () => {
  it('soma 12 meses para a validade da compra anual', () => {
    const d = somarMeses(new Date('2026-10-13T12:00:00Z'), 12);
    expect(d.toISOString().slice(0, 10)).toBe('2027-10-13');
  });
});

describe('slugPorValorDaCompraAnual', () => {
  const planosPreco = [
    { slug: 'inicial', preco_mensal: 79, parcela_12x_cartao: 82.36, parcela_12x_cartao_promo: 41.18 },
    { slug: 'intermediaria', preco_mensal: 139, parcela_12x_cartao: 144.84, parcela_12x_cartao_promo: 72.42 },
    { slug: 'profissional', preco_mensal: 299, parcela_12x_cartao: 311.5, parcela_12x_cartao_promo: 155.75 },
  ];
  it('parcela em 12× da promoção (a compra-teste: 12× R$ 41,18)', () => {
    expect(slugPorValorDaCompraAnual(41.18, planosPreco)).toBe('inicial');
    expect(slugPorValorDaCompraAnual(72.42, planosPreco)).toBe('intermediaria');
    expect(slugPorValorDaCompraAnual(155.75, planosPreco)).toBe('profissional');
  });
  it('parcela em 12× do preço cheio', () => {
    expect(slugPorValorDaCompraAnual(311.5, planosPreco)).toBe('profissional');
  });
  it('ano à vista, com 50% de lançamento ou cheio', () => {
    expect(slugPorValorDaCompraAnual(474, planosPreco)).toBe('inicial');
    expect(slugPorValorDaCompraAnual(834, planosPreco)).toBe('intermediaria');
    expect(slugPorValorDaCompraAnual(1794, planosPreco)).toBe('profissional');
    expect(slugPorValorDaCompraAnual(948, planosPreco)).toBe('inicial');
  });
  it('valor de outra cobrança não vira plano', () => {
    expect(slugPorValorDaCompraAnual(41.17, planosPreco)).toBeNull();
    expect(slugPorValorDaCompraAnual(250, planosPreco)).toBeNull();
    expect(slugPorValorDaCompraAnual(0, planosPreco)).toBeNull();
  });
  it('colunas de parcela ausentes (migration não rodada) não quebram', () => {
    expect(slugPorValorDaCompraAnual(474, [{ slug: 'inicial', preco_mensal: 79 }])).toBe('inicial');
  });
});

describe('asaasBaseUrl', () => {
  it('a chave de produção vence o ASAAS_ENV', () => {
    expect(asaasBaseUrl('$aact_prod_000abc', undefined)).toBe('https://api.asaas.com/v3');
    expect(asaasBaseUrl('$aact_prod_000abc', 'sandbox')).toBe('https://api.asaas.com/v3');
  });
  it('a chave de sandbox vence o ASAAS_ENV', () => {
    expect(asaasBaseUrl('$aact_hmlg_000abc', 'production')).toBe('https://api-sandbox.asaas.com/v3');
  });
  it('chave sem prefixo de ambiente: segue o ASAAS_ENV (padrão sandbox)', () => {
    expect(asaasBaseUrl('$aact_YTU5YTE0', 'production')).toBe('https://api.asaas.com/v3');
    expect(asaasBaseUrl('$aact_YTU5YTE0', undefined)).toBe('https://api-sandbox.asaas.com/v3');
  });
});

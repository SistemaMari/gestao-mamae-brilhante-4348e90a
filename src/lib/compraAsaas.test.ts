import { describe, it, expect } from 'vitest';
import {
  codigoDoLink, slugPorCodigoDeLink, identificarCompra, somarMeses,
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

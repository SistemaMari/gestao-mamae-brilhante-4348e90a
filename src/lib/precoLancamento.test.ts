import { describe, it, expect } from 'vitest';
import { precoLancamento, anuidade, precoPorGestante, formatarBRL } from './precoLancamento';
import { planoSlugPorValor, valorComDescontoLancamento } from '../../supabase/functions/_shared/planoPorValor.ts';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('precoLancamento', () => {
  it('reproduz os valores da página de vendas', () => {
    expect(precoLancamento(79)).toBe(39.5);
    expect(precoLancamento(139)).toBe(69.5);
    expect(precoLancamento(299)).toBe(149.5);
  });

  it('anuidade do primeiro ano com desconto', () => {
    expect(anuidade(precoLancamento(79))).toBe(474);
    expect(anuidade(precoLancamento(139))).toBe(834);
    expect(anuidade(precoLancamento(299))).toBe(1794);
  });

  it('preço por gestante por mês (10 / 50 / 150)', () => {
    expect(precoPorGestante(39.5, 10)).toBe(3.95);
    expect(precoPorGestante(69.5, 50)).toBe(1.39);
    expect(precoPorGestante(149.5, 150)).toBe(1);
    expect(precoPorGestante(79, null)).toBeNull();
  });

  it('o valor cobrado com desconto é reconhecido pelo webhook do Asaas', () => {
    expect(planoSlugPorValor(precoLancamento(79))).toBe('inicial');
    expect(planoSlugPorValor(precoLancamento(139))).toBe('intermediaria');
    expect(planoSlugPorValor(precoLancamento(299))).toBe('profissional');
  });

  it('total no cartão (12× com juros) bate com o checkout do Asaas', () => {
    expect(anuidade(41.18)).toBe(494.16);
    expect(anuidade(72.42)).toBe(869.04);
    expect(anuidade(155.75)).toBe(1869);
  });

  it('a tela e a cobrança do Asaas calculam o mesmo valor', () => {
    for (const p of [79, 139, 299, 99.9, 1]) {
      expect(valorComDescontoLancamento(p)).toBe(precoLancamento(p));
    }
  });

  it('formata sem centavos quando inteiro e com centavos quando não', () => {
    expect(nbsp(formatarBRL(79, 'pt-BR'))).toBe('R$ 79');
    expect(nbsp(formatarBRL(39.5, 'pt-BR'))).toBe('R$ 39,50');
    expect(nbsp(formatarBRL(1, 'pt-BR', true))).toBe('R$ 1,00');
  });
});

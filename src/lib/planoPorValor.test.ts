import { describe, it, expect } from 'vitest';
import { planoSlugPorValor } from '../../supabase/functions/_shared/planoPorValor.ts';

describe('planoSlugPorValor (webhook Asaas)', () => {
  it('reconhece o preço cheio dos 3 planos de consultório', () => {
    expect(planoSlugPorValor(79)).toBe('inicial');
    expect(planoSlugPorValor(139)).toBe('intermediaria');
    expect(planoSlugPorValor(299)).toBe('profissional');
  });

  it('reconhece o preço de lançamento (50%) dos 3 planos', () => {
    expect(planoSlugPorValor(39.5)).toBe('inicial');
    expect(planoSlugPorValor(69.5)).toBe('intermediaria');
    expect(planoSlugPorValor(149.5)).toBe('profissional');
  });

  it('aceita o valor como texto ou com ruído de ponto flutuante', () => {
    expect(planoSlugPorValor(Number('39.50'))).toBe('inicial');
    expect(planoSlugPorValor(69.49999999)).toBe('intermediaria');
  });

  it('reconhece os institucionais só pelo preço cheio', () => {
    expect(planoSlugPorValor(2997)).toBe('institucional-1000');
    expect(planoSlugPorValor(4997)).toBe('institucional-5000');
    expect(planoSlugPorValor(1498.5)).toBeNull();
    expect(planoSlugPorValor(2498.5)).toBeNull();
  });

  it('mantém a folga de centavos da regra antiga', () => {
    expect(planoSlugPorValor(79.4)).toBe('inicial');
    expect(planoSlugPorValor(78.51)).toBe('inicial');
    expect(planoSlugPorValor(39.99)).toBe('inicial');
  });

  it('não confunde o valor promocional com o cheio nem aceita valores soltos', () => {
    expect(planoSlugPorValor(40)).toBeNull();
    expect(planoSlugPorValor(150)).toBeNull();
    expect(planoSlugPorValor(100)).toBeNull();
    expect(planoSlugPorValor(0)).toBeNull();
    expect(planoSlugPorValor(NaN)).toBeNull();
  });
});

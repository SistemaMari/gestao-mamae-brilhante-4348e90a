import { describe, it, expect } from 'vitest';
import { pontosDoProximoPerfil } from './pactuacaoProxPerfil';

describe('pontosDoProximoPerfil', () => {
  it('null se algum input for vazio', () => {
    expect(pontosDoProximoPerfil(null, '1')).toBeNull();
    expect(pontosDoProximoPerfil('retorno_1', null)).toBeNull();
    expect(pontosDoProximoPerfil('', '')).toBeNull();
  });

  describe('Retorno 1 (glicemia de jejum)', () => {
    it('negativo → sem próximo perfil (paciente ainda não tem DMG)', () => {
      expect(pontosDoProximoPerfil('retorno_1', 'negativo')).toBeNull();
    });
    it('confirma DMG (1 / 6 / 8) → 4 pontos', () => {
      expect(pontosDoProximoPerfil('retorno_1', '1')).toBe(4);
      expect(pontosDoProximoPerfil('retorno_1', '6')).toBe(4);
      expect(pontosDoProximoPerfil('retorno_1', '8')).toBe(4);
    });
  });

  describe('GTT', () => {
    it('negativo → sem próximo perfil', () => {
      expect(pontosDoProximoPerfil('gtt', 'negativo')).toBeNull();
    });
    it('positivo (6 / 6B / 8) → 4 pontos', () => {
      expect(pontosDoProximoPerfil('gtt', '6')).toBe(4);
      expect(pontosDoProximoPerfil('gtt', '6B')).toBe(4);
      expect(pontosDoProximoPerfil('gtt', '8')).toBe(4);
    });
  });

  describe('Ficha A/C', () => {
    it('r1_manter → 4 pontos', () => {
      expect(pontosDoProximoPerfil('ficha_a', 'r1_manter')).toBe(4);
      expect(pontosDoProximoPerfil('ficha_c', 'r1_manter')).toBe(4);
    });
    it('r2_reforcar (MEV) → 4 pontos', () => {
      expect(pontosDoProximoPerfil('ficha_a', 'r2_reforcar')).toBe(4);
    });
    it('r4a_fichae (memória confirma) → 6 pontos (vai virar Ficha E)', () => {
      expect(pontosDoProximoPerfil('ficha_a', 'r4a_fichae')).toBe(6);
    });
    it('r4_reforcar (memória não confirma, aceita) → 4 pontos', () => {
      expect(pontosDoProximoPerfil('ficha_a', 'r4_reforcar')).toBe(4);
    });
    it('cenários de insulina/encerramento → null', () => {
      expect(pontosDoProximoPerfil('ficha_a', 'r2_insulina')).toBeNull();
      expect(pontosDoProximoPerfil('ficha_a', 'r3_insulina')).toBeNull();
      expect(pontosDoProximoPerfil('ficha_a', 'r4b_insulina')).toBeNull();
      expect(pontosDoProximoPerfil('ficha_a', 'regra_fetal')).toBeNull();
    });
  });

  describe('Ficha E', () => {
    it('e_manter → 6 pontos', () => {
      expect(pontosDoProximoPerfil('ficha_e', 'e_manter')).toBe(6);
    });
    it('e_insulina → null (encerra)', () => {
      expect(pontosDoProximoPerfil('ficha_e', 'e_insulina')).toBeNull();
    });
  });

  describe('Ficha B/D e Caso Novo → sempre null', () => {
    it('ficha_b/d são insulina terminal', () => {
      expect(pontosDoProximoPerfil('ficha_b', '4')).toBeNull();
      expect(pontosDoProximoPerfil('ficha_d', '4')).toBeNull();
    });
    it('caso_novo/consulta_1 é pedido de exame, não perfil', () => {
      expect(pontosDoProximoPerfil('consulta_1', 'pedido_exame')).toBeNull();
    });
  });

  it('encerramento manual → null', () => {
    expect(pontosDoProximoPerfil('ficha_a', 'parto')).toBeNull();
    expect(pontosDoProximoPerfil('ficha_a', 'aborto')).toBeNull();
    expect(pontosDoProximoPerfil('ficha_a', 'nao_retornou')).toBeNull();
  });
});

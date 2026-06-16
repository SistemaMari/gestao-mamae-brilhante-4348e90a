import { describe, it, expect } from 'vitest';
import {
  extrairVariaveis,
  variaveisDesconhecidas,
  labelBloco,
  labelCenario,
  ajudaCenario,
  cenarioTecnicoOculto,
} from './laudoTextosAdmin';

describe('laudoTextosAdmin', () => {
  it('extrai as variáveis [entre colchetes]', () => {
    expect(extrairVariaveis('A paciente [nome da paciente] com [IG].')).toEqual([
      'nome da paciente',
      'IG',
    ]);
    expect(extrairVariaveis('sem variáveis aqui')).toEqual([]);
  });

  it('acusa variável desconhecida (provável erro de digitação)', () => {
    expect(
      variaveisDesconhecidas('dose de [dose total de insulina] e [glicemia]'),
    ).toEqual(['glicemia']); // a válida é "glicemia de jejum"
  });

  it('não acusa variáveis válidas', () => {
    expect(variaveisDesconhecidas('[nome da paciente] — [% na meta] — [dose manhã]')).toEqual([]);
  });

  it('rótulos amigáveis com fallback no código cru', () => {
    expect(labelBloco('justificativa')).toBe('Justificativa Científica');
    expect(labelBloco('bloco_xyz')).toBe('bloco_xyz');
    expect(labelCenario('retorno_1', '1')).toContain('Retorno 1');
  });

  it('ajuda do cenário: Ficha C↔A e Ficha D↔B compartilham; desconhecido → null', () => {
    expect(ajudaCenario('ficha_a', 'r3_insulina')).toContain('insulina');
    expect(ajudaCenario('ficha_c', 'r3_insulina')).toBe(ajudaCenario('ficha_a', 'r3_insulina'));
    expect(ajudaCenario('ficha_d', '4')).toBe(ajudaCenario('ficha_b', '4'));
    expect(ajudaCenario('consulta_1', 'xyz')).toBeNull();
  });

  it('oculta cenários técnicos/legados, mantém os reais', () => {
    expect(cenarioTecnicoOculto('retorno_1', '6')).toBe(true);
    expect(cenarioTecnicoOculto('ficha_a', '2')).toBe(true);
    expect(cenarioTecnicoOculto('ficha_c', '3')).toBe(true);
    expect(cenarioTecnicoOculto('retorno_1', '1')).toBe(false);
    expect(cenarioTecnicoOculto('gtt', '6')).toBe(false);
    expect(cenarioTecnicoOculto('ficha_a', 'r3_insulina')).toBe(false);
  });
});

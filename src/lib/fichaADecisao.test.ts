import { describe, it, expect } from 'vitest';
import { aplicarRegrasFichaA, type ChecklistInput } from './fichaADecisao';

// Paciente "base": adesão completa + fetal sem alterações. Cada teste muda só o
// necessário para cair na regra desejada.
const base: ChecklistInput = {
  checklist_dieta: true,
  checklist_exercicio: true,
  checklist_ganho_peso: true,
  checklist_pfe_us: 'sim',
  checklist_ca: 'sim',
  checklist_la: 'sim',
  memoria_glicosimetro: null,
  pactuacao_adesao: null,
};

describe('aplicarRegrasFichaA — roteamento da próxima ficha', () => {
  it('Regra 2 (controle <70% + adesão falhou) + Aceita → MANTÉM 4 pontos (ficha_a), loop até insulina', () => {
    // Reforçar MEV com nova pactuação reavalia com a MESMA grade de 4 pontos (loop).
    // 6 pontos sem insulina é exclusivo da Regra 4 "confirma".
    const r = aplicarRegrasFichaA(
      { ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' },
      50, 70, 25,
    );
    expect(r.regra_aplicada).toBe('regra_2');
    expect(r.conduta_gerada).toBe('reforcar_mev');
    expect(r.proxima_ficha_recomendada).toBe('ficha_a');
  });

  it('Regra 2 + Recusa → insulina (6 pontos com insulina, ≤30sem = ficha_b)', () => {
    const r = aplicarRegrasFichaA(
      { ...base, checklist_dieta: false, pactuacao_adesao: 'recusa' },
      50, 70, 25,
    );
    expect(r.regra_aplicada).toBe('regra_2');
    expect(r.proxima_ficha_recomendada).toBe('ficha_b');
  });

  it('Regra 3 (controle <70% + adesão ok) → insulina (ficha_b ≤30sem)', () => {
    const r = aplicarRegrasFichaA({ ...base }, 50, 70, 25);
    expect(r.regra_aplicada).toBe('regra_3');
    expect(r.proxima_ficha_recomendada).toBe('ficha_b');
  });

  it('Regra 4 (≥70% + adesão falhou) + memória confirma → ficha_e', () => {
    const r = aplicarRegrasFichaA(
      { ...base, checklist_dieta: false, memoria_glicosimetro: 'confirma' },
      80, 70, 25,
    );
    expect(r.regra_aplicada).toBe('regra_4');
    expect(r.proxima_ficha_recomendada).toBe('ficha_e');
  });

  it('Regra 4 + "não confirma" + Aceita → MANTÉM 4 pontos (ficha_a), NÃO amplia para ficha_e', () => {
    // Memória não bate = dados não confiáveis. Mais aferições não aumentam a verdade;
    // o que muda o próximo teste é a pactuação. Por isso mantém 4 pontos (não 6).
    const r = aplicarRegrasFichaA(
      { ...base, checklist_dieta: false, memoria_glicosimetro: 'nao_confirma', pactuacao_adesao: 'aceita' },
      80, 70, 25,
    );
    expect(r.regra_aplicada).toBe('regra_4');
    expect(r.proxima_ficha_recomendada).toBe('ficha_a');
  });

  it('Regra 4 + "não confirma" + Recusa → insulina (ficha_b ≤30sem)', () => {
    const r = aplicarRegrasFichaA(
      { ...base, checklist_dieta: false, memoria_glicosimetro: 'nao_confirma', pactuacao_adesao: 'recusa' },
      80, 70, 25,
    );
    expect(r.proxima_ficha_recomendada).toBe('ficha_b');
  });

  it('Regra manter (≥70% + adesão ok + fetal ok) → 4 pontos (ficha_a ≤30sem)', () => {
    const r = aplicarRegrasFichaA({ ...base }, 80, 70, 25);
    expect(r.regra_aplicada).toBe('regra_manter');
    expect(r.proxima_ficha_recomendada).toBe('ficha_a');
  });

  it('roteamento >30 semanas: Regra 3 → ficha_d (6 pontos com insulina, >30sem)', () => {
    const r = aplicarRegrasFichaA({ ...base }, 50, 70, 32);
    expect(r.proxima_ficha_recomendada).toBe('ficha_d');
  });
});

import { describe, it, expect } from 'vitest';
import { aplicarRegrasFichaA, type ChecklistInput, type Regra, type Conduta, type ProximaFicha } from './fichaADecisao';

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

// ════════════════════════════════════════════════════════════════════════════
// 42T — Suíte de PARIDADE Ficha A (IG 25) ↔ Ficha C (IG 32)
// Prova que cada cenário de decisão produz resultado IDÊNTICO nos dois regimes,
// diferindo APENAS no roteamento por idade (ficha_a↔ficha_c, ficha_b↔ficha_d).
// A diferença de intervalo de retorno (15d vs 7d) é ortogonal ao motor
// (calcularIntervaloRetornoDias) e não é decidida por esta função.
// ════════════════════════════════════════════════════════════════════════════

const PESO = 70;

interface CenarioParidade {
  nome: string;
  input: ChecklistInput;
  pct: number;
  regra: Regra;
  conduta: Conduta;
  fichaA: ProximaFicha; // esperado em IG 25
  fichaC: ProximaFicha; // esperado em IG 32
  comInsulina: boolean;
}

const CENARIOS: CenarioParidade[] = [
  {
    nome: 'R1 manter (controle adequado)',
    input: { ...base },
    pct: 80,
    regra: 'regra_manter', conduta: 'manter_mev',
    fichaA: 'ficha_a', fichaC: 'ficha_c', comInsulina: false,
  },
  {
    nome: 'R2 + aceita (1ª pactuação de MEV)',
    input: { ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' },
    pct: 50,
    regra: 'regra_2', conduta: 'reforcar_mev',
    fichaA: 'ficha_a', fichaC: 'ficha_c', comInsulina: false,
  },
  {
    nome: 'R2 + recusa → insulina',
    input: { ...base, checklist_dieta: false, pactuacao_adesao: 'recusa' },
    pct: 50,
    regra: 'regra_2', conduta: 'reforcar_mev',
    fichaA: 'ficha_b', fichaC: 'ficha_d', comInsulina: true,
  },
  {
    nome: 'R3 (inadequado, boa adesão) → insulina',
    input: { ...base },
    pct: 50,
    regra: 'regra_3', conduta: 'insulina',
    fichaA: 'ficha_b', fichaC: 'ficha_d', comInsulina: true,
  },
  {
    nome: 'R4 + não-confirma + recusa → insulina',
    input: { ...base, checklist_dieta: false, memoria_glicosimetro: 'nao_confirma', pactuacao_adesao: 'recusa' },
    pct: 80,
    regra: 'regra_4', conduta: 'avaliar_memoria',
    fichaA: 'ficha_b', fichaC: 'ficha_d', comInsulina: true,
  },
  // ── buracos explicitamente asseverados (item 3.2 do 42T) ──
  {
    nome: 'R4 + não-confirma + aceita (mantém 4 pontos, sem insulina)',
    input: { ...base, checklist_dieta: false, memoria_glicosimetro: 'nao_confirma', pactuacao_adesao: 'aceita' },
    pct: 80,
    regra: 'regra_4', conduta: 'avaliar_memoria',
    fichaA: 'ficha_a', fichaC: 'ficha_c', comInsulina: false,
  },
  {
    nome: 'R4 + confirma (amplia p/ 6 pontos sem insulina — ficha_e nos dois)',
    input: { ...base, checklist_dieta: false, memoria_glicosimetro: 'confirma' },
    pct: 80,
    regra: 'regra_4', conduta: 'avaliar_memoria',
    fichaA: 'ficha_e', fichaC: 'ficha_e', comInsulina: false,
  },
];

describe('42T — Paridade Ficha A (IG 25) ↔ Ficha C (IG 32)', () => {
  for (const c of CENARIOS) {
    it(`${c.nome}: decisão idêntica; rota ${c.fichaA} (A) ↔ ${c.fichaC} (C)`, () => {
      const a = aplicarRegrasFichaA(c.input, c.pct, PESO, 25);
      const cc = aplicarRegrasFichaA(c.input, c.pct, PESO, 32);

      // Regra e conduta IDÊNTICAS entre A e C
      expect(a.regra_aplicada).toBe(c.regra);
      expect(cc.regra_aplicada).toBe(c.regra);
      expect(a.conduta_gerada).toBe(c.conduta);
      expect(cc.conduta_gerada).toBe(c.conduta);

      // Roteamento difere APENAS pela idade gestacional
      expect(a.proxima_ficha_recomendada).toBe(c.fichaA);
      expect(cc.proxima_ficha_recomendada).toBe(c.fichaC);

      // Dose IDÊNTICA (0,5 UI/kg/dia é invariante à IG)
      expect(cc.dose_total).toBe(a.dose_total);
      expect(cc.dose_manha).toBe(a.dose_manha);
      expect(cc.dose_noite).toBe(a.dose_noite);
      if (c.comInsulina) {
        expect(a.dose_total).toBeGreaterThan(0);
      } else {
        expect(a.dose_total).toBeNull();
      }

      // Sem pendências em nenhum dos regimes
      expect(a.pendencias).toEqual([]);
      expect(cc.pendencias).toEqual([]);
    });
  }
});

describe('42F — Teto de pactuação única (Modelo A: uma por gestação, sem reset)', () => {
  // 1ª pactuação (sem histórico, pactuacoesPrevias=0): permitida — reforçar MEV.
  it('1ª pactuação R2 + aceita (histórico=0) → r2_reforcar — idêntico em A e C', () => {
    const inA = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' }, 50, PESO, 25, 0);
    const inC = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' }, 50, PESO, 32, 0);
    expect(inA.conduta_gerada).toBe('reforcar_mev');
    expect(inC.conduta_gerada).toBe('reforcar_mev');
    expect(inA.proxima_ficha_recomendada).toBe('ficha_a');
    expect(inC.proxima_ficha_recomendada).toBe('ficha_c');
  });

  // Havendo pactuação aceita anterior (histórico>0), a próxima inadequação vai direto
  // para insulina — mesmo com a ficha atual marcando "aceita". Fim do loop infinito.
  it('2ª inadequação pós-pactuação (histórico=1) → insulina, idêntico em A (ficha_b) e C (ficha_d)', () => {
    const inA = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' }, 50, PESO, 25, 1);
    const inC = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'aceita' }, 50, PESO, 32, 1);
    expect(inA.regra_aplicada).toBe('regra_2');
    expect(inC.regra_aplicada).toBe('regra_2');
    expect(inA.conduta_gerada).toBe('insulina');
    expect(inC.conduta_gerada).toBe('insulina');
    expect(inA.proxima_ficha_recomendada).toBe('ficha_b');
    expect(inC.proxima_ficha_recomendada).toBe('ficha_d');
    // dose calculada (0,5 UI/kg), idêntica nos dois regimes
    expect(inA.dose_total).toBeGreaterThan(0);
    expect(inC.dose_total).toBe(inA.dose_total);
    // o teto decide sozinho — sem pendência de pactuação
    expect(inA.pendencias).toEqual([]);
    expect(inC.pendencias).toEqual([]);
  });

  // O teto vence a escolha da ficha: com histórico, mesmo sem marcar pactuação → insulina.
  it('Histórico>0 sem escolha de pactuação → insulina, sem pendência (A e C)', () => {
    const inA = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: null }, 50, PESO, 25, 2);
    const inC = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: null }, 50, PESO, 32, 2);
    expect(inA.proxima_ficha_recomendada).toBe('ficha_b');
    expect(inC.proxima_ficha_recomendada).toBe('ficha_d');
    expect(inA.pendencias).toEqual([]);
    expect(inC.pendencias).toEqual([]);
  });

  // Recusa na 1ª inadequação (sem histórico) → insulina (caminho pré-teto preservado).
  it('Recusa na 1ª (histórico=0) → insulina, A (ficha_b) e C (ficha_d)', () => {
    const inA = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'recusa' }, 50, PESO, 25, 0);
    const inC = aplicarRegrasFichaA({ ...base, checklist_dieta: false, pactuacao_adesao: 'recusa' }, 50, PESO, 32, 0);
    expect(inA.proxima_ficha_recomendada).toBe('ficha_b');
    expect(inC.proxima_ficha_recomendada).toBe('ficha_d');
  });
});

describe('42T — Sinal de encerramento por insulinização (entrada do gate 42B/42D)', () => {
  // O gate de encerramento vive na Edge Function salvar-ficha-retorno e dispara
  // quando proxima_ficha_recomendada ∈ {ficha_b, ficha_d}. A Edge Function (Deno,
  // com imports remotos e Deno.serve no topo) não é importável no vitest; aqui
  // asseveramos o SINAL que o gate consome — provado idêntico em A e C. A decisão
  // no backend é o espelho de aplicarRegras (mesma lógica de fichaADecisao.ts).
  const INSULINA: [string, ChecklistInput, number][] = [
    ['R2 + recusa', { ...base, checklist_dieta: false, pactuacao_adesao: 'recusa' }, 50],
    ['R3', { ...base }, 50],
    ['R4b (não-confirma + recusa)', { ...base, checklist_dieta: false, memoria_glicosimetro: 'nao_confirma', pactuacao_adesao: 'recusa' }, 80],
  ];
  for (const [nome, input, pct] of INSULINA) {
    it(`${nome}: IG25 → ficha_b e IG32 → ficha_d (ambos disparam o gate)`, () => {
      expect(aplicarRegrasFichaA(input, pct, PESO, 25).proxima_ficha_recomendada).toBe('ficha_b');
      expect(aplicarRegrasFichaA(input, pct, PESO, 32).proxima_ficha_recomendada).toBe('ficha_d');
    });
  }
});

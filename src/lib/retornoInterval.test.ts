import { describe, it, expect } from 'vitest';
import { calcularIntervaloRetornoDias } from './retornoInterval';

describe('calcularIntervaloRetornoDias (38B-C #17)', () => {
  it('1º perfil glicêmico (Retorno 2) → 10 dias, independente da IG', () => {
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: true, igSemanas: 28 })).toBe(10);
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: true, igSemanas: 34 })).toBe(10);
  });

  it('demais perfis ≤ 30 sem → 15 dias', () => {
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 30 })).toBe(15);
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 20 })).toBe(15);
  });

  it('demais perfis > 30 sem → 7 dias', () => {
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 31 })).toBe(7);
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 36 })).toBe(7);
  });

  it('Ficha E → 7 dias (independe de IG e de ser o 1º perfil)', () => {
    expect(calcularIntervaloRetornoDias({ ehFichaE: true, ehPrimeiroPerfil: false, igSemanas: 25 })).toBe(7);
    expect(calcularIntervaloRetornoDias({ ehFichaE: true, ehPrimeiroPerfil: true, igSemanas: 34 })).toBe(7);
  });

  it('IG nula → tratada como ≤ 30 (15 dias) para perfis subsequentes', () => {
    expect(calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: null })).toBe(15);
  });
});

// Fluxograma das especialistas (ago/2026): REFORÇAR MEV → reavaliar em 7 a 10
// dias, e a equipe fixou 7 como prazo MÁXIMO. Antes disso o sistema devolvia os
// mesmos 15 dias do caso estável — a gestante SEM controle esperava mais que a
// controlada, que é o avesso do protocolo.
describe('reforçar MEV (Regra 2) tem teto de 7 dias', () => {
  it('perfil inadequado com falha de adesão: 7 dias, mesmo com 26 semanas', () => {
    expect(calcularIntervaloRetornoDias({
      ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 26, regraAplicada: 'regra_2',
    })).toBe(7);
  });

  it('por ser TETO, vence os 10 dias do primeiro perfil', () => {
    expect(calcularIntervaloRetornoDias({
      ehFichaE: false, ehPrimeiroPerfil: true, igSemanas: 26, regraAplicada: 'regra_2',
    })).toBe(7);
  });

  it('as demais regras seguem inalteradas', () => {
    const base = { ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 26 };
    expect(calcularIntervaloRetornoDias({ ...base, regraAplicada: 'regra_manter' })).toBe(15);
    expect(calcularIntervaloRetornoDias({ ...base, regraAplicada: 'regra_4' })).toBe(15);
    expect(calcularIntervaloRetornoDias({ ...base, regraAplicada: 'regra_3' })).toBe(15);
    expect(calcularIntervaloRetornoDias({ ...base, regraAplicada: null })).toBe(15);
  });

  it('acima de 30 semanas já eram 7 dias — nada muda', () => {
    expect(calcularIntervaloRetornoDias({
      ehFichaE: false, ehPrimeiroPerfil: false, igSemanas: 32, regraAplicada: 'regra_2',
    })).toBe(7);
  });

  it('Ficha E continua com o intervalo próprio', () => {
    expect(calcularIntervaloRetornoDias({
      ehFichaE: true, ehPrimeiroPerfil: false, igSemanas: 26, regraAplicada: 'regra_2',
    })).toBe(7);
  });
});

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

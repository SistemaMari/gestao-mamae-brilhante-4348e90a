import { describe, it, expect } from 'vitest';
import {
  calcularDppISO,
  janelaRetestePuerperal,
  JANELA_RETESTE_PUERPERAL_SEMANAS,
} from './dpp';

describe('calcularDppISO — DPP = base_data + 280 dias', () => {
  it('soma 40 semanas (280 dias) à DUM efetiva', () => {
    // 2026-01-01 + 280d = 2026-10-08
    expect(calcularDppISO('2026-01-01')).toBe('2026-10-08');
  });

  it('atravessa virada de ano corretamente', () => {
    // 2026-06-15 + 280d = 2027-03-22
    expect(calcularDppISO('2026-06-15')).toBe('2027-03-22');
  });

  it('lida com ano bissexto (29/02 no meio da janela)', () => {
    // 2028 é bissexto; 2027-08-01 + 280d = 2028-05-07
    expect(calcularDppISO('2027-08-01')).toBe('2028-05-07');
  });

  it('retorna null sem âncora', () => {
    expect(calcularDppISO(null)).toBeNull();
    expect(calcularDppISO(undefined)).toBeNull();
    expect(calcularDppISO('')).toBeNull();
  });
});

describe('janelaRetestePuerperal — 6 a 8 semanas pós-âncora', () => {
  it('usa a constante clínica 6/8 semanas', () => {
    expect(JANELA_RETESTE_PUERPERAL_SEMANAS).toEqual({ min: 6, max: 8 });
  });

  it('calcula início (+42d) e fim (+56d) a partir da âncora', () => {
    // 2026-01-01 + 42d = 2026-02-12 ; + 56d = 2026-02-26
    expect(janelaRetestePuerperal('2026-01-01')).toEqual({
      inicioISO: '2026-02-12',
      fimISO: '2026-02-26',
    });
  });

  it('retorna null quando a âncora é ausente/inválida', () => {
    expect(janelaRetestePuerperal(null)).toBeNull();
    expect(janelaRetestePuerperal(undefined)).toBeNull();
    expect(janelaRetestePuerperal('')).toBeNull();
  });

  it('encadeia com a DPP para os motivos ancorados em DPP', () => {
    const dpp = calcularDppISO('2026-01-01'); // 2026-10-08
    expect(dpp).toBe('2026-10-08');
    // 2026-10-08 + 42d = 2026-11-19 ; +56d = 2026-12-03
    expect(janelaRetestePuerperal(dpp)).toEqual({
      inicioISO: '2026-11-19',
      fimISO: '2026-12-03',
    });
  });
});

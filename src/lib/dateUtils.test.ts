import { describe, it, expect } from 'vitest';
import { validarDataClinica, parseDateLocal, formatDateBR, todayLocalISO, formatDateISO } from './dateUtils';

describe('validarDataClinica (Prompt 34B seção 3.10)', () => {
  it('aceita string vazia (não preenchido = não inválido)', () => {
    expect(validarDataClinica('')).toEqual({ valida: true });
    expect(validarDataClinica(null)).toEqual({ valida: true });
    expect(validarDataClinica(undefined)).toEqual({ valida: true });
  });

  it('aceita datas reais do calendário', () => {
    expect(validarDataClinica('2026-01-15').valida).toBe(true);
    expect(validarDataClinica('2026-02-28').valida).toBe(true);
    expect(validarDataClinica('2028-02-29').valida).toBe(true); // bissexto
    expect(validarDataClinica('2026-12-31').valida).toBe(true);
  });

  it('rejeita 30/02 (fevereiro não tem 30 dias)', () => {
    const r = validarDataClinica('2026-02-30');
    expect(r.valida).toBe(false);
    if (r.valida === false) expect(r.motivo).toContain('inválida');
  });

  it('rejeita 31/04 (abril tem 30 dias)', () => {
    expect(validarDataClinica('2026-04-31').valida).toBe(false);
  });

  it('rejeita 31/06 (junho tem 30 dias)', () => {
    expect(validarDataClinica('2026-06-31').valida).toBe(false);
  });

  it('rejeita 31/09 (setembro tem 30 dias)', () => {
    expect(validarDataClinica('2026-09-31').valida).toBe(false);
  });

  it('rejeita 31/11 (novembro tem 30 dias)', () => {
    expect(validarDataClinica('2026-11-31').valida).toBe(false);
  });

  it('rejeita 29/02 em ano não bissexto', () => {
    expect(validarDataClinica('2026-02-29').valida).toBe(false);
  });

  it('rejeita mês fora de 1-12', () => {
    expect(validarDataClinica('2026-13-01').valida).toBe(false);
    expect(validarDataClinica('2026-00-15').valida).toBe(false);
  });

  it('rejeita dia fora de 1-31', () => {
    expect(validarDataClinica('2026-01-32').valida).toBe(false);
    expect(validarDataClinica('2026-01-00').valida).toBe(false);
  });

  it('rejeita ano fora da faixa esperada', () => {
    expect(validarDataClinica('1899-01-01').valida).toBe(false);
    expect(validarDataClinica('2101-01-01').valida).toBe(false);
  });

  it('rejeita formatos malformados', () => {
    expect(validarDataClinica('2026/01/15').valida).toBe(false);
    expect(validarDataClinica('15-01-2026').valida).toBe(false);
    expect(validarDataClinica('2026-1-1').valida).toBe(false);
    expect(validarDataClinica('abc').valida).toBe(false);
  });

  it('nunca lança exceção', () => {
    const inputs = ['', null, undefined, 'qualquer', '2026-02-30', '2026/01/15', '   '];
    for (const v of inputs) {
      expect(() => validarDataClinica(v)).not.toThrow();
    }
  });
});

// Smoke tests dos helpers existentes — garantem que não regrediram.
describe('dateUtils helpers (smoke)', () => {
  it('parseDateLocal converte YYYY-MM-DD em Date local', () => {
    const d = parseDateLocal('2026-03-15');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2); // 0-indexed: março
    expect(d?.getDate()).toBe(15);
  });

  it('formatDateBR retorna dd/MM/yyyy', () => {
    expect(formatDateBR('2026-03-15')).toBe('15/03/2026');
  });

  it('formatDateISO retorna yyyy-MM-dd no fuso local', () => {
    const d = new Date(2026, 2, 15);
    expect(formatDateISO(d)).toBe('2026-03-15');
  });

  it('todayLocalISO devolve string YYYY-MM-DD', () => {
    const hoje = todayLocalISO();
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, it, expect } from 'vitest';
import { datasDoProximoPeriodo } from './papelControle';

describe('datasDoProximoPeriodo', () => {
  it('começa no dia SEGUINTE à consulta — o papel é para daqui pra frente', () => {
    const d = datasDoProximoPeriodo('2026-08-26', 3);
    expect(d).toEqual(['27/08/2026', '28/08/2026', '29/08/2026']);
  });

  it('devolve exatamente a quantidade de dias pedida', () => {
    expect(datasDoProximoPeriodo('2026-08-26', 15)).toHaveLength(15);
    expect(datasDoProximoPeriodo('2026-08-26', 10)).toHaveLength(10);
  });

  it('atravessa a virada do mês', () => {
    const d = datasDoProximoPeriodo('2026-08-30', 3);
    expect(d).toEqual(['31/08/2026', '01/09/2026', '02/09/2026']);
  });

  it('atravessa a virada do ano', () => {
    const d = datasDoProximoPeriodo('2026-12-30', 3);
    expect(d).toEqual(['31/12/2026', '01/01/2027', '02/01/2027']);
  });

  it('respeita ano bissexto', () => {
    const d = datasDoProximoPeriodo('2028-02-27', 3);
    expect(d).toEqual(['28/02/2028', '29/02/2028', '01/03/2028']);
  });

  it('data inválida ou dias inválidos não quebram nada', () => {
    expect(datasDoProximoPeriodo('', 15)).toEqual([]);
    expect(datasDoProximoPeriodo('2026-08-26', 0)).toEqual([]);
    expect(datasDoProximoPeriodo('2026-08-26', -3)).toEqual([]);
  });
});

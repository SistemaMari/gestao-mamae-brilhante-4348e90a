import { describe, it, expect } from 'vitest';
import { pedidosExamesFetais, fichaTemPedidoExames } from './pedidosExamesFetais';

describe('pedidosExamesFetais — cronograma por IG', () => {
  it('IG nula → nenhum pedido', () => {
    expect(pedidosExamesFetais(null)).toEqual([]);
    expect(pedidosExamesFetais(undefined)).toEqual([]);
  });

  it('1º trimestre (13 sem) → só morfológico', () => {
    expect(pedidosExamesFetais(13)).toEqual(['ficha.pedidoExames.morfologico']);
  });

  it('20 sem → nada (morfológico já passou, crescimento ainda não)', () => {
    expect(pedidosExamesFetais(20)).toEqual([]);
  });

  it('28 sem → crescimento 28-32 + CMF', () => {
    expect(pedidosExamesFetais(28)).toEqual([
      'ficha.pedidoExames.crescimento2832',
      'ficha.pedidoExames.cmf',
    ]);
  });

  it('30 sem → crescimento 28-32 + CMF (CTG/PBF só a partir de 32)', () => {
    expect(pedidosExamesFetais(30)).toEqual([
      'ficha.pedidoExames.crescimento2832',
      'ficha.pedidoExames.cmf',
    ]);
  });

  it('32 sem (não medicamentoso) → crescimento 28-32 + CMF + CTG + PBF', () => {
    expect(pedidosExamesFetais(32)).toEqual([
      'ficha.pedidoExames.crescimento2832',
      'ficha.pedidoExames.cmf',
      'ficha.pedidoExames.ctg',
      'ficha.pedidoExames.pbf',
    ]);
  });

  it('34 sem (não medicamentoso) → crescimento 36 + CMF + CTG + PBF', () => {
    expect(pedidosExamesFetais(34)).toEqual([
      'ficha.pedidoExames.crescimento36',
      'ficha.pedidoExames.cmf',
      'ficha.pedidoExames.ctg',
      'ficha.pedidoExames.pbf',
    ]);
  });

  it('limite 33 sem → crescimento vira o da 36ª (não o 28-32)', () => {
    expect(pedidosExamesFetais(33)).toContain('ficha.pedidoExames.crescimento36');
    expect(pedidosExamesFetais(33)).not.toContain('ficha.pedidoExames.crescimento2832');
  });

  it('em insulina (MARI encerra): CTG/PBF viram a mensagem de 34 sem medicamentoso', () => {
    const p = pedidosExamesFetais(34, true);
    expect(p).toContain('ficha.pedidoExames.ctgPbfMedicamentoso');
    expect(p).not.toContain('ficha.pedidoExames.ctg');
    expect(p).not.toContain('ficha.pedidoExames.pbf');
  });

  it('em insulina sem IG → só a mensagem forward', () => {
    expect(pedidosExamesFetais(null, true)).toEqual(['ficha.pedidoExames.ctgPbfMedicamentoso']);
  });
});

describe('fichaTemPedidoExames', () => {
  it('perfis de acompanhamento têm pedido', () => {
    for (const t of ['ficha_a', 'ficha_c', 'ficha_e', 'ficha_b', 'ficha_d']) {
      expect(fichaTemPedidoExames(t)).toBe(true);
    }
  });
  it('rastreio/diagnóstico não têm pedido no laudo', () => {
    for (const t of ['consulta_1', 'retorno_1', 'gtt', 'registro_parto', null, undefined]) {
      expect(fichaTemPedidoExames(t)).toBe(false);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  pedidosExamesFetais, fichaTemPedidoExames, pedidosJaAtendidos,
  PEDIDO_MORFOLOGICO, PEDIDO_CRESCIMENTO_2832, PEDIDO_CRESCIMENTO_36, separarPedidos,
} from './pedidosExamesFetais';

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

// ---------------------------------------------------------------------------
// V4 — pedido não se repete quando o exame PONTUAL já foi trazido.
// Bug do print da Carla: com "Crescimento fetal: Adequado" registrado na PRÓPRIA
// consulta (28s2d), o laudo ainda pedia a US de crescimento 28–32 — e repetia o
// pedido na consulta seguinte (31s5d).
// ---------------------------------------------------------------------------
describe('pedidosJaAtendidos — o que já foi trazido', () => {
  it('sem registro nenhum → nada atendido', () => {
    expect(pedidosJaAtendidos([])).toEqual([]);
    expect(pedidosJaAtendidos([{ igSemanas: 28 }])).toEqual([]);
  });

  it('crescimento registrado com 28 sem atende o pedido 28-32', () => {
    expect(pedidosJaAtendidos([{ igSemanas: 28, crescimento: 'adequado' }]))
      .toEqual([PEDIDO_CRESCIMENTO_2832]);
  });

  it('itens 4/5/6 do checklist do Retorno 2 também atendem a US de crescimento', () => {
    expect(pedidosJaAtendidos([{ igSemanas: 29, pfe_us: 'sim', ca: 'sim', la: 'sim' }]))
      .toEqual([PEDIDO_CRESCIMENTO_2832]);
  });

  it('"sem_info" no checklist NÃO atende (a gestante não trouxe o exame)', () => {
    expect(pedidosJaAtendidos([
      { igSemanas: 29, pfe_us: 'sem_info', ca: 'sem_info', la: 'sem_info' },
    ])).toEqual([]);
  });

  it('US feita aos 28-32 NÃO atende o pedido da 36ª semana (são dois exames)', () => {
    const feitos = pedidosJaAtendidos([{ igSemanas: 30, crescimento: 'adequado' }]);
    expect(feitos).toContain(PEDIDO_CRESCIMENTO_2832);
    expect(feitos).not.toContain(PEDIDO_CRESCIMENTO_36);
  });

  it('US feita a partir de 33 sem atende o pedido da 36ª semana', () => {
    expect(pedidosJaAtendidos([{ igSemanas: 36, crescimento: 'adequado' }]))
      .toEqual([PEDIDO_CRESCIMENTO_36]);
  });

  it('morfológico registrado atende para sempre (janela única na gestação)', () => {
    expect(pedidosJaAtendidos([{ igSemanas: 31, morfologico: 'normal' }]))
      .toEqual([PEDIDO_MORFOLOGICO]);
  });

  it('registro sem IG conhecida não atende janela nenhuma de crescimento', () => {
    expect(pedidosJaAtendidos([{ igSemanas: null, crescimento: 'adequado' }])).toEqual([]);
  });
});

describe('pedidosExamesFetais — suprime pedido pontual já atendido', () => {
  it('Carla 28s2d: crescimento registrado na própria consulta → some o pedido 28-32, fica o CMF', () => {
    const feitos = pedidosJaAtendidos([{ igSemanas: 28, crescimento: 'adequado' }]);
    expect(pedidosExamesFetais(28, false, feitos)).toEqual(['ficha.pedidoExames.cmf']);
  });

  it('Carla 31s5d: exame já trazido antes → segue sem repetir o pedido', () => {
    const feitos = pedidosJaAtendidos([
      { igSemanas: 28, crescimento: 'adequado' },
      { igSemanas: 31, morfologico: 'normal' },
    ]);
    expect(pedidosExamesFetais(31, false, feitos)).toEqual(['ficha.pedidoExames.cmf']);
  });

  it('vigilância CONTÍNUA não é suprimida por registro (CMF/CTG/PBF seguem toda consulta)', () => {
    const feitos = pedidosJaAtendidos([{ igSemanas: 32, crescimento: 'adequado' }]);
    expect(pedidosExamesFetais(32, false, feitos)).toEqual([
      'ficha.pedidoExames.cmf',
      'ficha.pedidoExames.ctg',
      'ficha.pedidoExames.pbf',
    ]);
  });

  it('a partir de 33 sem o pedido da 36ª volta, mesmo com a US de 28-32 feita', () => {
    const feitos = pedidosJaAtendidos([{ igSemanas: 30, crescimento: 'adequado' }]);
    expect(pedidosExamesFetais(34, false, feitos)).toContain('ficha.pedidoExames.crescimento36');
  });

  it('sem lista de atendidos, o comportamento é o de antes (retrocompatível)', () => {
    expect(pedidosExamesFetais(28)).toEqual([
      'ficha.pedidoExames.crescimento2832',
      'ficha.pedidoExames.cmf',
    ]);
  });
});

// ---------------------------------------------------------------------------
// V4 — dois blocos no laudo: "Solicitar exames" (pontuais pendentes) e
// "Vigilância fetal contínua" (CMF/CTG/PBF, que reaparece a cada consulta).
// ---------------------------------------------------------------------------
describe('separarPedidos — solicitar × vigilância contínua', () => {
  it('28 sem sem nada trazido: US de crescimento em Solicitar, CMF em Vigilância', () => {
    expect(separarPedidos(pedidosExamesFetais(28))).toEqual({
      solicitar: [PEDIDO_CRESCIMENTO_2832],
      vigilancia: ['ficha.pedidoExames.cmf'],
    });
  });

  it('Carla 28s2d com o exame já trazido: Solicitar fica VAZIO, sobra a vigilância', () => {
    const feitos = pedidosJaAtendidos([{ igSemanas: 28, crescimento: 'adequado' }]);
    expect(separarPedidos(pedidosExamesFetais(28, false, feitos))).toEqual({
      solicitar: [],
      vigilancia: ['ficha.pedidoExames.cmf'],
    });
  });

  it('32 sem: CTG e PBF entram na vigilância, não em Solicitar', () => {
    const { solicitar, vigilancia } = separarPedidos(pedidosExamesFetais(32));
    expect(solicitar).toEqual([PEDIDO_CRESCIMENTO_2832]);
    expect(vigilancia).toEqual([
      'ficha.pedidoExames.cmf', 'ficha.pedidoExames.ctg', 'ficha.pedidoExames.pbf',
    ]);
  });

  it('em insulina: a mensagem de CTG/PBF (34 sem) é vigilância', () => {
    const { vigilancia } = separarPedidos(pedidosExamesFetais(34, true));
    expect(vigilancia).toContain('ficha.pedidoExames.ctgPbfMedicamentoso');
  });

  it('13 sem: só o morfológico, e nada de vigilância', () => {
    expect(separarPedidos(pedidosExamesFetais(13))).toEqual({
      solicitar: [PEDIDO_MORFOLOGICO],
      vigilancia: [],
    });
  });
});

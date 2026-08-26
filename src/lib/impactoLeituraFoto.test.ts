import { describe, it, expect } from 'vitest';
import {
  calcularImpactoLeitura, leituraMereceAtencao, type PontoMeta,
} from './impactoLeituraFoto';

// Ficha A/C com pós-prandial pactuado em 1 hora.
const METAS_1H: PontoMeta[] = [
  { ponto: 'jejum', meta: 95 },
  { ponto: 'pos_cafe', meta: 140 },
  { ponto: 'pos_almoco', meta: 140 },
  { ponto: 'pos_jantar', meta: 140 },
];

const linha = (jejum: number, cafe: number, almoco: number, jantar: number) => ({
  jejum: String(jejum), pos_cafe: String(cafe),
  pos_almoco: String(almoco), pos_jantar: String(jantar),
});

describe('fronteira da meta', () => {
  it('jejum 94 está na fronteira: 96 estouraria a meta de 95', () => {
    const r = calcularImpactoLeitura([linha(94, 120, 120, 120)], METAS_1H);
    expect(r.naFronteira).toContain('0:jejum');
  });

  it('jejum 90 não está na fronteira — nenhum erro plausível cruza 95', () => {
    const r = calcularImpactoLeitura([linha(90, 120, 120, 120)], METAS_1H);
    expect(r.naFronteira).not.toContain('0:jejum');
  });

  it('vale para os dois lados: 96 também está na fronteira', () => {
    const r = calcularImpactoLeitura([linha(96, 120, 120, 120)], METAS_1H);
    expect(r.naFronteira).toContain('0:jejum');
  });

  it('pós-prandial 138 está na fronteira de 140; 130 não está', () => {
    const r = calcularImpactoLeitura([linha(90, 138, 130, 120)], METAS_1H);
    expect(r.naFronteira).toContain('0:pos_cafe');
    expect(r.naFronteira).not.toContain('0:pos_almoco');
  });

  it('a meta muda com a janela pactuada — 118 é fronteira em 2h, não em 1h', () => {
    const metas2h: PontoMeta[] = [{ ponto: 'pos_cafe', meta: 120 }];
    expect(calcularImpactoLeitura([{ pos_cafe: '118' }], metas2h).naFronteira)
      .toContain('0:pos_cafe');
    expect(calcularImpactoLeitura([{ pos_cafe: '118' }], [{ ponto: 'pos_cafe', meta: 140 }]).naFronteira)
      .toEqual([]);
  });

  it('hipoglicemia não é questão de fronteira — é achado próprio', () => {
    const r = calcularImpactoLeitura([linha(65, 120, 120, 120)], METAS_1H);
    expect(r.naFronteira).not.toContain('0:jejum');
  });
});

describe('quantos erros bastariam para virar a conduta', () => {
  it('tudo folgado dentro da meta: nada vira, nem que tudo esteja errado', () => {
    const grid = Array.from({ length: 7 }, () => linha(88, 120, 118, 122));
    const r = calcularImpactoLeitura(grid, METAS_1H);
    expect(r.percentual).toBe(100);
    expect(r.errosParaMudar).toBeNull();
    expect(leituraMereceAtencao(r)).toBe(false);
  });

  it('o caso do teste real: 64% na meta, e bastariam poucos erros para virar', () => {
    // Os 7 dias da foto conferida com a Moara.
    const grid = [
      linha(90, 139, 139, 138), linha(90, 138, 140, 141), linha(90, 135, 141, 139),
      linha(95, 140, 139, 140), linha(90, 141, 138, 143), linha(90, 139, 130, 142),
      linha(90, 139, 143, 139),
    ];
    const r = calcularImpactoLeitura(grid, METAS_1H);
    expect(r.totalValores).toBe(28);
    expect(r.adequadoAgora).toBe(false);
    // 18 de 28 na meta; seriam necessários 20 → faltam 2, e há valores de
    // fronteira suficientes para isso acontecer.
    expect(r.naMeta).toBe(18);
    expect(r.errosParaMudar).toBe(2);
    expect(leituraMereceAtencao(r)).toBe(true);
  });

  it('controle adequado com folga: precisa de muitos erros para perder', () => {
    // 28 valores, todos na meta e longe dela → nenhum de fronteira.
    const grid = Array.from({ length: 7 }, () => linha(85, 110, 112, 108));
    const r = calcularImpactoLeitura(grid, METAS_1H);
    expect(r.adequadoAgora).toBe(true);
    expect(r.errosParaMudar).toBeNull();
  });

  it('adequado no limite, com valores de fronteira: um erro derruba', () => {
    // 10 valores, 7 na meta (70%). Um deles de fronteira → 1 erro tira da meta.
    const grid = [
      { jejum: '88', pos_cafe: '110', pos_almoco: '112', pos_jantar: '139' },
      { jejum: '88', pos_cafe: '110', pos_almoco: '112', pos_jantar: '180' },
      { jejum: '190', pos_cafe: '190' },
    ];
    const r = calcularImpactoLeitura(grid, METAS_1H);
    expect(r.adequadoAgora).toBe(true);
    expect(r.errosParaMudar).toBe(1);
    expect(leituraMereceAtencao(r)).toBe(true);
  });
});

describe('só o que veio da foto é posto em dúvida', () => {
  it('valor digitado à mão não entra na faixa de incerteza', () => {
    const grid = [linha(94, 138, 120, 120)];
    const soFoto = new Set(['0:jejum']);
    const r = calcularImpactoLeitura(grid, METAS_1H, soFoto);
    expect(r.naFronteira).toEqual(['0:jejum']);
  });

  it('conjunto vazio: nada em dúvida, nada pode virar', () => {
    const grid = [linha(94, 138, 120, 120)];
    const r = calcularImpactoLeitura(grid, METAS_1H, new Set());
    expect(r.naFronteira).toEqual([]);
    expect(r.errosParaMudar).toBeNull();
  });
});

describe('grade vazia', () => {
  it('não quebra e não inventa percentual', () => {
    const r = calcularImpactoLeitura([{ jejum: '', pos_cafe: '' }], METAS_1H);
    expect(r.percentual).toBeNull();
    expect(r.errosParaMudar).toBeNull();
    expect(leituraMereceAtencao(r)).toBe(false);
  });
});

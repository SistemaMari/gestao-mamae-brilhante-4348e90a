import { describe, it, expect } from 'vitest';
import {
  fimDoCiclo, inicioDoCiclo, mesDeUso, diasParaVencer, emJanelaDeRenovacao,
  dentroDaGarantia, inicioDaRenovacao,
} from '../../supabase/functions/_shared/renovacao.ts';

const anual = { data_inicio_assinatura: '2026-01-10T12:00:00Z', proxima_renovacao: '2027-01-10T12:00:00Z' };

describe('fimDoCiclo / inicioDoCiclo', () => {
  it('compra anual pelo link: fim = proxima_renovacao', () => {
    expect(fimDoCiclo(anual)?.toISOString()).toBe('2027-01-10T12:00:00.000Z');
    expect(inicioDoCiclo(anual)?.toISOString()).toBe('2026-01-10T12:00:00.000Z');
  });
  it('mensalidade antiga: fim = início + 12 meses (não a próxima cobrança)', () => {
    const mensal = { ...anual, proxima_renovacao: '2026-02-10T12:00:00Z', asaas_subscription_id: 'sub_1' };
    expect(fimDoCiclo(mensal)?.toISOString()).toBe('2027-01-10T12:00:00.000Z');
  });
  it('sem datas: null', () => {
    expect(fimDoCiclo({ data_inicio_assinatura: null, proxima_renovacao: null })).toBeNull();
    expect(mesDeUso({ data_inicio_assinatura: null, proxima_renovacao: null })).toBeNull();
  });
});

describe('mesDeUso', () => {
  it('conta o mês do ano (1 a 12)', () => {
    expect(mesDeUso(anual, new Date('2026-01-15T12:00:00Z'))).toBe(1);
    expect(mesDeUso(anual, new Date('2026-02-09T12:00:00Z'))).toBe(1);
    expect(mesDeUso(anual, new Date('2026-02-11T12:00:00Z'))).toBe(2);
    expect(mesDeUso(anual, new Date('2026-06-20T12:00:00Z'))).toBe(6);
    expect(mesDeUso(anual, new Date('2027-01-05T12:00:00Z'))).toBe(12);
  });
  it('fica entre 1 e 12', () => {
    expect(mesDeUso(anual, new Date('2025-12-01T12:00:00Z'))).toBe(1);
    expect(mesDeUso(anual, new Date('2027-05-01T12:00:00Z'))).toBe(12);
  });
});

describe('diasParaVencer / emJanelaDeRenovacao', () => {
  it('avisa a partir de 60 dias antes', () => {
    expect(diasParaVencer(anual, new Date('2026-11-11T12:00:00Z'))).toBe(60);
    expect(emJanelaDeRenovacao(anual, new Date('2026-11-11T12:00:00Z'))).toBe(true);
    expect(emJanelaDeRenovacao(anual, new Date('2026-11-09T12:00:00Z'))).toBe(false);
  });
  it('vencido não está mais na janela', () => {
    expect(emJanelaDeRenovacao(anual, new Date('2027-01-12T12:00:00Z'))).toBe(false);
  });
});

describe('dentroDaGarantia', () => {
  it('até 7 dias da compra', () => {
    expect(dentroDaGarantia(anual, new Date('2026-01-17T11:00:00Z'))).toBe(true);
    expect(dentroDaGarantia(anual, new Date('2026-01-17T13:00:00Z'))).toBe(false);
  });
});

describe('inicioDaRenovacao', () => {
  const agora = new Date('2026-11-20T12:00:00Z');
  it('renovou antes de vencer: o ano novo começa no fim do atual', () => {
    expect(inicioDaRenovacao('2027-01-10T12:00:00Z', 'ativo', agora).toISOString()).toBe('2027-01-10T12:00:00.000Z');
  });
  it('já vencido ou conta não ativa: começa hoje', () => {
    expect(inicioDaRenovacao('2026-10-10T12:00:00Z', 'ativo', agora)).toBe(agora);
    expect(inicioDaRenovacao('2027-01-10T12:00:00Z', 'inadimplente', agora)).toBe(agora);
    expect(inicioDaRenovacao(null, 'ativo', agora)).toBe(agora);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aplicarVariaveisLaudo,
  montarVariaveisLaudo,
  calcularDataProximoRetornoLaudo,
  MARCADOR_AUSENTE,
} from './laudoVariaveis';

describe('aplicarVariaveisLaudo', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('substitui uma variável conhecida pelo valor', () => {
    const out = aplicarVariaveisLaudo('A paciente [nome da paciente] foi avaliada.', {
      'nome da paciente': 'Maria',
    });
    expect(out).toBe('A paciente Maria foi avaliada.');
  });

  it('substitui múltiplas ocorrências da mesma variável', () => {
    const out = aplicarVariaveisLaudo('[IG] e novamente [IG].', { IG: '22 semanas' });
    expect(out).toBe('22 semanas e novamente 22 semanas.');
  });

  it('usa o marcador quando a variável é conhecida mas sem valor', () => {
    const out = aplicarVariaveisLaudo('Glicemia de [glicemia de jejum] mg/dL.', {
      'glicemia de jejum': null,
    });
    expect(out).toBe(`Glicemia de ${MARCADOR_AUSENTE} mg/dL.`);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('usa o marcador (com warn) quando a variável é desconhecida', () => {
    const out = aplicarVariaveisLaudo('Valor [variavel inexistente] aqui.', {});
    expect(out).toBe(`Valor ${MARCADOR_AUSENTE} aqui.`);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('trata string vazia como ausente', () => {
    const out = aplicarVariaveisLaudo('[dose manhã]', { 'dose manhã': '' });
    expect(out).toBe(MARCADOR_AUSENTE);
  });

  it('não altera texto sem colchetes', () => {
    const texto = 'Mantenha o pré-natal habitual até a realização do GTT 75g.';
    expect(aplicarVariaveisLaudo(texto, {})).toBe(texto);
  });

  it('tolera chave com espaços ao redor dentro dos colchetes', () => {
    const out = aplicarVariaveisLaudo('[ % na meta ]%', { '% na meta': '73' });
    expect(out).toBe('73%');
  });
});

describe('calcularDataProximoRetornoLaudo', () => {
  it('1ª Ficha A/C (1º perfil) = data da consulta + 10 dias', () => {
    expect(
      calcularDataProximoRetornoLaudo(
        { id: 'c1', tipo: 'ficha_a', data: '2026-03-01' },
        [{ id: 'c1', tipo: 'ficha_a' }],
        22,
      ),
    ).toBe('2026-03-11');
  });

  it('Ficha A/C subsequente: +15 dias (≤30 sem) e +7 dias (>30 sem)', () => {
    const consultas = [
      { id: 'c1', tipo: 'ficha_a' },
      { id: 'c2', tipo: 'ficha_c' },
    ];
    expect(
      calcularDataProximoRetornoLaudo({ id: 'c2', tipo: 'ficha_c', data: '2026-03-01' }, consultas, 22),
    ).toBe('2026-03-16');
    expect(
      calcularDataProximoRetornoLaudo({ id: 'c2', tipo: 'ficha_c', data: '2026-03-01' }, consultas, 32),
    ).toBe('2026-03-08');
  });

  it('Ficha E = +7 dias mesmo sendo o único perfil', () => {
    expect(
      calcularDataProximoRetornoLaudo(
        { id: 'c1', tipo: 'ficha_e', data: '2026-03-01' },
        [{ id: 'c1', tipo: 'ficha_e' }],
        22,
      ),
    ).toBe('2026-03-08');
  });

  it('Ficha B/D nunca é 1º perfil: +15 (≤30) e +7 (>30)', () => {
    expect(
      calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'ficha_b', data: '2026-03-01' }, [{ id: 'c1', tipo: 'ficha_b' }], 22),
    ).toBe('2026-03-16');
    expect(
      calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'ficha_d', data: '2026-03-01' }, [{ id: 'c1', tipo: 'ficha_d' }], 32),
    ).toBe('2026-03-08');
  });

  it('tipos sem retorno datado (Caso Novo / diagnósticos) → null', () => {
    expect(calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'consulta_1', data: '2026-03-01' }, [], 22)).toBeNull();
    expect(calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'retorno_1', data: '2026-03-01' }, [], 22)).toBeNull();
    expect(calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'gtt', data: '2026-03-01' }, [], 22)).toBeNull();
  });

  it('sem data da consulta → null', () => {
    expect(calcularDataProximoRetornoLaudo({ id: 'c1', tipo: 'ficha_a', data: null }, [], 22)).toBeNull();
  });
});

describe('montarVariaveisLaudo', () => {
  const paciente = { nome: 'Ana Souza' };

  it('formata nome, IG e glicemia', () => {
    const vars = montarVariaveisLaudo({
      paciente,
      ig: { semanas: 22, dias: 3 },
      consulta: { tipo: 'retorno_1', retorno1_valor_gj: 98 },
    });
    expect(vars['nome da paciente']).toBe('Ana Souza');
    expect(vars['IG']).toBe('22 semanas e 3 dias');
    expect(vars['glicemia de jejum']).toBe('98');
  });

  it('calcula a data do próximo retorno por consulta (1ª Ficha A = +10 dias)', () => {
    const vars = montarVariaveisLaudo({
      paciente,
      ig: { semanas: 22, dias: 0 },
      consulta: { id: 'c1', tipo: 'ficha_a', data: '2026-03-01' },
      consultas: [{ id: 'c1', tipo: 'ficha_a' }],
    });
    expect(vars['data do próximo retorno']).toBe('11/03/2026');
  });

  it('IG com 0 dias omite a parte de dias; 1 dia usa singular', () => {
    expect(montarVariaveisLaudo({ paciente, ig: { semanas: 24, dias: 0 }, consulta: {} })['IG']).toBe('24 semanas');
    expect(montarVariaveisLaudo({ paciente, ig: { semanas: 24, dias: 1 }, consulta: {} })['IG']).toBe('24 semanas e 1 dia');
  });

  it('usa as doses gravadas quando existem; percentual arredondado', () => {
    const vars = montarVariaveisLaudo({
      paciente,
      ig: null,
      consulta: { dose_total: 20, dose_manha: 14, dose_noite: 6, percentual_meta: 72.6 },
    });
    expect(vars['dose total de insulina']).toBe('20 UI');
    expect(vars['dose atual de insulina']).toBe('20 UI');
    expect(vars['dose manhã']).toBe('14 UI');
    expect(vars['dose noite']).toBe('6 UI');
    expect(vars['% na meta']).toBe('73');
  });

  it('deriva manhã (⅔) e noite (⅓) da dose total quando não foram gravadas', () => {
    const vars = montarVariaveisLaudo({
      paciente,
      ig: null,
      consulta: { dose_total: 36 }, // só a total (peso informado pelo card)
    });
    expect(vars['dose total de insulina']).toBe('36 UI');
    expect(vars['dose manhã']).toBe('24 UI');
    expect(vars['dose noite']).toBe('12 UI');
  });

  it('valores ausentes ficam null (viram marcador na renderização)', () => {
    const vars = montarVariaveisLaudo({ paciente, ig: null, consulta: {} });
    expect(vars['IG']).toBeNull();
    expect(vars['glicemia de jejum']).toBeNull();
    expect(vars['data do próximo retorno']).toBeNull();
    expect(vars['dose total de insulina']).toBeNull();
    expect(vars['dose manhã']).toBeNull();
  });
});

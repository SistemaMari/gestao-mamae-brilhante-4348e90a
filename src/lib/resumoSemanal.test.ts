import { describe, it, expect } from 'vitest';
import {
  deveEnviarGestorGeral,
  ehEmailDemo,
  ehSegunda,
  escaparHtml,
  montarEmailGestor,
  montarEmailGestorGeral,
  rotuloSemanaAnterior,
  semanaDoEnvio,
  temAlgoARelatar,
  totalPendencias,
  type NumerosUnidade,
} from '../../supabase/functions/_shared/resumoSemanal.ts';

const unidade = (over: Partial<NumerosUnidade> = {}): NumerosUnidade => ({
  unidade_id: 'u1',
  nome: 'Unidade Centro',
  rede: 'Rede Exemplo',
  sem_gj_primeira_consulta: 0,
  atrasadas_gtt: 0,
  confirmadas_sem_retorno: 0,
  laudos_semana: 0,
  novas_gestantes_semana: 0,
  ...over,
});

const links = { painel: 'https://app.test/gestao', configuracoes: 'https://app.test/gestao/configuracoes' };

describe('semanaDoEnvio (segunda-feira em Brasília)', () => {
  it('segunda de manhã em Brasília → a própria segunda', () => {
    // 10:00 UTC = 07:00 BRT de segunda, 19/10/2026
    expect(semanaDoEnvio(new Date('2026-10-19T10:00:00Z'))).toBe('2026-10-19');
  });

  it('segunda 01:00 UTC ainda é domingo em Brasília → segunda anterior', () => {
    expect(semanaDoEnvio(new Date('2026-10-19T01:00:00Z'))).toBe('2026-10-12');
  });

  it('meio da semana e domingo voltam para a segunda', () => {
    expect(semanaDoEnvio(new Date('2026-10-15T15:00:00Z'))).toBe('2026-10-12');
    expect(semanaDoEnvio(new Date('2026-10-18T20:00:00Z'))).toBe('2026-10-12');
  });

  it('atravessa virada de mês e de ano', () => {
    expect(semanaDoEnvio(new Date('2026-11-01T15:00:00Z'))).toBe('2026-10-26');
    expect(semanaDoEnvio(new Date('2027-01-01T15:00:00Z'))).toBe('2026-12-28');
  });
});

describe('ehSegunda / rotuloSemanaAnterior', () => {
  it('valida a segunda-feira', () => {
    expect(ehSegunda('2026-10-19')).toBe(true);
    expect(ehSegunda('2026-10-20')).toBe(false);
    expect(ehSegunda('2026-02-30')).toBe(false);
    expect(ehSegunda('19/10/2026')).toBe(false);
  });

  it('semana anterior = segunda a domingo antes do envio', () => {
    expect(rotuloSemanaAnterior('2026-10-19')).toBe('12/10 a 18/10');
    expect(rotuloSemanaAnterior('2026-11-02')).toBe('26/10 a 01/11');
  });
});

describe('regra de envio', () => {
  it('soma os 3 gargalos', () => {
    expect(totalPendencias(unidade({ sem_gj_primeira_consulta: 2, atrasadas_gtt: 1, confirmadas_sem_retorno: 3 }))).toBe(6);
  });

  it('envia com pendência mesmo sem atividade', () => {
    expect(temAlgoARelatar(unidade({ atrasadas_gtt: 1 }))).toBe(true);
  });

  it('envia "tudo em dia" quando houve atividade na semana', () => {
    expect(temAlgoARelatar(unidade({ laudos_semana: 1 }))).toBe(true);
    expect(temAlgoARelatar(unidade({ novas_gestantes_semana: 2 }))).toBe(true);
  });

  it('não envia sem pendência e sem atividade', () => {
    expect(temAlgoARelatar(unidade())).toBe(false);
  });

  it('gestor geral: envia se alguma unidade tem algo', () => {
    expect(deveEnviarGestorGeral([unidade(), unidade({ unidade_id: 'u2', laudos_semana: 1 })])).toBe(true);
    expect(deveEnviarGestorGeral([unidade(), unidade({ unidade_id: 'u2' })])).toBe(false);
    expect(deveEnviarGestorGeral([])).toBe(false);
  });

  it('reconhece e-mail de demonstração', () => {
    expect(ehEmailDemo('Gestor.Centro@DEMO.mari.health', 'demo.mari.health')).toBe(true);
    expect(ehEmailDemo('gestor@hospital.com.br', 'demo.mari.health')).toBe(false);
  });
});

describe('montarEmailGestor', () => {
  it('assunto com a unidade, números, botão e descadastro', () => {
    const e = montarEmailGestor({
      nome: 'Paulo',
      unidade: unidade({ sem_gj_primeira_consulta: 2, atrasadas_gtt: 1, laudos_semana: 4, novas_gestantes_semana: 3 }),
      semana: '2026-10-19',
      links,
    });
    expect(e.subject).toBe('Resumo da semana — Unidade Centro');
    expect(e.html).toContain('3 pendências para resolver hoje');
    expect(e.html).toContain('Sem glicemia de jejum na 1ª consulta');
    expect(e.html).toContain('Atrasadas para o GTT');
    expect(e.html).toContain('Diagnosticadas sem retorno');
    expect(e.html).toContain('Semana passada (12/10 a 18/10)');
    expect(e.html).toContain('href="https://app.test/gestao"');
    expect(e.html).toContain('Abrir o painel');
    expect(e.html).toContain('href="https://app.test/gestao/configuracoes"');
    expect(e.text).toContain('- Atrasadas para o GTT: 1');
    expect(e.text).toContain('- Laudos emitidos: 4');
    expect(e.text).toContain('- Gestantes novas cadastradas: 3');
    expect(e.text).toContain('https://app.test/gestao/configuracoes');
  });

  it('"Tudo em dia" sem pendências; singular com 1', () => {
    const tudo = montarEmailGestor({ nome: null, unidade: unidade({ laudos_semana: 1 }), semana: '2026-10-19', links });
    expect(tudo.html).toContain('Tudo em dia');
    expect(tudo.text).toContain('Olá. Este é o resumo');
    const um = montarEmailGestor({ nome: 'A', unidade: unidade({ confirmadas_sem_retorno: 1 }), semana: '2026-10-19', links });
    expect(um.html).toContain('1 pendência para resolver hoje');
  });

  it('escapa HTML de nomes', () => {
    const e = montarEmailGestor({ nome: '<b>x</b>', unidade: unidade({ nome: 'A & B "C"', laudos_semana: 1 }), semana: '2026-10-19', links });
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(e.html).toContain('A &amp; B &quot;C&quot;');
    expect(escaparHtml(`'`)).toBe('&#39;');
  });

  it('nenhum atributo style é quebrado por aspas duplas', () => {
    const e = montarEmailGestor({ nome: 'A', unidade: unidade({ laudos_semana: 1 }), semana: '2026-10-19', links });
    for (const m of e.html.matchAll(/style="([^"]*)"/g)) {
      expect(m[1].trim().endsWith(';') || /[a-z0-9)%]$/i.test(m[1].trim())).toBe(true);
    }
    expect(e.html).not.toMatch(/style="[^"]*"[A-Za-z ]+[",]/);
  });
});

describe('montarEmailGestorGeral', () => {
  const linksGG = { painel: 'https://app.test/consolidar/visao-geral', configuracoes: 'https://app.test/consolidar/configuracoes' };

  it('uma linha por unidade + total; assunto com a rede', () => {
    const e = montarEmailGestorGeral({
      nome: 'Regina',
      unidades: [
        unidade({ unidade_id: 'a', nome: 'Unidade Norte', sem_gj_primeira_consulta: 1, atrasadas_gtt: 2, laudos_semana: 3, novas_gestantes_semana: 1 }),
        unidade({ unidade_id: 'b', nome: 'Unidade Sul', confirmadas_sem_retorno: 1, laudos_semana: 2 }),
      ],
      semana: '2026-10-19',
      links: linksGG,
    });
    expect(e.subject).toBe('Resumo da semana — Rede Exemplo');
    expect(e.html).toContain('Unidade Norte');
    expect(e.html).toContain('Unidade Sul');
    expect(e.html).toContain('Total');
    expect(e.html).toContain('4 pendências para resolver hoje');
    expect(e.text).toContain('- Unidade Norte: 3 pendência(s) / 3 laudo(s) / 1 nova(s)');
    expect(e.text).toContain('- Total: 4 pendência(s) / 5 laudo(s) / 1 nova(s)');
    expect(e.html).toContain('href="https://app.test/consolidar/configuracoes"');
  });

  it('várias redes: assunto genérico e nome da rede nas linhas', () => {
    const e = montarEmailGestorGeral({
      nome: null,
      unidades: [unidade({ rede: 'Rede A', nome: 'U1' }), unidade({ rede: 'Rede B', nome: 'U2' })],
      semana: '2026-10-19',
      links: linksGG,
    });
    expect(e.subject).toBe('Resumo da semana — suas unidades');
    expect(e.html).toContain('Rede A');
    expect(e.text).toContain('- Rede B · U2');
    expect(e.html).toContain('Tudo em dia');
  });
});

import { describe, it, expect } from 'vitest';
import {
  janelaDaIg, respostaVigenteDaJanela, chaveLegendaJanela, ultimoRegistroCrescimento,
  type ConsultaComCrescimento,
} from './janelaCrescimentoFetal';

const consulta = (
  consultaId: string,
  igSemanas: number | null,
  v: Partial<ConsultaComCrescimento> = {},
): ConsultaComCrescimento => ({
  consultaId, igSemanas, data: '2026-08-25',
  pfe_us: null, ca: null, la: null, crescimento: null, ...v,
});

describe('janelaDaIg', () => {
  it('antes de 28 sem não há exame de crescimento', () => {
    expect(janelaDaIg(20)).toBeNull();
    expect(janelaDaIg(27)).toBeNull();
    expect(janelaDaIg(null)).toBeNull();
  });

  it('28 a 32 sem → 1º exame', () => {
    expect(janelaDaIg(28)).toBe('j2832');
    expect(janelaDaIg(32)).toBe('j2832');
  });

  it('33 a 35 sem → NADA a preencher (o 1º passou, o 2º ainda não aconteceu)', () => {
    expect(janelaDaIg(33)).toBeNull();
    expect(janelaDaIg(34)).toBeNull();
    expect(janelaDaIg(35)).toBeNull();
  });

  it('a partir de 36 sem → 2º exame', () => {
    expect(janelaDaIg(36)).toBe('j36');
    expect(janelaDaIg(39)).toBe('j36');
  });
});

// A gestante do print: exame lido aos 28 sem, retorno aos 34. Não há campo para
// preencher (fora de janela), mas o resultado conhecido continua à vista, e o
// pedido do exame da 36ª já sai no laudo — é o que o médico faz nessa consulta.
describe('semanas sem coleta (IG 33–35)', () => {
  const historico = [consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim', crescimento: 'adequado' })];

  it('não abre coleta: nenhuma janela vigente aos 34 sem', () => {
    expect(janelaDaIg(34)).toBeNull();
    expect(respostaVigenteDaJanela(34, historico, 'c2')).toBeNull();
  });

  it('mas o último resultado conhecido segue disponível para exibição', () => {
    const ultimo = ultimoRegistroCrescimento(historico, 'c2');
    expect(ultimo?.consultaId).toBe('c1');
    expect(ultimo?.janela).toBe('j2832');
    expect(ultimo?.valores.crescimento).toBe('adequado');
  });

  it('exame REGISTRADO entre 33 e 35 não pertence a janela nenhuma', () => {
    const ultimo = ultimoRegistroCrescimento(
      [consulta('c1', 34, { pfe_us: 'sim', ca: 'sim', la: 'sim' })], 'c2',
    );
    expect(ultimo?.janela).toBeNull();
  });

  it('sem exame nenhum registrado, não há o que exibir', () => {
    expect(ultimoRegistroCrescimento([], 'c1')).toBeNull();
    expect(ultimoRegistroCrescimento([consulta('c1', 30)], 'c2')).toBeNull();
  });

  it('o último vence o anterior quando há mais de um exame', () => {
    const dois = [
      consulta('c1', 29, { crescimento: 'adequado' }),
      consulta('c2', 36, { crescimento: 'excessivo' }),
    ];
    expect(ultimoRegistroCrescimento(dois, 'c3')?.consultaId).toBe('c2');
  });
});

describe('respostaVigenteDaJanela', () => {
  it('primeira consulta da janela → ninguém respondeu ainda, ela coleta', () => {
    expect(respostaVigenteDaJanela(28, [], 'c1')).toBeNull();
  });

  it('retorno seguinte DENTRO da janela → devolve a resposta da consulta de origem', () => {
    const historico = [consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' })];
    const r = respostaVigenteDaJanela(31, historico, 'c2');
    expect(r?.janela).toBe('j2832');
    expect(r?.consultaId).toBe('c1');
    expect(r?.valores).toEqual({ pfe_us: 'sim', ca: 'sim', la: 'sim', crescimento: null });
  });

  it('dez retornos na janela → sempre a MESMA resposta, da mesma consulta', () => {
    const historico = [consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' })];
    for (const ig of [29, 30, 31, 32]) {
      expect(respostaVigenteDaJanela(ig, historico, 'cX')?.consultaId).toBe('c1');
    }
  });

  it('chegou na 36ª semana → janela nova, volta a perguntar', () => {
    const historico = [consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' })];
    expect(respostaVigenteDaJanela(36, historico, 'c9')).toBeNull();
  });

  it('respondido o 2º exame, retorno seguinte na mesma janela exibe fechado', () => {
    const historico = [
      consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' }),
      consulta('c5', 36, { pfe_us: 'sim', ca: 'sim', la: 'sim' }),
    ];
    expect(respostaVigenteDaJanela(38, historico, 'c6')?.consultaId).toBe('c5');
  });

  it('"sem_info" não trava nada — a gestante não trouxe o exame', () => {
    const historico = [consulta('c1', 28, { pfe_us: 'sem_info', ca: 'sem_info', la: 'sem_info' })];
    expect(respostaVigenteDaJanela(30, historico, 'c2')).toBeNull();
  });

  it('a própria consulta não trava a si mesma enquanto é preenchida', () => {
    const historico = [consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' })];
    expect(respostaVigenteDaJanela(28, historico, 'c1')).toBeNull();
  });

  it('vence a PRIMEIRA consulta da janela (onde o exame foi trazido)', () => {
    const historico = [
      consulta('c1', 28, { pfe_us: 'sim', ca: 'sim', la: 'sim' }),
      consulta('c2', 30, { pfe_us: 'nao', ca: 'nao', la: 'nao' }),
    ];
    expect(respostaVigenteDaJanela(32, historico, 'c3')?.consultaId).toBe('c1');
  });

  it('o crescimento (card da Ficha E) também é leitura do mesmo ultrassom', () => {
    const historico = [consulta('c1', 29, { crescimento: 'adequado' })];
    const r = respostaVigenteDaJanela(31, historico, 'c2');
    expect(r?.valores.crescimento).toBe('adequado');
  });

  it('consulta sem IG conhecida não pertence a janela nenhuma', () => {
    const historico = [consulta('c1', null, { pfe_us: 'sim', ca: 'sim', la: 'sim' })];
    expect(respostaVigenteDaJanela(30, historico, 'c2')).toBeNull();
  });
});

describe('chaveLegendaJanela', () => {
  it('ao COLETAR, a legenda da 36ª avisa que são parâmetros novos', () => {
    expect(chaveLegendaJanela('j36', false)).toBe('ficha.checklistRetorno2.janela36');
  });

  it('ao EXIBIR resultado já lido, usa a forma neutra (sem "parâmetros novos")', () => {
    expect(chaveLegendaJanela('j36', true)).toBe('ficha.checklistRetorno2.janelaRegistro36');
    expect(chaveLegendaJanela('j2832', true)).toBe('ficha.checklistRetorno2.janelaRegistro2832');
  });
});

import { describe, it, expect } from 'vitest';
import { lerPactuacaoAnterior } from './lerPactuacaoAnterior';

describe('lerPactuacaoAnterior', () => {
  const c = (
    dataDaConsulta: string,
    over: Partial<{ janela: '1h' | '2h'; inicio: string; fim: string; pontos: number | null; numero_sequencial: number }> = {},
  ) => ({
    id: `c-${dataDaConsulta}`,
    data: dataDaConsulta,
    numero_sequencial: over.numero_sequencial ?? 1,
    created_at: `${dataDaConsulta}T00:00:00Z`,
    pactuou_janela_prox_perfil: over.janela ?? '1h',
    pactuou_inicio_prox_perfil: over.inicio ?? '2026-09-24',
    pactuou_fim_prox_perfil: over.fim ?? '2026-10-03',
    pactuou_pontos_prox_perfil: 'pontos' in over ? over.pontos! : 4,
  });

  it('devolve null quando não há nenhuma consulta com pactuação', () => {
    const consultas = [{ id: 'a', pactuou_janela_prox_perfil: null }];
    expect(lerPactuacaoAnterior(consultas, 4)).toBeNull();
  });

  it('devolve a pactuação de 4 pontos quando existe', () => {
    const res = lerPactuacaoAnterior([c('2026-09-20', { janela: '2h' })], 4);
    expect(res).toEqual({ janela: '2h', inicio: '2026-09-24', fim: '2026-10-03', pontos: 4 });
  });

  it('ignora pactuações que não casam com o número de pontos pedido', () => {
    const consultas = [c('2026-09-20', { pontos: 6 })];
    expect(lerPactuacaoAnterior(consultas, 4)).toBeNull();
  });

  it('escolhe a MAIS RECENTE quando há várias', () => {
    const consultas = [
      c('2026-08-01', { janela: '1h' }),
      c('2026-09-15', { janela: '2h' }),
      c('2026-08-15', { janela: '1h' }),
    ];
    expect(lerPactuacaoAnterior(consultas, 4)?.janela).toBe('2h');
  });

  it('devolve pactuação de 6 pontos para Ficha E', () => {
    const consultas = [
      c('2026-09-15', { pontos: 4, janela: '1h' }),
      c('2026-09-18', { pontos: 6, janela: '2h', inicio: '2026-09-22', fim: '2026-09-28' }),
    ];
    expect(lerPactuacaoAnterior(consultas, 6)).toEqual({
      janela: '2h', inicio: '2026-09-22', fim: '2026-09-28', pontos: 6,
    });
  });

  it('ignora entradas com colunas parcialmente preenchidas (violaria o CHECK atômico do banco, mas defensivo)', () => {
    const partial = { ...c('2026-09-20'), pactuou_fim_prox_perfil: null };
    expect(lerPactuacaoAnterior([partial], 4)).toBeNull();
  });

  it('mesma data: desempata por numero_sequencial (bug set/2026 — sort empatava e voltava a primeira do array)', () => {
    // 2 consultas no mesmo dia: Retorno 1 (seq 2) e Ficha A/C (seq 3). Sem
    // desempate estável, o filtro voltaria a de menor seq (por ordem clínica
    // do array); a Moara viu isso na "Gestante teste pactuação 1h e 2h".
    const consultas = [
      c('2026-09-22', { numero_sequencial: 2, janela: '1h', inicio: '2026-08-11', fim: '2026-08-17' }),
      c('2026-09-22', { numero_sequencial: 3, janela: '2h', inicio: '2026-08-18', fim: '2026-08-27' }),
    ];
    const escolhida = lerPactuacaoAnterior(consultas, 4);
    expect(escolhida?.inicio).toBe('2026-08-18');
    expect(escolhida?.janela).toBe('2h');
  });

  it('sem created_at (padrão PreviewConsulta): ainda escolhe a mais recente por data', () => {
    const consultas = [
      { data: '2026-08-01', numero_sequencial: 2, pactuou_janela_prox_perfil: '1h', pactuou_inicio_prox_perfil: '2026-08-11', pactuou_fim_prox_perfil: '2026-08-17', pactuou_pontos_prox_perfil: 4 },
      { data: '2026-09-22', numero_sequencial: 3, pactuou_janela_prox_perfil: '2h', pactuou_inicio_prox_perfil: '2026-08-18', pactuou_fim_prox_perfil: '2026-08-27', pactuou_pontos_prox_perfil: 4 },
    ];
    expect(lerPactuacaoAnterior(consultas, 4)?.janela).toBe('2h');
  });
});

import { describe, it, expect } from 'vitest';
import { lerPactuacaoAnterior } from './lerPactuacaoAnterior';

describe('lerPactuacaoAnterior', () => {
  const c = (created_at: string, over: Partial<{ janela: '1h' | '2h'; inicio: string; fim: string; pontos: number | null }> = {}) => ({
    id: `c-${created_at}`,
    created_at,
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
});

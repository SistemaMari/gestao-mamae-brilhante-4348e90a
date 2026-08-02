import { describe, it, expect } from 'vitest';
import { escolherDecisaoVigente } from './proximoPasso';

describe('escolherDecisaoVigente — mão única do fluxo (nunca 6→4)', () => {
  it('após uma Ficha E, uma Ficha A/C posterior (dado torto) NÃO vira a vigente', () => {
    // Sequência impossível no fluxo real (o motor nunca roteia 6→4); só aparece com
    // datas fora de ordem / edição, como na "Ana". A vigente tem de ser a Ficha E.
    const consultas = [
      { tipo: 'ficha_a', proxima_ficha_recomendada: 'ficha_a' },
      { tipo: 'ficha_e', proxima_ficha_recomendada: 'ficha_e' },
      { tipo: 'ficha_a', proxima_ficha_recomendada: 'ficha_a' },
    ];
    const vigente = escolherDecisaoVigente(consultas);
    expect(vigente?.tipo).toBe('ficha_e');
    // O próximo passo jamais será de 4 pontos (ficha_a/ficha_c).
    expect(vigente?.proxima_ficha_recomendada).toBe('ficha_e');
  });

  it('Ficha E que encerra (insulina) também mantém a paciente fora dos 4 pontos', () => {
    const consultas = [
      { tipo: 'ficha_c', proxima_ficha_recomendada: 'ficha_e' },
      { tipo: 'ficha_e', proxima_ficha_recomendada: 'ficha_d' }, // insulina → encerra
    ];
    expect(escolherDecisaoVigente(consultas)?.tipo).toBe('ficha_e');
  });

  it('havendo várias Ficha E, a vigente é a última (por ordem cronológica)', () => {
    const consultas = [
      { tipo: 'ficha_e', proxima_ficha_recomendada: 'ficha_e', id: 'e1' },
      { tipo: 'ficha_e', proxima_ficha_recomendada: 'ficha_e', id: 'e2' },
    ];
    expect((escolherDecisaoVigente(consultas) as { id: string } | null)?.id).toBe('e2');
  });

  it('jornada só de 4 pontos: usa a última Ficha A/C com decisão', () => {
    const consultas = [
      { tipo: 'ficha_a', proxima_ficha_recomendada: 'ficha_a' },
      { tipo: 'ficha_a', proxima_ficha_recomendada: 'ficha_e' },
    ];
    expect(escolherDecisaoVigente(consultas)?.proxima_ficha_recomendada).toBe('ficha_e');
  });

  it('sem nenhuma decisão registrada → null', () => {
    expect(escolherDecisaoVigente([{ tipo: 'retorno_1' }])).toBeNull();
    expect(escolherDecisaoVigente([{ tipo: 'ficha_a', proxima_ficha_recomendada: null }])).toBeNull();
    expect(escolherDecisaoVigente([])).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { ordenarPorSequenciaClinica } from './ordenarConsultas';

describe('ordenarPorSequenciaClinica — ordem clínica, não por data', () => {
  it('Glicemia de jejum vem antes do perfil de 4 pontos, mesmo com data posterior', () => {
    // Caso do Erro 3: a glicemia (retorno_1) foi criada primeiro, mas recebeu uma
    // DATA posterior à do perfil (ficha_a). A ordem clínica precisa prevalecer.
    const consultas = [
      { tipo: 'ficha_a', created_at: '2026-03-08T10:00:00Z', data: '2026-03-08' },
      { tipo: 'retorno_1', created_at: '2026-02-20T10:00:00Z', data: '2026-05-20' },
      { tipo: 'consulta_1', created_at: '2026-02-15T10:00:00Z', data: '2026-02-15' },
    ];
    const ord = ordenarPorSequenciaClinica(consultas);
    expect(ord.map(c => c.tipo)).toEqual(['consulta_1', 'retorno_1', 'ficha_a']);
  });

  it('respeita Caso Novo → Glicemia → GTT → perfis → parto', () => {
    const consultas = [
      { tipo: 'registro_parto', created_at: '2026-09-01T00:00:00Z' },
      { tipo: 'ficha_e', created_at: '2026-06-01T00:00:00Z' },
      { tipo: 'gtt', created_at: '2026-04-01T00:00:00Z' },
      { tipo: 'ficha_a', created_at: '2026-05-01T00:00:00Z' },
      { tipo: 'retorno_1', created_at: '2026-03-01T00:00:00Z' },
      { tipo: 'consulta_1', created_at: '2026-02-01T00:00:00Z' },
    ];
    expect(ordenarPorSequenciaClinica(consultas).map(c => c.tipo)).toEqual([
      'consulta_1', 'retorno_1', 'gtt', 'ficha_a', 'ficha_e', 'registro_parto',
    ]);
  });

  it('perfis de acompanhamento entre si seguem a ordem de criação (não a data)', () => {
    const consultas = [
      { tipo: 'ficha_a', created_at: '2026-05-03T00:00:00Z', id: 'terceira' },
      { tipo: 'ficha_a', created_at: '2026-05-01T00:00:00Z', id: 'primeira' },
      { tipo: 'ficha_e', created_at: '2026-05-02T00:00:00Z', id: 'segunda' },
    ];
    expect(ordenarPorSequenciaClinica(consultas).map(c => (c as { id: string }).id))
      .toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('não muta a lista original', () => {
    const consultas = [
      { tipo: 'ficha_a', created_at: '2026-03-01T00:00:00Z' },
      { tipo: 'consulta_1', created_at: '2026-02-01T00:00:00Z' },
    ];
    const copia = [...consultas];
    ordenarPorSequenciaClinica(consultas);
    expect(consultas).toEqual(copia);
  });
});

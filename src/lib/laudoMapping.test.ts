import { describe, it, expect } from 'vitest';
import { cenarioSemTextoLaudo } from './laudoMapping';

describe('cenarioSemTextoLaudo', () => {
  it('Caso Novo (consulta_1) é card-only — inclusive DMG afastado', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'consulta_1' })).toBe(true);
    expect(cenarioSemTextoLaudo({ tipo: 'consulta_1', status_gerado: 'dmg_afastado' })).toBe(true);
  });

  it('parto (cenário 5) é card-only', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'registro_parto' })).toBe(true);
    expect(cenarioSemTextoLaudo({ tipo: 'resultado_parto' })).toBe(true);
  });

  it('encerramento por controle inadequado — Ficha B/D < 70% (cenário 7) — é card-only', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_b', percentual_meta: 29 })).toBe(true);
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_d', percentual_meta: 50 })).toBe(true);
  });

  it('Ficha B/D adequada (≥70%, cenário 4) NÃO é card-only — tem texto', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_b', percentual_meta: 85 })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_d', percentual_meta: 70 })).toBe(false);
  });

  it('diagnósticos e Ficha A/C têm texto — NÃO são card-only', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'retorno_1', cenario_clinico: '1' })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'retorno_1', status_gerado: 'encaminhada_endocrino' })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'gtt', cenario_clinico: '6' })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'gtt', cenario_clinico: 'negativo' })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_a', percentual_meta: 50 })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_c', percentual_meta: 85 })).toBe(false);
  });
});

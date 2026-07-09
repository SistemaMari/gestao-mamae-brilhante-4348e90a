import { describe, it, expect } from 'vitest';
import { cenarioSemTextoLaudo, ehDesfechoInsulina } from './laudoMapping';

describe('cenarioSemTextoLaudo', () => {
  it('Caso Novo (consulta_1) é card-only — inclusive DMG afastado', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'consulta_1' })).toBe(true);
    expect(cenarioSemTextoLaudo({ tipo: 'consulta_1', status_gerado: 'dmg_afastado' })).toBe(true);
  });

  it('parto (cenário 5) é card-only', () => {
    expect(cenarioSemTextoLaudo({ tipo: 'registro_parto' })).toBe(true);
    expect(cenarioSemTextoLaudo({ tipo: 'resultado_parto' })).toBe(true);
  });

  it('encerramento por controle inadequado — Ficha B/D < 70% (cenário 7) — TEM texto (não é card-only)', () => {
    // O cenário 7 voltou a ter laudo (Justificativa + Conduta): reajuste de insulina,
    // encerramento da MARI e metas obstétricas. O card vermelho segue como bloco 1.
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_b', percentual_meta: 29 })).toBe(false);
    expect(cenarioSemTextoLaudo({ tipo: 'ficha_d', percentual_meta: 50 })).toBe(false);
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

describe('ehDesfechoInsulina (banner de urgência com endocrinologista)', () => {
  it('true só para as 3 chaves de insulina que encerram (r2/r3/r4b)', () => {
    expect(ehDesfechoInsulina('r2_insulina')).toBe(true);
    expect(ehDesfechoInsulina('r3_insulina')).toBe(true);
    expect(ehDesfechoInsulina('r4b_insulina')).toBe(true);
  });

  it('false para condutas sem insulina, fallbacks e nulos', () => {
    expect(ehDesfechoInsulina('r1_manter')).toBe(false);
    expect(ehDesfechoInsulina('r2_reforcar')).toBe(false);
    expect(ehDesfechoInsulina('r4a_fichae')).toBe(false);
    expect(ehDesfechoInsulina('3')).toBe(false); // fallback legado, não recebe o texto novo
    expect(ehDesfechoInsulina(null)).toBe(false);
    expect(ehDesfechoInsulina(undefined)).toBe(false);
  });
});

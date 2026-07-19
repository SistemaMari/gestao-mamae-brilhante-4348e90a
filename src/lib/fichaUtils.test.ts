import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calcIdadeGestacional,
  calcIdadeGestacionalStruct,
  resolveUsgAtiva,
  getStatusPacienteChip,
  isPacienteEncerrada,
  STATUS_CONFIG,
  type UsgRefInput,
} from './fichaUtils';

/**
 * Testes de IG — foco no contrato do fallback (Prompt 33B):
 *  Quando referencia_ig = 'usg' e referencia_usg_id é NULL,
 *  o sistema DEVE usar silenciosamente a USG de ordem = 1.
 *  Nunca lançar erro, nunca retornar IG vazia se houver USG ordem=1 disponível.
 *
 * Todas as datas são absolutas (YYYY-MM-DD) para evitar drift de timezone.
 * "Hoje" é congelado em 2026-06-01 local via fake timer.
 */

// Hoje fixo: 2026-06-01 00:00:00 (horário local — usado pelo parseDateLocal).
const HOJE = new Date(2026, 5, 1, 0, 0, 0, 0); // mês 0-indexado: 5 = Junho

// Helpers de USG com datas absolutas, baseadas em diferenças contadas de HOJE.
//  - hoje = 2026-06-01
//  - usg1 = 2026-03-23 (70 dias atrás), IG na época: 10s 0d  → IG hoje: 20s 0d
//  - usg2 = 2026-05-18 (14 dias atrás), IG na época: 18s 0d  → IG hoje: 20s 0d
//  - usg3 = 2026-05-25 (7 dias atrás), IG na época: 22s 0d   → IG hoje: 23s 0d
//  - dum  = 2026-01-12 (140 dias atrás)                       → IG hoje: 20s 0d
const USG_1 = '2026-03-23';
const USG_2 = '2026-05-18';
const USG_3 = '2026-05-25';
const DUM   = '2026-01-12';

function mkUsg(id: string, ordem: number, data: string, sem: number, dias = 0): UsgRefInput {
  return { id, ordem, data_exame: data, ig_semanas: sem, ig_dias: dias };
}

describe('resolveUsgAtiva', () => {
  const u1 = mkUsg('u1', 1, USG_1, 10);
  const u2 = mkUsg('u2', 2, USG_2, 18);
  const u3 = mkUsg('u3', 3, USG_3, 22);

  it('retorna USG correspondente quando id está na lista', () => {
    expect(resolveUsgAtiva([u1, u2, u3], 'u2')).toBe(u2);
  });

  it('aplica fallback ordem=1 quando referencia_usg_id é null', () => {
    expect(resolveUsgAtiva([u1, u2, u3], null)).toBe(u1);
  });

  it('aplica fallback ordem=1 quando referencia_usg_id é undefined', () => {
    expect(resolveUsgAtiva([u1, u2, u3], undefined)).toBe(u1);
  });

  it('aplica fallback ordem=1 quando id não existe na lista (USG apagada)', () => {
    expect(resolveUsgAtiva([u1, u2, u3], 'id-fantasma')).toBe(u1);
  });

  it('retorna null quando lista vazia', () => {
    expect(resolveUsgAtiva([], 'u1')).toBeNull();
  });

  it('retorna null quando lista é undefined', () => {
    expect(resolveUsgAtiva(undefined, 'u1')).toBeNull();
  });

  it('nunca lança exceção mesmo com inputs inválidos', () => {
    expect(() => resolveUsgAtiva(undefined, null)).not.toThrow();
    expect(() => resolveUsgAtiva([], undefined)).not.toThrow();
    expect(() => resolveUsgAtiva([u1], 'qualquer-coisa')).not.toThrow();
  });

  it('fallback se ordem=1 inexistir → cai pra primeira USG da lista', () => {
    const u2only = mkUsg('u2', 2, USG_2, 18);
    const u3only = mkUsg('u3', 3, USG_3, 22);
    expect(resolveUsgAtiva([u2only, u3only], null)).toBe(u2only);
  });
});

describe('calcIdadeGestacional — fallback crítico (33B)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOJE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const u1 = mkUsg('u1', 1, USG_1, 10); // → 20s 0d hoje
  const u2 = mkUsg('u2', 2, USG_2, 18); // → 20s 0d hoje
  const u3 = mkUsg('u3', 3, USG_3, 22); // → 23s 0d hoje

  it('referencia_ig=usg + referencia_usg_id válido → usa essa USG (u3 = 23s 0d)', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'usg',
      referencia_usg_id: 'u3',
      usgs: [u1, u2, u3],
      dum: DUM,
    });
    expect(ig).toBe('23 sem + 0 dias');
  });

  it('FALLBACK CRÍTICO: referencia_ig=usg + referencia_usg_id=NULL → usa USG ordem=1 silenciosamente', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'usg',
      referencia_usg_id: null,
      usgs: [u1, u2, u3],
      dum: DUM,
    });
    // u1 (ordem=1): 10s 0d em 2026-03-23, hoje 2026-06-01 = +70 dias = 20s 0d
    expect(ig).toBe('20 sem + 0 dias');
    expect(ig).not.toBe('—');
  });

  it('FALLBACK CRÍTICO: referencia_ig=usg + referencia_usg_id=undefined → usa USG ordem=1', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'usg',
      usgs: [u1, u2, u3],
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('FALLBACK CRÍTICO: id apontando para USG apagada → usa USG ordem=1', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'usg',
      referencia_usg_id: 'id-deletado',
      usgs: [u1, u2, u3],
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('referencia_ig=usg + lista de USGs vazia → cai pra DUM (sem lançar erro)', () => {
    expect(() =>
      calcIdadeGestacional({
        referencia_ig: 'usg',
        referencia_usg_id: null,
        usgs: [],
        dum: DUM,
      }),
    ).not.toThrow();
    const ig = calcIdadeGestacional({
      referencia_ig: 'usg',
      referencia_usg_id: null,
      usgs: [],
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('referencia_ig=dum → ignora USGs e usa DUM', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'dum',
      referencia_usg_id: null,
      usgs: [u1, u2, u3],
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('sem usgs nem snapshot nem DUM → retorna "—" (não lança erro)', () => {
    expect(() => calcIdadeGestacional({})).not.toThrow();
    expect(calcIdadeGestacional({})).toBe('—');
  });

  it('nunca lança exceção em nenhum cenário (smoke test do contrato)', () => {
    const cenarios: Array<Parameters<typeof calcIdadeGestacional>[0]> = [
      {},
      { dum: null },
      { dum: 'data-invalida' },
      { referencia_ig: 'usg', usgs: [] },
      { referencia_ig: 'usg', usgs: undefined, referencia_usg_id: null },
      { referencia_ig: 'usg', usgs: [u1], referencia_usg_id: 'inexistente' },
      { referencia_ig: 'dum', dum: null },
      { usg_data: null, usg_ig_semanas: null, usg_ig_dias: null },
    ];
    for (const c of cenarios) {
      expect(() => calcIdadeGestacional(c)).not.toThrow();
    }
  });
});

describe('calcIdadeGestacional — comportamento legado (retrocompat)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(HOJE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('snapshot usg_data + sem/dias funciona quando usgs não é passado', () => {
    const ig = calcIdadeGestacional({
      usg_data: USG_1,
      usg_ig_semanas: 10,
      usg_ig_dias: 0,
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('snapshot é IGNORADO quando referencia_ig=dum (precedência da ref ativa)', () => {
    const ig = calcIdadeGestacional({
      referencia_ig: 'dum',
      usg_data: USG_1,
      usg_ig_semanas: 10,
      usg_ig_dias: 0,
      dum: DUM,
    });
    expect(ig).toBe('20 sem + 0 dias'); // via DUM (não via snapshot)
  });

  it('DUM apenas (sem qualquer USG) → calcula via DUM', () => {
    const ig = calcIdadeGestacional({ dum: DUM });
    expect(ig).toBe('20 sem + 0 dias');
  });

  it('calcIdadeGestacionalStruct retorna {semanas, dias} ou null', () => {
    expect(calcIdadeGestacionalStruct({ dum: DUM }))
      .toEqual({ semanas: 20, dias: 0 });
    expect(calcIdadeGestacionalStruct({})).toBeNull();
  });
});

/**
 * Ajustes V3 itens 5 e 6 — tags de encerramento no painel de pacientes.
 * A tag deve refletir o encerramento (motivo_encerramento efetivo) e não a
 * tag legada "Resultado do parto"; a insulinização precisa ter tag própria.
 */
describe('getStatusPacienteChip — tags do painel (Ajustes V3 itens 5/6)', () => {
  it('paciente ativa → usa STATUS_CONFIG do status_ficha', () => {
    expect(getStatusPacienteChip({ status_ficha: 'dmg_confirmado' }))
      .toEqual(STATUS_CONFIG.dmg_confirmado);
    expect(getStatusPacienteChip({ status_ficha: 'aguardando_gtt' }))
      .toEqual(STATUS_CONFIG.aguardando_gtt);
  });

  it('encerrada por insulinização (status) → tag própria, NÃO cai em Aguardando GJ', () => {
    const chip = getStatusPacienteChip({ status_ficha: 'encerrada_insulinizacao' });
    expect(chip.label).toBe('Encerrada por insulinização');
    expect(chip).not.toEqual(STATUS_CONFIG.aguardando_gj);
  });

  it('motivo=insulinizacao mesmo com status_ficha dmg_confirmado → tag de insulinização', () => {
    const chip = getStatusPacienteChip({
      status_ficha: 'dmg_confirmado',
      motivo_encerramento: 'insulinizacao',
    });
    expect(chip.label).toBe('Encerrada por insulinização');
  });

  it('encerramento manual (parto/aborto) via motivo → tag de encerramento correspondente', () => {
    expect(getStatusPacienteChip({ status_ficha: 'dmg_confirmado', motivo_encerramento: 'parto' }).label)
      .toBe('Encerrada · Parto');
    expect(getStatusPacienteChip({ status_ficha: 'dmg_confirmado', motivo_encerramento: 'aborto' }).label)
      .toBe('Encerrada · Aborto');
  });

  it('status_ficha=resultado_parto legado (sem motivo) → NÃO mostra "Resultado do parto"', () => {
    const chip = getStatusPacienteChip({ status_ficha: 'resultado_parto' });
    expect(chip.label).toBe('Encerrada · Parto');
    expect(chip.label).not.toBe('Resultado do parto');
  });
});

describe('isPacienteEncerrada — filtro "mostrar encerradas"', () => {
  it('ativas retornam false', () => {
    expect(isPacienteEncerrada({ status_ficha: 'dmg_confirmado' })).toBe(false);
    expect(isPacienteEncerrada({ status_ficha: 'aguardando_gj' })).toBe(false);
  });

  it('encerradas (motivo OU status terminal) retornam true', () => {
    expect(isPacienteEncerrada({ status_ficha: 'encerrada_insulinizacao' })).toBe(true);
    expect(isPacienteEncerrada({ status_ficha: 'dmg_confirmado', motivo_encerramento: 'parto' })).toBe(true);
    expect(isPacienteEncerrada({ status_ficha: 'resultado_parto' })).toBe(true);
    expect(isPacienteEncerrada({ status_ficha: 'dmg_afastado' })).toBe(true);
    expect(isPacienteEncerrada({ status_ficha: 'encaminhada_endocrino' })).toBe(true);
  });
});

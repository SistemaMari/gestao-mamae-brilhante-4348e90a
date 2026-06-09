import { describe, it, expect } from 'vitest';
import {
  prepararUsgsParaSalvar,
  ordenarUsgsPorData,
  ordinalUsg,
  temDatasUsgDuplicadas,
  type CasoNovoUsgEntry,
} from './casoNovoUsg';

const mk = (localId: string, dataExame: string, igSemanas = '12', igDias = '0'): CasoNovoUsgEntry => ({
  localId,
  dataExame,
  igSemanas,
  igDias,
});

describe('prepararUsgsParaSalvar', () => {
  it('ordena por data (mais antiga primeiro) e atribui ordem 1..N', () => {
    const out = prepararUsgsParaSalvar([
      mk('c', '2026-03-10'),
      mk('a', '2026-01-05'),
      mk('b', '2026-02-20'),
    ]);
    expect(out.map((u) => u.localId)).toEqual(['a', 'b', 'c']);
    expect(out.map((u) => u.ordem)).toEqual([1, 2, 3]);
    // a 1ª USG é a mais antiga
    expect(out[0]).toMatchObject({ localId: 'a', data_exame: '2026-01-05', ordem: 1 });
  });

  it('descarta entradas sem data ou sem semanas', () => {
    const out = prepararUsgsParaSalvar([
      mk('ok', '2026-02-01'),
      mk('semData', '', '10'),
      { localId: 'semSem', dataExame: '2026-03-01', igSemanas: '', igDias: '0' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].localId).toBe('ok');
    expect(out[0].ordem).toBe(1);
  });

  it('converte semanas/dias para número (dias vazio vira 0)', () => {
    const out = prepararUsgsParaSalvar([mk('x', '2026-02-01', '20', '')]);
    expect(out[0]).toMatchObject({ ig_semanas: 20, ig_dias: 0 });
  });

  it('a USG escolhida como referência mapeia para a ordem certa via localId', () => {
    const entries = [mk('mais-nova', '2026-04-01'), mk('mais-antiga', '2026-01-01')];
    const out = prepararUsgsParaSalvar(entries);
    const escolhida = out.find((u) => u.localId === 'mais-nova');
    expect(escolhida?.ordem).toBe(2); // a mais nova é a 2ª
    expect(out.find((u) => u.localId === 'mais-antiga')?.ordem).toBe(1);
  });
});

describe('ordenarUsgsPorData', () => {
  it('joga entradas sem data para o fim, mantendo as datadas em ordem crescente', () => {
    const out = ordenarUsgsPorData([
      mk('semData', ''),
      mk('b', '2026-02-01'),
      mk('a', '2026-01-01'),
    ]);
    expect(out.map((u) => u.localId)).toEqual(['a', 'b', 'semData']);
  });
});

describe('ordinalUsg', () => {
  it('rotula posição 0-based', () => {
    expect(ordinalUsg(0)).toBe('1ª');
    expect(ordinalUsg(2)).toBe('3ª');
    expect(ordinalUsg(10)).toBe('11ª'); // fora da tabela fixa
  });
});

describe('temDatasUsgDuplicadas', () => {
  it('detecta datas repetidas e ignora vazias', () => {
    expect(temDatasUsgDuplicadas([mk('a', '2026-01-01'), mk('b', '2026-01-01')])).toBe(true);
    expect(temDatasUsgDuplicadas([mk('a', '2026-01-01'), mk('b', '2026-02-01')])).toBe(false);
    expect(temDatasUsgDuplicadas([mk('a', ''), mk('b', '')])).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { montarMatriz, matrizParaCsv, igDiasParaTexto, slugArquivo, type ColunaExport } from './exportarTabelaRede';

interface Linha { nome: string; n: number | null; pct?: number }
const colunas: ColunaExport<Linha>[] = [
  { header: 'Unidade', valor: (l) => l.nome },
  { header: 'Gestantes', valor: (l) => l.n },
  { header: 'Taxa (%)', valor: (l) => l.pct },
];

describe('montarMatriz', () => {
  it('põe cabeçalho e troca null/undefined/NaN por vazio, mantendo a ordem das linhas', () => {
    const m = montarMatriz(colunas, [
      { nome: 'UBS B', n: 3, pct: 12.5 },
      { nome: 'UBS A', n: null },
      { nome: 'UBS C', n: Number.NaN, pct: 0 },
    ]);
    expect(m).toEqual([
      ['Unidade', 'Gestantes', 'Taxa (%)'],
      ['UBS B', 3, 12.5],
      ['UBS A', '', ''],
      ['UBS C', '', 0],
    ]);
  });
  it('sem linhas devolve só o cabeçalho', () => {
    expect(montarMatriz(colunas, [])).toEqual([['Unidade', 'Gestantes', 'Taxa (%)']]);
  });
});

describe('matrizParaCsv', () => {
  it('usa ";" , BOM, CRLF e escapa aspas/;/quebras', () => {
    const csv = matrizParaCsv([['a', 'b'], ['x;y', 'diz "oi"'], ['linha\nnova', 2]], [['Período', '01/10/2026 a 14/10/2026']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Período;01/10/2026 a 14/10/2026',
      '',
      'a;b',
      '"x;y";"diz ""oi"""',
      '"linha\nnova";2',
    ]);
  });
  it('sem metadados não deixa linha em branco no topo', () => {
    expect(matrizParaCsv([['a']])).toBe('﻿a');
  });
});

describe('igDiasParaTexto', () => {
  it('converte dias em semanas + dias', () => {
    expect(igDiasParaTexto(212)).toBe('30 sem 2d');
    expect(igDiasParaTexto(196)).toBe('28 sem 0d');
    expect(igDiasParaTexto(0)).toBe('0 sem 0d');
  });
  it('sem dado vira traço', () => {
    expect(igDiasParaTexto(null)).toBe('—');
    expect(igDiasParaTexto(undefined)).toBe('—');
    expect(igDiasParaTexto(-3)).toBe('—');
  });
});

describe('slugArquivo', () => {
  it('tira acento, espaço e símbolo', () => {
    expect(slugArquivo('Visão geral — Rede São José')).toBe('visao-geral-rede-sao-jose');
  });
});

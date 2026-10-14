import { describe, expect, it } from 'vitest';
import { encontrarUnidadeImportacao } from '@/lib/encontrarUnidadeImportacao';

const unidades = [
  { id: 'a1', nome: 'Unidade Centro', contratante_nome: 'Rede Alfa' },
  { id: 'b1', nome: 'Unidade Centro', contratante_nome: 'Rede Beta' },
  { id: 'b2', nome: 'UBS São José', contratante_nome: 'Rede Beta' },
];

describe('encontrarUnidadeImportacao', () => {
  it('com a rede, acha a unidade certa mesmo com nome repetido em outra rede', () => {
    expect(encontrarUnidadeImportacao(unidades, 'unidade centro', 'Rede Beta')).toEqual({ id: 'b1' });
    expect(encontrarUnidadeImportacao(unidades, 'Unidade Centro', 'rede alfa')).toEqual({ id: 'a1' });
  });

  it('sem a rede, nome repetido pede a rede', () => {
    expect(encontrarUnidadeImportacao(unidades, 'Unidade Centro')).toEqual({ erro: 'ambigua' });
  });

  it('sem a rede, nome único funciona (ignora acentos e maiúsculas)', () => {
    expect(encontrarUnidadeImportacao(unidades, 'ubs sao jose')).toEqual({ id: 'b2' });
  });

  it('rede inexistente e unidade inexistente', () => {
    expect(encontrarUnidadeImportacao(unidades, 'Unidade Centro', 'Rede Gama')).toEqual({ erro: 'redeNaoEncontrada' });
    expect(encontrarUnidadeImportacao(unidades, 'UBS São José', 'Rede Alfa')).toEqual({ erro: 'naoEncontrada' });
  });
});

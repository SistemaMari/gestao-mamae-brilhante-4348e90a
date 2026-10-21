import { describe, it, expect } from 'vitest';
import {
  conferirVariaveis,
  validarTraducoes,
  variaveisDoTexto,
} from '../../supabase/functions/_shared/traducaoLaudo.ts';

const PT = 'Iniciar insulina na dose de [dose total de insulina]: [dose manhã] pela manhã e [dose noite] às 22h. Retorno em [data do próximo retorno].';
const EN = 'Start insulin at a dose of [dose total de insulina]: [dose manhã] in the morning and [dose noite] at 10 p.m. Follow-up on [data do próximo retorno].';
const ES = 'Iniciar insulina a una dosis de [dose total de insulina]: [dose manhã] por la mañana y [dose noite] a las 22 h. Control el [data do próximo retorno].';

describe('variaveisDoTexto', () => {
  it('lista as variáveis com repetição', () => {
    expect(variaveisDoTexto('[IG] e [IG] e [% na meta]')).toEqual(['% na meta', 'IG', 'IG']);
  });
});

describe('conferirVariaveis', () => {
  it('aceita tradução com as mesmas variáveis', () => {
    expect(conferirVariaveis(PT, EN)).toEqual({ faltando: [], sobrando: [] });
  });

  it('acusa variável traduzida (some a original e aparece outra)', () => {
    const r = conferirVariaveis(PT, EN.replace('[dose manhã]', '[morning dose]'));
    expect(r.faltando).toEqual(['dose manhã']);
    expect(r.sobrando).toEqual(['morning dose']);
  });

  it('acusa variável que aparece menos vezes que no original', () => {
    const r = conferirVariaveis('[IG] ... [IG]', '[IG] ...');
    expect(r.faltando).toEqual(['IG']);
  });
});

describe('validarTraducoes', () => {
  it('devolve as duas traduções quando estão corretas', () => {
    const r = validarTraducoes(PT, { en: { titulo: 'Recommended Management', texto: EN }, es: { titulo: 'Conducta', texto: ES } });
    expect(r['en-US'].texto).toBe(EN);
    expect(r.es.titulo).toBe('Conducta');
  });

  it('recusa quando alguma língua alterou variáveis', () => {
    expect(() =>
      validarTraducoes(PT, { en: { titulo: '', texto: EN }, es: { titulo: '', texto: ES.replace('[dose noite]', '') } }),
    ).toThrow(/es sem \[dose noite\]/);
  });

  it('recusa resposta sem texto', () => {
    expect(() => validarTraducoes(PT, { en: { titulo: '', texto: '' }, es: { titulo: '', texto: ES } })).toThrow();
  });
});

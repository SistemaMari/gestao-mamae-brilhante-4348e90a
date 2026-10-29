import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { useLaudoTextos } from './useLaudoTextos';

const bloco = (texto: string) => ({ bloco: 'b1', ordem_bloco: 1, titulo_bloco: null, texto, versao: 1 });

/**
 * "Editar valores" muda o desfecho da MESMA consulta (ex.: adequado →
 * inadequado). O laudo tem que acompanhar — antes o dedupe era só por
 * consulta e o texto do primeiro resultado ficava na tela.
 */
describe('useLaudoTextos — dedupe por desfecho', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation((_fn: string, { body }: { body: { desfecho_clinico: string } }) =>
      Promise.resolve({ data: { completo: true, textos: [bloco(`texto ${body.desfecho_clinico}`)] }, error: null }),
    );
  });

  it('mesmo desfecho não refaz a busca', async () => {
    const { result } = renderHook(() => useLaudoTextos({ isPreview: false }));
    act(() => result.current.garantir('c1', 'ficha_a', 'r1_manter'));
    await waitFor(() => expect(result.current.getEstado('c1').status).toBe('completo'));
    act(() => result.current.garantir('c1', 'ficha_a', 'r1_manter'));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('desfecho novo na mesma consulta busca o texto novo', async () => {
    const { result } = renderHook(() => useLaudoTextos({ isPreview: false }));
    act(() => result.current.garantir('c1', 'ficha_a', 'r1_manter'));
    await waitFor(() => expect(result.current.getEstado('c1').textos[0]?.texto).toBe('texto r1_manter'));

    act(() => result.current.garantir('c1', 'ficha_a', 'r2_insulina'));
    await waitFor(() => expect(result.current.getEstado('c1').textos[0]?.texto).toBe('texto r2_insulina'));
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

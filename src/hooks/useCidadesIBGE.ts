import { useMemo } from 'react';
import { countries } from '@/data/locationData';
import { CIDADES_POR_UF } from '@/data/cidadesIBGE';

function fallbackCidades(pais: string, uf: string): string[] {
  const country = countries.find((c) => c.value === pais);
  const state = country?.states.find((s) => s.value === uf);
  return state?.cities || [];
}

/**
 * Retorna a lista de cidades para um par país/UF.
 * Para Brasil, usa lista estática completa do IBGE (src/data/cidadesIBGE.ts).
 * Para outros países, usa o fallback estático em locationData.ts.
 *
 * Mantém a assinatura { cidades, loading, erro } por compatibilidade.
 */
export function useCidadesIBGE(pais: string, uf: string) {
  const cidades = useMemo(() => {
    if (!uf) return [];
    if (pais === 'Brasil') return CIDADES_POR_UF[uf] || [];
    return fallbackCidades(pais, uf);
  }, [pais, uf]);

  return { cidades, loading: false, erro: null as string | null };
}

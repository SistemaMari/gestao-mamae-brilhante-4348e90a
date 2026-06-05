/**
 * 34C-B — Fonte ÚNICA de IG no frontend.
 *
 * Toda exibição de idade gestacional (IG) deve passar por aqui. A função
 * SQL `public.calcular_ig(p_paciente_id, p_data_alvo)` é a fonte única e
 * lê a âncora vigente da paciente (DUM ou `referencia_usg_id`). Quando a
 * âncora muda, todas as IGs (fichas anteriores e posteriores) refletem a
 * nova âncora — automaticamente.
 *
 * NUNCA use `new Date()` para calcular IG. A `data_alvo` é SEMPRE a data
 * da consulta/exame que está sendo exibido — nunca "hoje".
 *
 * Para "IG de hoje" (ex.: cards de USG em UsgManagerCard/UsgFlowSection
 * que ajudam o clínico a *escolher* qual USG vira âncora), use as helpers
 * legadas `calcIgHojeFromDum`/`calcIgHojeFromUsg` de `fichaUtils.ts` —
 * elas exibem "IG hoje" como ferramenta de UI, não como IG da consulta.
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type IgCalculada = {
  semanas: number;
  dias: number;
  origem: string;     // 'DUM' | 'USG #N'
  base_data: string;  // 'YYYY-MM-DD'
};

/** Resultado plano do RPC `calcular_ig`. */
async function callCalcularIg(
  pacienteId: string,
  dataAlvo: string,
): Promise<IgCalculada | null> {
  const { data, error } = await supabase.rpc('calcular_ig', {
    p_paciente_id: pacienteId,
    p_data_alvo: dataAlvo,
  });
  if (error) {
    console.warn('[getIg] RPC error:', error.message, { pacienteId, dataAlvo });
    return null;
  }
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha || linha.semanas == null) return null;
  return {
    semanas: Number(linha.semanas),
    dias: Number(linha.dias),
    origem: String(linha.origem),
    base_data: String(linha.base_data),
  };
}

/**
 * Versão imperativa — para código fora do React (ex.: exportação Excel).
 * Retorna `null` quando a paciente não tem âncora definida (sem fallback
 * silencioso). Quem chama decide como exibir o estado "sem âncora".
 */
export async function getIg(
  pacienteId: string | null | undefined,
  dataAlvo: string | null | undefined,
): Promise<IgCalculada | null> {
  if (!pacienteId || !dataAlvo) return null;
  return callCalcularIg(pacienteId, dataAlvo);
}

/** Versão em lote — para listagens (Dashboard, FichasUnidade, Excel). */
export async function getIgBatch(
  items: ReadonlyArray<{ pacienteId: string | null | undefined; dataAlvo: string | null | undefined; key: string }>,
): Promise<Map<string, IgCalculada | null>> {
  const results = await Promise.all(
    items.map(async (it) => [it.key, await getIg(it.pacienteId, it.dataAlvo)] as const),
  );
  return new Map(results);
}

/**
 * Hook React — única forma de pegar IG dentro de componentes.
 * - Retorna `data: null` quando a paciente não tem âncora ou quando
 *   `pacienteId`/`dataAlvo` ainda não estão prontos.
 * - Cache de 5min: a IG só muda quando a âncora muda; reabrir a mesma
 *   ficha não recalcula.
 */
export function useIg(
  pacienteId: string | null | undefined,
  dataAlvo: string | null | undefined,
) {
  return useQuery({
    queryKey: ['ig', pacienteId, dataAlvo],
    queryFn: () => callCalcularIg(pacienteId as string, dataAlvo as string),
    enabled: !!pacienteId && !!dataAlvo,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook batch — para listagens. Retorna `Map<key, IgCalculada | null>`.
 * - Cada paciente/data é uma query independente (cacheada
 *   individualmente — se uma paciente abrir e fechar, o cache é
 *   reaproveitado).
 * - `isLoading` é `true` enquanto qualquer query está carregando.
 */
export function useIgBatch(
  items: ReadonlyArray<{ pacienteId: string | null | undefined; dataAlvo: string | null | undefined; key: string }>,
) {
  const queries = useQueries({
    queries: items.map((it) => ({
      queryKey: ['ig', it.pacienteId, it.dataAlvo],
      queryFn: () => callCalcularIg(it.pacienteId as string, it.dataAlvo as string),
      enabled: !!it.pacienteId && !!it.dataAlvo,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const map = new Map<string, IgCalculada | null>();
  items.forEach((it, idx) => {
    map.set(it.key, (queries[idx]?.data as IgCalculada | null) ?? null);
  });
  return {
    igs: map,
    isLoading: queries.some((q) => q.isLoading),
  };
}

/**
 * Formatação padrão de IG para exibição.
 * - Com âncora: "28s 3d" (curto, para tabelas) ou "28s 3d (USG #1)" (com origem)
 * - Sem âncora: "—" (NÃO mostrar "0s 0d", que parece valor real)
 */
export function formatIg(
  ig: IgCalculada | null | undefined,
  opts: { showOrigem?: boolean } = {},
): string {
  if (!ig) return '—';
  const base = `${ig.semanas}s ${ig.dias}d`;
  return opts.showOrigem && ig.origem ? `${base} (${ig.origem})` : base;
}

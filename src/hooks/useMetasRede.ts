// Metas da rede: leitura (tabela metas_rede, protegida por RLS), gravação
// (RPCs definir_meta_rede / remover_meta_rede) e indicadores por unidade
// (RPC get_linha_cuidado_por_unidade_gestor_geral). Vitrine: dados fictícios.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import {
  agruparMetas,
  type IndicadorMeta,
  type LinhaCuidadoPorUnidade,
  type MetasRede,
} from "@/lib/metas";
import { mockLinhaCuidadoPorUnidade } from "@/lib/mockLinhaCuidado";

/** Rede fictícia das rotas /vitrine. */
export const VITRINE_REDE_ID = "vitrine-rede";
export const METAS_VITRINE: MetasRede = {
  diag_antes_28s_pct: 85,
  perda_seguimento_pct: 10,
  perfil_completo_pct: 75,
  ultimo_na_meta_pct: 70,
  gj_gtt_mediana_dias: 60,
};

const useIsVitrine = () => useLocation().pathname.startsWith("/vitrine");

/** Metas das redes pedidas: { [contratante_id]: { indicador: valor } }. */
export function useMetasRedes(redeIds: (string | null | undefined)[]) {
  const isVitrine = useIsVitrine();
  const ids = Array.from(new Set(redeIds.filter((r): r is string => !!r))).sort();
  return useQuery({
    queryKey: ["metas-rede", ids.join(","), isVitrine],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, MetasRede>> => {
      if (isVitrine) return { [VITRINE_REDE_ID]: { ...METAS_VITRINE } };
      const { data, error } = await supabase
        .from("metas_rede")
        .select("contratante_id, indicador, valor")
        .in("contratante_id", ids);
      if (error) throw error;
      return agruparMetas(data);
    },
    staleTime: 60_000,
  });
}

export interface AlteracaoMeta {
  indicador: IndicadorMeta;
  /** null = remover a meta (indicador fica sem selo). */
  valor: number | null;
}

/** Grava as alterações de UMA rede (uma chamada por indicador alterado). */
export function useSalvarMetasRede() {
  const qc = useQueryClient();
  const isVitrine = useIsVitrine();
  return useMutation({
    mutationFn: async ({ redeId, alteracoes }: { redeId: string; alteracoes: AlteracaoMeta[] }) => {
      if (isVitrine) return;
      for (const a of alteracoes) {
        const { error } =
          a.valor == null
            ? await supabase.rpc("remover_meta_rede", { p_contratante_id: redeId, p_indicador: a.indicador })
            : await supabase.rpc("definir_meta_rede", {
                p_contratante_id: redeId,
                p_indicador: a.indicador,
                p_valor: a.valor,
              });
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["metas-rede"] }),
  });
}

/** Indicadores da linha de cuidado, uma linha por unidade (filtros globais do gestor geral). */
export function useLinhaCuidadoPorUnidade() {
  const isVitrine = useIsVitrine();
  const { filtros, unidadesEfetivas, semSelecao, unidades } = useFiltrosGestorGeral();
  const unidadesKey = unidadesEfetivas === null ? "_all" : [...unidadesEfetivas].sort().join(",") || "_none";
  return useQuery({
    queryKey: ["painel-gg", "linha-cuidado-por-unidade", filtros.dataInicio, filtros.dataFim, unidadesKey, isVitrine],
    enabled: !semSelecao,
    queryFn: async (): Promise<LinhaCuidadoPorUnidade[]> => {
      const periodo = { inicio: filtros.dataInicio, fim: filtros.dataFim };
      if (isVitrine) {
        const sel = unidadesEfetivas === null ? unidades : unidades.filter((u) => unidadesEfetivas.includes(u.id));
        return mockLinhaCuidadoPorUnidade(periodo, sel);
      }
      const { data, error } = await supabase.rpc("get_linha_cuidado_por_unidade_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return (data as unknown as LinhaCuidadoPorUnidade[]) ?? [];
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

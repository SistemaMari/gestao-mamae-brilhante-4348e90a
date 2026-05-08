import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";

// ============================================================
// Tipos
// ============================================================

export interface VisaoGeralRow {
  unidade_id: string;
  unidade_nome: string;
  gestor_nome: string | null;
  pacientes_ativos: number;
  laudos_emitidos: number;
  partos_registrados: number;
  profissionais_ativos: number;
  taxa_dmg_positivo_pct: number;
}

export interface ConsolidadorOperacao {
  gestantes_ativas: number;
  laudos_emitidos: number;
  exames_realizados: number;
  partos_registrados: number;
  profissionais_ativos: number;
}

export interface IgObj {
  semanas: number;
  dias: number;
  total_dias: number;
}

export interface ConsolidadorPerfilClinico {
  taxa_dmg_positivo_pct: number;
  total_diagnosticos_no_calculo: number;
  ig_media_diagnostico: IgObj | null;
  tempo_medio_dum_diagnostico: IgObj | null;
  tempo_medio_fechamento_dias: number | null;
}

export interface ConsolidadorGargalos {
  sem_gj_primeira_consulta: { count: number; label: string; severidade: string };
  atrasadas_gtt: { count: number; label: string; severidade: string };
  confirmadas_sem_retorno: { count: number; label: string; severidade: string };
}

export interface TendenciaPonto {
  mes_referencia: string;
  mes_label: string;
  total_gestantes: number;
  total_dmg_confirmadas: number;
  prevalencia_pct: number;
}

// ============================================================
// Helpers
// ============================================================

function buildKey(prefix: string[], unidades: string[] | null, dataInicio?: string, dataFim?: string) {
  const u = unidades === null ? "_all" : [...unidades].sort().join(",") || "_none";
  return [...prefix, dataInicio ?? "", dataFim ?? "", u];
}

// ============================================================
// Aba 1 — Visão Geral
// ============================================================

export function useVisaoGeralRede() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "visao-geral"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<VisaoGeralRow[]> => {
      const { data, error } = await supabase.rpc("get_visao_geral_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as VisaoGeralRow[];
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

// ============================================================
// Aba 2 — Consolidador (4 sub-blocos)
// ============================================================

export function useConsolidadorOperacao() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "cons-op"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<ConsolidadorOperacao> => {
      const { data, error } = await supabase.rpc("get_consolidador_operacao_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as ConsolidadorOperacao;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useConsolidadorPerfilClinico() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "cons-perfil"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<ConsolidadorPerfilClinico> => {
      const { data, error } = await supabase.rpc("get_consolidador_perfil_clinico_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as ConsolidadorPerfilClinico;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useConsolidadorGargalos() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(
      ["painel-gg", "cons-gargalos"],
      unidadesEfetivas,
      filtros.dataInicio,
      filtros.dataFim,
    ),
    enabled: !semSelecao,
    queryFn: async (): Promise<ConsolidadorGargalos> => {
      const { data, error } = await supabase.rpc("get_consolidador_gargalos_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as ConsolidadorGargalos;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useConsolidadorTendencia() {
  const { unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "cons-tendencia"], unidadesEfetivas),
    enabled: !semSelecao,
    queryFn: async (): Promise<TendenciaPonto[]> => {
      const { data, error } = await supabase.rpc("get_consolidador_tendencia_gestor_geral", {
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as TendenciaPonto[];
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

// ============================================================
// Aba 3 — Diagnóstico (KPIs / Ranking / Alertas) — reaproveita 17C-A
// ============================================================

export interface KpisPayload {
  periodo: { inicio: string; fim: string };
  unidades_total: number;
  totais: {
    pacientes_ativos: number;
    laudos_emitidos: number;
    taxa_dmg_positivo_pct: number;
    partos_registrados: number;
    profissionais_ativos: number;
  };
  variacao_periodo_anterior: {
    pacientes_ativos_pct: number | null;
    laudos_emitidos_pct: number | null;
    taxa_dmg_positivo_delta: number | null;
  };
}

export type StatusOperacional = "ativa" | "atencao" | "inativa" | "nao_iniciada";

export interface RankingUnidade {
  unidade_id: string;
  unidade_nome: string;
  pacientes_ativos: number | null;
  laudos_emitidos: number | null;
  taxa_dmg_positivo_pct: number | null;
  tempo_medio_fechamento_dias: number | null;
  profissionais_ativos?: number | null;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  status_operacional: StatusOperacional | string;
}

export interface Alerta {
  alerta_id: string;
  unidade_id: string;
  unidade_nome: string;
  tipo: string;
  severidade: "alta" | "media" | string;
  mensagem: string;
  detalhe_numerico: number | null;
}

export function useDiagnosticoKpis() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "kpis"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<KpisPayload> => {
      const { data, error } = await supabase.rpc("get_metricas_consolidadas_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as KpisPayload;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useDiagnosticoRanking() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "ranking"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<RankingUnidade[]> => {
      const { data, error } = await supabase.rpc("get_ranking_unidades_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as RankingUnidade[];
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useDiagnosticoAlertas() {
  const { unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "alertas"], unidadesEfetivas),
    enabled: !semSelecao,
    queryFn: async (): Promise<Alerta[]> => {
      const { data, error } = await supabase.rpc("get_alertas_gestor_geral", {
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as Alerta[];
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

// ============================================================
// Top destaques (Aba 3)
// ============================================================

export interface TopDestaque {
  unidade_id: string;
  unidade_nome: string;
  diagnosticos: number;
}
export interface TopDestaquesPayload {
  mais: TopDestaque | null;
  menos: TopDestaque | null;
}

export function useTopDestaques() {
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  return useQuery({
    queryKey: buildKey(["painel-gg", "top-destaques"], unidadesEfetivas, filtros.dataInicio, filtros.dataFim),
    enabled: !semSelecao,
    queryFn: async (): Promise<TopDestaquesPayload> => {
      const { data, error } = await supabase.rpc("get_top_destaques_gestor_geral", {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as TopDestaquesPayload;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });
}

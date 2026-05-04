// Cliente da Edge Function `admin-metrics` (Prompt 23A).
// Whitelist local — espelha exatamente os 8 slugs aceitos pela função.
import { supabase } from "@/integrations/supabase/client";

export type AdminViewSlug =
  | "resumo_global"
  | "distribuicao_geografica"
  | "top_cidades"
  | "unidades_resumo"
  | "profissionais_por_plano"
  | "evolucao_mensal_planos"
  | "evolucao_mensal_profissionais"
  | "alertas_operacionais";

export const ADMIN_VIEWS: AdminViewSlug[] = [
  "resumo_global",
  "distribuicao_geografica",
  "top_cidades",
  "unidades_resumo",
  "profissionais_por_plano",
  "evolucao_mensal_planos",
  "evolucao_mensal_profissionais",
  "alertas_operacionais",
];

export interface ResumoGlobalRow {
  singleton: number;
  total_profissionais: number;
  total_unidades: number;
  total_gestores_gerais: number;
  total_consolidacoes: number;
  atualizado_em: string;
}

export interface GeoRow {
  pais: string;
  estado: string;
  cidade: string;
  total_profissionais: number;
  total_unidades: number;
}

export interface CidadeRow {
  posicao: number;
  pais: string;
  estado: string;
  cidade: string;
  total_profissionais: number;
}

export interface UnidadeResumoRow {
  unidade_id: string;
  nome: string;
  tipo: string | null;
  pais: string;
  estado: string;
  cidade: string;
  ativa: boolean;
  total_profissionais: number;
  total_pacientes: number;
  total_laudos: number;
}

export interface PlanoRow {
  plano_id: string;
  plano_slug: string;
  plano_nome: string;
  preco_mensal: number | null;
  ordem: number | null;
  total: number;
  ativos_30d: number;
}

export interface EvolucaoPlanosRow {
  mes: string;
  plano_id: string;
  plano_slug: string;
  plano_nome: string;
  novos: number;
}

export interface EvolucaoProfissionaisRow {
  mes: string;
  novos_profissionais: number;
  profissionais_ativos: number;
}

export type EvolucaoRow = EvolucaoProfissionaisRow | EvolucaoPlanosRow;

export type TipoAlerta =
  | "profissional_inativo_30d"
  | "intermediaria_inativo_30d"
  | "inicial_inativo_30d"
  | "unidade_dormente"
  | "onboarding_travado";

export interface AlertaRow {
  tipo_alerta: TipoAlerta | string;
  total: number;
}

export interface FetchAdminViewParams {
  pais?: string;
}

export interface AdminViewResponse<T> {
  view: AdminViewSlug;
  rows: T[];
  count: number;
}

export class AdminMetricsAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AdminMetricsAuthError";
  }
}

export async function fetchAdminView<T>(
  view: AdminViewSlug,
  params?: FetchAdminViewParams,
): Promise<T[]> {
  if (!ADMIN_VIEWS.includes(view)) {
    throw new Error(`View não permitida: ${view}`);
  }
  const body: Record<string, unknown> = { view };
  if (params?.pais) body.pais = params.pais;

  const { data, error } = await supabase.functions.invoke<AdminViewResponse<T>>(
    "admin-metrics",
    { body },
  );

  if (error) {
    // supabase-js coloca status HTTP em error.context.status quando disponível
    const status = (error as any)?.context?.status ?? 0;
    if (status === 401 || status === 403) {
      throw new AdminMetricsAuthError(status, error.message);
    }
    throw error;
  }
  return data?.rows ?? [];
}

// Tipos compartilhados das 4 RPCs do painel estratégico do gestor de unidade.

export interface PainelOperacao {
  gestantes_ativas: number;
  laudos_30d: number;
  /** Laudos no período do filtro (= laudos_30d quando chamada sem período). */
  laudos_periodo?: number;
  periodo?: { inicio: string; fim: string } | null;
  distribuicao_profissionais: Array<{
    profissional_id: string;
    nome: string;
    total_pacientes_ativos: number;
  }>;
}

export interface PainelPerfilClinico {
  /** 'periodo' = gestantes rastreadas no período do filtro; 'dum_280d' = regra sem período (DUM em 280 dias). */
  base?: 'periodo' | 'dum_280d';
  periodo?: { inicio: string; fim: string } | null;
  total_acompanhadas: number;
  total_dmg_confirmadas: number;
  prevalencia_pct: number;
  /** Overt (diabetes prévio, cenário 8) — à parte da prevalência, como no admin. */
  total_overt?: number;
  benchmark_min_pct: number;
  benchmark_max_pct: number;
  em_insulina: number;
  em_insulina_pct: number;
  dmg_anterior: number;
  dmg_anterior_pct: number;
  ig_media_diagnostico_dias: number | null;
}

export interface PainelGargalos {
  sem_gj_primeira_consulta: { count: number; paciente_ids: string[] };
  atrasadas_gtt: { count: number; paciente_ids: string[] };
  confirmadas_sem_retorno: { count: number; paciente_ids: string[] };
}

export type PainelTendencia = Array<{
  mes_referencia: string;
  mes_label: string;
  total_gestantes: number;
  total_dmg_confirmadas: number;
  prevalencia_pct: number;
}>;

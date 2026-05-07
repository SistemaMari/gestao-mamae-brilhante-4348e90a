// Dados de vitrine para /vitrine/gestao — painel estratégico do gestor.
import type {
  PainelOperacao,
  PainelPerfilClinico,
  PainelGargalos,
  PainelTendencia,
} from './painelEstrategicoTypes';

export const mockOperacao: PainelOperacao = {
  gestantes_ativas: 23,
  laudos_30d: 47,
  distribuicao_profissionais: [
    { profissional_id: 'p1', nome: 'Dra. Ana Souza', total_pacientes_ativos: 9 },
    { profissional_id: 'p2', nome: 'Dr. Carlos Lima', total_pacientes_ativos: 6 },
    { profissional_id: 'p3', nome: 'Dra. Bia Mello', total_pacientes_ativos: 5 },
    { profissional_id: 'p4', nome: 'Dr. Diego Reis', total_pacientes_ativos: 3 },
  ],
};

export const mockPerfilClinico: PainelPerfilClinico = {
  total_acompanhadas: 23,
  total_dmg_confirmadas: 4,
  prevalencia_pct: 17.4,
  benchmark_min_pct: 7.0,
  benchmark_max_pct: 18.0,
  em_insulina: 2,
  em_insulina_pct: 50.0,
  dmg_anterior: 3,
  dmg_anterior_pct: 13.0,
  ig_media_diagnostico_dias: 188, // ~26+6
};

export const mockGargalos: PainelGargalos = {
  sem_gj_primeira_consulta: { count: 2, paciente_ids: ['demo-a1', 'demo-a2'] },
  atrasadas_gtt: { count: 1, paciente_ids: ['demo-b1'] },
  confirmadas_sem_retorno: { count: 1, paciente_ids: ['demo-c1'] },
};

export const mockTendencia: PainelTendencia = [
  { mes_referencia: '2025-12-01', mes_label: 'Dez/25', total_gestantes: 19, total_dmg_confirmadas: 2, prevalencia_pct: 10.5 },
  { mes_referencia: '2026-01-01', mes_label: 'Jan/26', total_gestantes: 20, total_dmg_confirmadas: 2, prevalencia_pct: 10.0 },
  { mes_referencia: '2026-02-01', mes_label: 'Fev/26', total_gestantes: 21, total_dmg_confirmadas: 3, prevalencia_pct: 14.3 },
  { mes_referencia: '2026-03-01', mes_label: 'Mar/26', total_gestantes: 22, total_dmg_confirmadas: 3, prevalencia_pct: 13.6 },
  { mes_referencia: '2026-04-01', mes_label: 'Abr/26', total_gestantes: 23, total_dmg_confirmadas: 4, prevalencia_pct: 17.4 },
  { mes_referencia: '2026-05-01', mes_label: 'Mai/26', total_gestantes: 23, total_dmg_confirmadas: 4, prevalencia_pct: 17.4 },
];

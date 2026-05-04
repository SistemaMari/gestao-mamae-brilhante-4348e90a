// Mock de demonstração da vitrine pública (/vitrine/admin).
// Espelha as 8 views materializadas expostas pela Edge Function `admin-metrics`:
//   resumo_global, distribuicao_geografica, top_cidades, unidades_resumo,
//   profissionais_por_plano, evolucao_mensal_planos,
//   evolucao_mensal_profissionais, alertas_operacionais
// Schema base: Prompt 23A (migration 20260504131223). Atualizar se Lucas
// alterar colunas de qualquer MV.
import type {
  ResumoGlobalRow,
  GeoRow,
  CidadeRow,
  UnidadeResumoRow,
  PlanoRow,
  EvolucaoPlanosRow,
  EvolucaoProfissionaisRow,
  AlertaRow,
} from "./adminMetrics";

const MESES_12 = (() => {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
})();

export const mockResumoGlobal: ResumoGlobalRow[] = [
  {
    singleton: 1,
    total_profissionais: 84,
    total_unidades: 12,
    total_gestores_gerais: 4,
    total_consolidacoes: 9,
    atualizado_em: new Date().toISOString(),
  },
];

export const mockDistribuicaoGeografica: GeoRow[] = [
  { pais: "Brasil", estado: "SP", cidade: "São Paulo", total_profissionais: 28, total_unidades: 4 },
  { pais: "Brasil", estado: "SP", cidade: "Campinas", total_profissionais: 9, total_unidades: 1 },
  { pais: "Brasil", estado: "RJ", cidade: "Rio de Janeiro", total_profissionais: 14, total_unidades: 2 },
  { pais: "Brasil", estado: "MG", cidade: "Belo Horizonte", total_profissionais: 11, total_unidades: 2 },
  { pais: "Brasil", estado: "RS", cidade: "Porto Alegre", total_profissionais: 7, total_unidades: 1 },
  { pais: "Brasil", estado: "PR", cidade: "Curitiba", total_profissionais: 6, total_unidades: 1 },
  { pais: "Brasil", estado: "BA", cidade: "Salvador", total_profissionais: 5, total_unidades: 1 },
  { pais: "Portugal", estado: "Lisboa", cidade: "Lisboa", total_profissionais: 4, total_unidades: 0 },
];

export const mockTopCidades: CidadeRow[] = mockDistribuicaoGeografica
  .slice()
  .sort((a, b) => b.total_profissionais - a.total_profissionais)
  .map((r, i) => ({
    posicao: i + 1,
    pais: r.pais,
    estado: r.estado,
    cidade: r.cidade,
    total_profissionais: r.total_profissionais,
  }));

export const mockUnidadesResumo: UnidadeResumoRow[] = [
  { unidade_id: "u1", nome: "Maternidade Vida", tipo: "Hospital", pais: "Brasil", estado: "SP", cidade: "São Paulo", ativa: true,  total_profissionais: 18, total_pacientes: 320, total_laudos: 612 },
  { unidade_id: "u2", nome: "Clínica Mãe & Bebê", tipo: "Clínica", pais: "Brasil", estado: "SP", cidade: "Campinas", ativa: true,  total_profissionais: 9,  total_pacientes: 180, total_laudos: 410 },
  { unidade_id: "u3", nome: "Hospital Aurora", tipo: "Hospital", pais: "Brasil", estado: "RJ", cidade: "Rio de Janeiro", ativa: true,  total_profissionais: 14, total_pacientes: 240, total_laudos: 510 },
  { unidade_id: "u4", nome: "Centro Materno BH", tipo: "Clínica",  pais: "Brasil", estado: "MG", cidade: "Belo Horizonte", ativa: true,  total_profissionais: 11, total_pacientes: 195, total_laudos: 388 },
  { unidade_id: "u5", nome: "Clínica Aconchego", tipo: "Clínica", pais: "Brasil", estado: "RS", cidade: "Porto Alegre", ativa: true,  total_profissionais: 7,  total_pacientes: 120, total_laudos: 250 },
  { unidade_id: "u6", nome: "Unidade Curitiba",  tipo: "Clínica", pais: "Brasil", estado: "PR", cidade: "Curitiba", ativa: true,  total_profissionais: 6,  total_pacientes: 95,  total_laudos: 198 },
  { unidade_id: "u7", nome: "Materna Salvador",  tipo: "Hospital", pais: "Brasil", estado: "BA", cidade: "Salvador", ativa: false, total_profissionais: 5,  total_pacientes: 60,  total_laudos: 132 },
  { unidade_id: "u8", nome: "Clínica Lisboa",    tipo: "Clínica", pais: "Portugal", estado: "Lisboa", cidade: "Lisboa", ativa: true, total_profissionais: 4, total_pacientes: 38, total_laudos: 84 },
];

export const mockProfissionaisPorPlano: PlanoRow[] = [
  { plano_id: "p1", plano_slug: "inicial",       plano_nome: "Inicial",       preco_mensal: 0,    ordem: 1, total: 32, ativos_30d: 18 },
  { plano_id: "p2", plano_slug: "intermediaria", plano_nome: "Intermediária", preco_mensal: 199,  ordem: 2, total: 28, ativos_30d: 22 },
  { plano_id: "p3", plano_slug: "profissional",  plano_nome: "Profissional",  preco_mensal: 399,  ordem: 3, total: 24, ativos_30d: 21 },
];

export const mockEvolucaoMensalProfissionais: EvolucaoProfissionaisRow[] = MESES_12.map((mes, i) => ({
  mes,
  novos_profissionais: 4 + Math.round(Math.sin(i / 2) * 2 + i / 3),
  profissionais_ativos: 35 + i * 3,
}));

export const mockEvolucaoMensalPlanos: EvolucaoPlanosRow[] = MESES_12.flatMap((mes, i) =>
  mockProfissionaisPorPlano.map((pl, j) => ({
    mes,
    plano_id: pl.plano_id,
    plano_slug: pl.plano_slug,
    plano_nome: pl.plano_nome,
    novos: Math.max(0, Math.round(2 + j + Math.cos((i + j) / 2))),
  })),
);

export const mockAlertasOperacionais: AlertaRow[] = [
  { tipo_alerta: "profissional_inativo_30d",  total: 3 },
  { tipo_alerta: "intermediaria_inativo_30d", total: 6 },
  { tipo_alerta: "inicial_inativo_30d",       total: 14 },
  { tipo_alerta: "unidade_dormente",          total: 1 },
  { tipo_alerta: "onboarding_travado",        total: 2 },
];

export const MOCK_ADMIN: Record<string, unknown[]> = {
  resumo_global: mockResumoGlobal,
  distribuicao_geografica: mockDistribuicaoGeografica,
  top_cidades: mockTopCidades,
  unidades_resumo: mockUnidadesResumo,
  profissionais_por_plano: mockProfissionaisPorPlano,
  evolucao_mensal_planos: mockEvolucaoMensalPlanos,
  evolucao_mensal_profissionais: mockEvolucaoMensalProfissionais,
  alertas_operacionais: mockAlertasOperacionais,
};

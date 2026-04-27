export interface PreviewConsulta {
  id: string;
  tipo: string;
  numero_sequencial: number;
  data: string;
  ig_semanas: number | null;
  ig_dias: number | null;
  observacoes: string | null;
  status_gerado: string | null;
  // Ficha A/C profile data (optional)
  percentual_meta?: number | null;
  total_preenchidos?: number | null;
  dentro_meta?: number | null;
  peso_kg?: number | null;
  dose_total?: number | null;
  dose_manha?: number | null;
  dose_noite?: number | null;
  retorno_dias?: number | null;
  data_proximo_retorno_formatted?: string | null;
  grid_valores?: Record<string, string>[] | null;
  decisao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  // GTT 75g data (optional)
  gtt_jejum?: number | null;
  gtt_1h?: number | null;
  gtt_2h?: number | null;
  gtt_recurso_limitado?: boolean | null;
  gtt_data_exame?: string | null;
  cenario_clinico?: string | null;
  // Retorno 1 data (optional — for editing)
  retorno1_valor_gj?: number | null;
  retorno1_tipo_exame?: string | null;
  retorno1_data_exame?: string | null;
}

export interface PreviewPaciente {
  id: string;
  nome: string;
  data_nascimento: string | null;
  numero_identificacao: string | null;
  tipo_identificacao: string | null;
  dum: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  usg_data: string | null;
  usg_ig_semanas: number | null;
  usg_ig_dias: number | null;
  status_ficha: string;
  dmg_gestacao_anterior: boolean | null;
  data_ultima_consulta: string | null;
  data_proximo_retorno: string | null;
  tipo_retorno: string | null;
  consultas: PreviewConsulta[];
}

const STORAGE_KEY = 'dramari_preview_pacientes_v5';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function formatLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalISO(d);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return formatLocalISO(d);
}

const SEED_PATIENTS: PreviewPaciente[] = [
  {
    id: 'demo-1',
    nome: 'Maria Luísa Ferreira',
    data_nascimento: '1995-03-15',
    numero_identificacao: '123.456.789-00',
    tipo_identificacao: 'cpf',
    dum: daysAgo(84),
    pais: 'Brasil',
    estado: 'SP',
    cidade: 'São Paulo',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'aguardando_gj',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(3),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c1-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(3), ig_semanas: 12, ig_dias: 0, observacoes: 'Primeira consulta. Paciente sem queixas.', status_gerado: 'aguardando_gj' },
    ],
  },
  {
    id: 'demo-2',
    nome: 'Ana Carolina Souza',
    data_nascimento: '1990-07-22',
    numero_identificacao: '87654321',
    tipo_identificacao: 'prontuario',
    dum: daysAgo(140),
    pais: 'Brasil',
    estado: 'RJ',
    cidade: 'Rio de Janeiro',
    usg_data: daysAgo(56),
    usg_ig_semanas: 12,
    usg_ig_dias: 3,
    status_ficha: 'aguardando_gtt',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(7),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c2-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(60), ig_semanas: null, ig_dias: null, observacoes: 'Primeira gestação. Sem comorbidades. PA 110/70.', status_gerado: 'aguardando_gj' },
      { id: 'c2-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(7), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 78 mg/dL — resultado normal. Solicitar GTT 75g na janela de 24-28 semanas.', status_gerado: 'aguardando_gtt' },
    ],
  },
  {
    id: 'demo-3',
    nome: 'Juliana de Oliveira',
    data_nascimento: '1988-11-05',
    numero_identificacao: '33445566',
    tipo_identificacao: 'prontuario',
    dum: daysAgo(210),
    pais: 'Brasil',
    estado: 'MG',
    cidade: 'Belo Horizonte',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'dmg_afastado',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(14),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c3-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(120), ig_semanas: null, ig_dias: null, observacoes: 'Terceira gestação. Sem histórico de DMG. IMC 24.', status_gerado: 'aguardando_gj' },
      { id: 'c3-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(90), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 81 mg/dL — normal. Agendar GTT 75g entre 24-28 sem.', status_gerado: 'aguardando_gtt' },
      { id: 'c3-3', tipo: 'retorno', numero_sequencial: 3, data: daysAgo(14), ig_semanas: null, ig_dias: null, observacoes: 'GTT 75g: jejum 79, 1h 138, 2h 120 — todos normais. DMG afastado. Seguir pré-natal habitual.', status_gerado: 'dmg_afastado' },
    ],
  },
  {
    id: 'demo-4',
    nome: 'Patrícia Almeida Santos',
    data_nascimento: '1993-01-30',
    numero_identificacao: '11223344',
    tipo_identificacao: 'cns',
    dum: daysAgo(196),
    pais: 'Brasil',
    estado: 'BA',
    cidade: 'Salvador',
    usg_data: daysAgo(70),
    usg_ig_semanas: 18,
    usg_ig_dias: 2,
    status_ficha: 'dmg_confirmado',
    dmg_gestacao_anterior: true,
    data_ultima_consulta: daysAgo(5),
    data_proximo_retorno: daysFromNow(1),
    tipo_retorno: 'consulta',
    consultas: [
      { id: 'c4-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(100), ig_semanas: null, ig_dias: null, observacoes: 'DMG em gestação anterior (2021). IMC 31. PA 120/80.', status_gerado: 'aguardando_gj' },
      { id: 'c4-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(70), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 95 mg/dL — alterada (≥ 92). DMG confirmado por GJ. Iniciar orientação nutricional e perfil glicêmico.', status_gerado: 'dmg_confirmado' },
      { id: 'c4-3', tipo: 'retorno', numero_sequencial: 3, data: daysAgo(5), ig_semanas: null, ig_dias: null, observacoes: 'Perfil glicêmico: jejum 88, pós-café 125, pós-almoço 118. Controle adequado com dieta. Manter conduta.', status_gerado: 'dmg_confirmado' },
    ],
  },
  {
    id: 'demo-5',
    nome: 'Camila Rodrigues',
    data_nascimento: '1992-06-18',
    numero_identificacao: '987.654.321-00',
    tipo_identificacao: 'cpf',
    dum: daysAgo(224),
    pais: 'Brasil',
    estado: 'RS',
    cidade: 'Porto Alegre',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'dmg_confirmado',
    dmg_gestacao_anterior: true,
    data_ultima_consulta: daysAgo(10),
    data_proximo_retorno: daysAgo(2),
    tipo_retorno: 'consulta',
    consultas: [
      { id: 'c5-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(100), ig_semanas: null, ig_dias: null, observacoes: 'DMG em gestação anterior (2019). Obesidade grau I. PA 130/85.', status_gerado: 'aguardando_gj' },
      { id: 'c5-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(70), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 98 mg/dL — alterada. DMG confirmado. Encaminhar para nutricionista e iniciar perfil glicêmico.', status_gerado: 'dmg_confirmado' },
      { id: 'c5-3', tipo: 'retorno', numero_sequencial: 3, data: daysAgo(10), ig_semanas: null, ig_dias: null, observacoes: 'Perfil glicêmico: jejum 92, pós-café 142, pós-almoço 135. Controle limítrofe. Reforçar dieta, reavaliar em 7 dias.', status_gerado: 'dmg_confirmado' },
    ],
  },
  {
    id: 'demo-6',
    nome: 'Fernanda Costa Lima',
    data_nascimento: '1997-09-12',
    numero_identificacao: '77889900',
    tipo_identificacao: 'prontuario',
    dum: daysAgo(280),
    pais: 'Brasil',
    estado: 'PR',
    cidade: 'Curitiba',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'resultado_parto',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(1),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c6-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(190), ig_semanas: null, ig_dias: null, observacoes: 'Primeira gestação. Sem comorbidades prévias. IMC 26.', status_gerado: 'aguardando_gj' },
      { id: 'c6-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(160), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 88 mg/dL — normal. Agendar GTT 75g entre 24-28 sem.', status_gerado: 'aguardando_gtt' },
      { id: 'c6-3', tipo: 'retorno', numero_sequencial: 3, data: daysAgo(100), ig_semanas: null, ig_dias: null, observacoes: 'GTT 75g: jejum 82, 1h 187, 2h 148 — 1h alterada (≥ 180). DMG confirmado.', status_gerado: 'dmg_confirmado' },
      { id: 'c6-4', tipo: 'retorno', numero_sequencial: 4, data: daysAgo(1), ig_semanas: null, ig_dias: null, observacoes: 'Parto cesáreo em 39+6 sem. RN 3.450g, Apgar 8/9. Sem intercorrências. Alta hospitalar.', status_gerado: 'resultado_parto' },
    ],
  },
  {
    id: 'demo-7',
    nome: 'Beatriz Mendes',
    data_nascimento: '1994-04-25',
    numero_identificacao: '99887766',
    tipo_identificacao: 'cns',
    dum: daysAgo(182),
    pais: 'Brasil',
    estado: 'CE',
    cidade: 'Fortaleza',
    usg_data: daysAgo(42),
    usg_ig_semanas: 20,
    usg_ig_dias: 0,
    status_ficha: 'encaminhada_endocrino',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(2),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c7-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(80), ig_semanas: null, ig_dias: null, observacoes: 'Segunda gestação. Sem DMG anterior. IMC 28. PA 120/75.', status_gerado: 'aguardando_gj' },
      { id: 'c7-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(50), ig_semanas: null, ig_dias: null, observacoes: 'GJ: 101 mg/dL — alterada. DMG confirmado. Iniciar dieta e perfil glicêmico.', status_gerado: 'dmg_confirmado' },
      { id: 'c7-3', tipo: 'retorno', numero_sequencial: 3, data: daysAgo(20), ig_semanas: null, ig_dias: null, observacoes: 'Perfil glicêmico com dieta: jejum 96, pós-café 158, pós-almoço 145. Controle inadequado. Iniciada insulina NPH 10UI noturna.', status_gerado: 'dmg_confirmado' },
      { id: 'c7-4', tipo: 'retorno', numero_sequencial: 4, data: daysAgo(2), ig_semanas: null, ig_dias: null, observacoes: 'Insulina NPH 14UI. Perfil: jejum 94, pós-café 162, pós-almoço 150. Controle inadequado mesmo com insulina. Encaminhar para endocrinologista — acompanhamento compartilhado.', status_gerado: 'encaminhada_endocrino' },
    ],
  },
  // ── Demo 8: Renata — 4 pontos dentro da meta, segue acompanhamento ──
  {
    id: 'demo-8',
    nome: 'Renata Silva Martins',
    data_nascimento: '1991-02-14',
    numero_identificacao: '55667788',
    tipo_identificacao: 'prontuario',
    dum: daysAgo(196),
    pais: 'Brasil',
    estado: 'SP',
    cidade: 'Campinas',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'dmg_confirmado',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(3),
    data_proximo_retorno: daysFromNow(4),
    tipo_retorno: 'consulta',
    consultas: [
      { id: 'c8-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(100), ig_semanas: 14, ig_dias: 0, observacoes: 'Primeira gestação. IMC 27. PA 115/70. Sem comorbidades.', status_gerado: 'aguardando_gj' },
      { id: 'c8-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(70), ig_semanas: 18, ig_dias: 2, observacoes: 'GJ: 93 mg/dL — alterada (≥ 92). DMG confirmado. Iniciar orientação nutricional e perfil glicêmico de 4 pontos.', status_gerado: 'dmg_confirmado' },
      {
        id: 'c8-3', tipo: 'ficha_a', numero_sequencial: 3, data: daysAgo(40), ig_semanas: 22, ig_dias: 4,
        observacoes: 'Perfil glicêmico 4 pontos — 15 dias. Controle adequado com dieta. Manter conduta.',
        status_gerado: 'dmg_confirmado',
        percentual_meta: 80, total_preenchidos: 60, dentro_meta: 48,
        peso_kg: 72, dose_total: null, dose_manha: null, dose_noite: null,
        retorno_dias: 15, data_proximo_retorno_formatted: null,
        decisao: 'controle_adequado',
        data_inicio: daysAgo(55), data_fim: daysAgo(41),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([82, 85, 79, 88, 84, 90, 81, 86, 83, 87, 80, 89, 85, 82, 84][i]),
          pos_cafe: String([115, 120, 125, 118, 130, 112, 122, 119, 128, 116, 121, 124, 117, 123, 120][i]),
          pos_almoco: String([110, 118, 122, 115, 125, 108, 120, 114, 126, 112, 119, 121, 113, 117, 116][i]),
          pos_jantar: String([105, 112, 118, 109, 120, 106, 115, 110, 122, 108, 114, 117, 107, 113, 111][i]),
        })),
      },
      {
        id: 'c8-4', tipo: 'ficha_a', numero_sequencial: 4, data: daysAgo(3), ig_semanas: 27, ig_dias: 5,
        observacoes: 'Segundo perfil 4 pontos — 15 dias. 85% dentro da meta. Controle adequado. Manter dieta.',
        status_gerado: 'dmg_confirmado',
        percentual_meta: 85, total_preenchidos: 60, dentro_meta: 51,
        peso_kg: 73, dose_total: null, dose_manha: null, dose_noite: null,
        retorno_dias: 15, data_proximo_retorno_formatted: null,
        decisao: 'controle_adequado',
        data_inicio: daysAgo(18), data_fim: daysAgo(4),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([80, 83, 78, 85, 82, 88, 79, 84, 81, 86, 77, 87, 83, 80, 82][i]),
          pos_cafe: String([112, 118, 120, 115, 125, 110, 119, 116, 124, 113, 118, 121, 114, 120, 117][i]),
          pos_almoco: String([108, 115, 119, 112, 122, 106, 117, 111, 123, 109, 116, 118, 110, 114, 113][i]),
          pos_jantar: String([102, 110, 115, 107, 118, 104, 113, 108, 120, 106, 112, 114, 105, 111, 109][i]),
        })),
      },
    ],
  },
  // ── Demo 9: Larissa — 4 pontos fora → 6 pontos com insulina dentro ──
  {
    id: 'demo-9',
    nome: 'Larissa Campos Oliveira',
    data_nascimento: '1989-08-03',
    numero_identificacao: '44556677',
    tipo_identificacao: 'prontuario',
    dum: daysAgo(210),
    pais: 'Brasil',
    estado: 'MG',
    cidade: 'Uberlândia',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'dmg_confirmado',
    dmg_gestacao_anterior: false,
    data_ultima_consulta: daysAgo(5),
    data_proximo_retorno: daysFromNow(2),
    tipo_retorno: 'consulta',
    consultas: [
      { id: 'c9-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(110), ig_semanas: 14, ig_dias: 2, observacoes: 'Segunda gestação. IMC 30. PA 125/80.', status_gerado: 'aguardando_gj' },
      { id: 'c9-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(80), ig_semanas: 18, ig_dias: 4, observacoes: 'GJ: 96 mg/dL — alterada. DMG confirmado. Orientação nutricional e perfil glicêmico 4 pontos.', status_gerado: 'dmg_confirmado' },
      {
        id: 'c9-3', tipo: 'ficha_a', numero_sequencial: 3, data: daysAgo(40), ig_semanas: 24, ig_dias: 2,
        observacoes: 'Perfil 4 pontos — 15 dias. 50% dentro da meta. Controle inadequado. Iniciar insulina NPH.',
        status_gerado: 'dmg_confirmado',
        percentual_meta: 50, total_preenchidos: 60, dentro_meta: 30,
        peso_kg: 82, dose_total: 8, dose_manha: 5, dose_noite: 3,
        retorno_dias: 15, data_proximo_retorno_formatted: null,
        decisao: 'controle_inadequado',
        data_inicio: daysAgo(55), data_fim: daysAgo(41),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([95, 98, 102, 91, 105, 97, 100, 93, 108, 96, 103, 99, 94, 101, 97][i]),
          pos_cafe: String([145, 138, 155, 132, 160, 142, 150, 135, 158, 140, 148, 152, 136, 147, 143][i]),
          pos_almoco: String([140, 135, 150, 128, 155, 138, 145, 130, 152, 136, 143, 148, 132, 142, 139][i]),
          pos_jantar: String([135, 130, 145, 125, 150, 133, 140, 127, 148, 131, 138, 143, 128, 137, 134][i]),
        })),
      },
      {
        id: 'c9-4', tipo: 'ficha_b', numero_sequencial: 4, data: daysAgo(5), ig_semanas: 29, ig_dias: 1,
        observacoes: 'Perfil 6 pontos com insulina NPH 10UI — 15 dias. 78% dentro da meta. Controle adequado com insulina. Manter dose.',
        status_gerado: 'dmg_confirmado',
        percentual_meta: 78, total_preenchidos: 90, dentro_meta: 70,
        peso_kg: 81, dose_total: 10, dose_manha: 6, dose_noite: 4,
        retorno_dias: 15, data_proximo_retorno_formatted: null,
        decisao: 'controle_adequado',
        data_inicio: daysAgo(20), data_fim: daysAgo(6),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([85, 88, 82, 90, 84, 87, 80, 86, 83, 89, 81, 88, 84, 82, 86][i]),
          pre_almoco: String([78, 82, 75, 85, 80, 77, 83, 79, 84, 76, 81, 78, 82, 80, 77][i]),
          pos_cafe: String([118, 122, 115, 128, 120, 116, 124, 119, 126, 114, 121, 117, 123, 120, 118][i]),
          pos_almoco: String([112, 118, 108, 124, 115, 110, 120, 113, 122, 109, 117, 114, 119, 116, 112][i]),
          pre_jantar: String([80, 84, 77, 86, 82, 79, 85, 81, 87, 78, 83, 80, 84, 82, 79][i]),
          pos_jantar: String([108, 114, 105, 120, 112, 107, 118, 110, 119, 106, 115, 111, 116, 113, 109][i]),
        })),
      },
    ],
  },
  // ── Demo 10: Isabela — 4 pontos fora → 6 pontos fora → encaminhada ──
  {
    id: 'demo-10',
    nome: 'Isabela Duarte Ramos',
    data_nascimento: '1990-12-20',
    numero_identificacao: '22334455',
    tipo_identificacao: 'cns',
    dum: daysAgo(224),
    pais: 'Brasil',
    estado: 'GO',
    cidade: 'Goiânia',
    usg_data: null,
    usg_ig_semanas: null,
    usg_ig_dias: null,
    status_ficha: 'encaminhada_endocrino',
    dmg_gestacao_anterior: true,
    data_ultima_consulta: daysAgo(3),
    data_proximo_retorno: null,
    tipo_retorno: null,
    consultas: [
      { id: 'c10-1', tipo: 'consulta_1', numero_sequencial: 1, data: daysAgo(120), ig_semanas: 14, ig_dias: 6, observacoes: 'DMG em gestação anterior (2020). Obesidade grau II. IMC 35. PA 130/85.', status_gerado: 'aguardando_gj' },
      { id: 'c10-2', tipo: 'retorno', numero_sequencial: 2, data: daysAgo(90), ig_semanas: 19, ig_dias: 0, observacoes: 'GJ: 99 mg/dL — alterada. DMG confirmado. Orientação nutricional e perfil 4 pontos.', status_gerado: 'dmg_confirmado' },
      {
        id: 'c10-3', tipo: 'ficha_a', numero_sequencial: 3, data: daysAgo(50), ig_semanas: 24, ig_dias: 6,
        observacoes: 'Perfil 4 pontos — 15 dias. 45% dentro da meta. Controle inadequado. Iniciar insulina NPH.',
        status_gerado: 'dmg_confirmado',
        percentual_meta: 45, total_preenchidos: 60, dentro_meta: 27,
        peso_kg: 95, dose_total: 10, dose_manha: 6, dose_noite: 4,
        retorno_dias: 15, data_proximo_retorno_formatted: null,
        decisao: 'controle_inadequado',
        data_inicio: daysAgo(65), data_fim: daysAgo(51),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([100, 105, 98, 110, 103, 108, 96, 112, 101, 107, 99, 111, 104, 97, 106][i]),
          pos_cafe: String([155, 162, 148, 170, 158, 165, 145, 172, 153, 160, 150, 168, 156, 147, 163][i]),
          pos_almoco: String([148, 155, 142, 162, 150, 158, 140, 165, 147, 153, 144, 160, 149, 141, 156][i]),
          pos_jantar: String([142, 150, 138, 158, 145, 152, 135, 160, 141, 148, 139, 155, 143, 136, 151][i]),
        })),
      },
      {
        id: 'c10-4', tipo: 'ficha_b', numero_sequencial: 4, data: daysAgo(3), ig_semanas: 31, ig_dias: 5,
        observacoes: 'Perfil 6 pontos com insulina NPH 14UI — 15 dias. 40% dentro da meta. Controle inadequado mesmo com insulina. Encaminhar para endocrinologista.',
        status_gerado: 'encaminhada_endocrino',
        percentual_meta: 40, total_preenchidos: 90, dentro_meta: 36,
        peso_kg: 94, dose_total: 14, dose_manha: 8, dose_noite: 6,
        retorno_dias: null, data_proximo_retorno_formatted: null,
        decisao: 'encerramento_endocrino',
        data_inicio: daysAgo(18), data_fim: daysAgo(4),
        grid_valores: Array.from({ length: 15 }, (_, i) => ({
          dia: String(i + 1),
          jejum: String([98, 102, 95, 108, 100, 105, 93, 110, 99, 104, 96, 107, 101, 94, 103][i]),
          pre_almoco: String([92, 96, 88, 100, 94, 98, 86, 102, 91, 97, 89, 99, 93, 87, 95][i]),
          pos_cafe: String([150, 158, 145, 168, 155, 162, 142, 170, 148, 156, 146, 165, 152, 143, 160][i]),
          pos_almoco: String([145, 152, 140, 162, 148, 155, 138, 165, 143, 150, 141, 158, 146, 139, 153][i]),
          pre_jantar: String([90, 95, 85, 98, 92, 96, 84, 100, 89, 94, 87, 97, 91, 83, 93][i]),
          pos_jantar: String([140, 148, 135, 158, 143, 150, 132, 160, 138, 146, 136, 155, 141, 134, 149][i]),
        })),
      },
    ],
  },
];

export function getPreviewPacientes(): PreviewPaciente[] {
  if (!canUseStorage()) return SEED_PATIENTS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      savePreviewPacientes(SEED_PATIENTS);
      return SEED_PATIENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_PATIENTS;
    return parsed.map((p: any) => ({
      ...p,
      consultas: p.consultas || [],
      tipo_identificacao: p.tipo_identificacao || null,
      pais: p.pais || 'Brasil',
      estado: p.estado || null,
      cidade: p.cidade || null,
    }));
  } catch {
    return SEED_PATIENTS;
  }
}

export function savePreviewPacientes(pacientes: PreviewPaciente[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pacientes));
}

export function addPreviewPaciente(
  paciente: Omit<PreviewPaciente, 'id' | 'status_ficha' | 'data_proximo_retorno' | 'tipo_retorno'>
): PreviewPaciente {
  const current = getPreviewPacientes();
  const newPaciente: PreviewPaciente = {
    id: crypto.randomUUID(),
    status_ficha: 'aguardando_gj',
    data_proximo_retorno: null,
    tipo_retorno: null,
    ...paciente,
  };
  const next = [newPaciente, ...current];
  savePreviewPacientes(next);
  return newPaciente;
}

export function getPreviewPacienteById(id: string): PreviewPaciente | undefined {
  return getPreviewPacientes().find((p) => p.id === id);
}

export function updatePreviewPaciente(id: string, updates: Partial<PreviewPaciente>) {
  const all = getPreviewPacientes();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...updates };
  savePreviewPacientes(all);
}

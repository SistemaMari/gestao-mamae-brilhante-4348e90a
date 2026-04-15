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

const STORAGE_KEY = 'dramari_preview_pacientes_v3';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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

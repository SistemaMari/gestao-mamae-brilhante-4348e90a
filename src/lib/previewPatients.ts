export interface PreviewPaciente {
  id: string;
  nome: string;
  numero_identificacao: string | null;
  dum: string | null;
  usg_data: string | null;
  usg_ig_semanas: number | null;
  usg_ig_dias: number | null;
  status_ficha: string;
  dmg_gestacao_anterior: boolean | null;
  data_ultima_consulta: string | null;
  data_proximo_retorno: string | null;
  tipo_retorno: string | null;
}

const STORAGE_KEY = 'dramari_preview_pacientes';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getPreviewPacientes(): PreviewPaciente[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviewPacientes(pacientes: PreviewPaciente[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pacientes));
}

export function addPreviewPaciente(
  paciente: Omit<PreviewPaciente, 'id' | 'status_ficha' | 'data_ultima_consulta' | 'data_proximo_retorno' | 'tipo_retorno'>
) {
  const current = getPreviewPacientes();
  const next: PreviewPaciente[] = [
    {
      id: crypto.randomUUID(),
      status_ficha: 'aguardando_gj',
      data_ultima_consulta: new Date().toISOString().slice(0, 10),
      data_proximo_retorno: null,
      tipo_retorno: null,
      ...paciente,
    },
    ...current,
  ];

  savePreviewPacientes(next);
  return next[0];
}

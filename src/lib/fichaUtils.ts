import { addDays, differenceInDays } from 'date-fns';
import { parseDateLocal } from '@/lib/dateUtils';

export const STATUS_CONFIG: Record<string, { label: string; color: string; meaning: string }> = {
  aguardando_gj: {
    label: 'Aguardando GJ',
    color: 'bg-gray-500',
    meaning: 'Consulta 1 registrada. Aguardando resultado da glicemia de jejum.',
  },
  aguardando_gtt: {
    label: 'Aguardando GTT',
    color: 'bg-blue-500',
    meaning: 'GJ normal (< 92). Aguardando GTT 75g entre 24-28 semanas.',
  },
  dmg_afastado: {
    label: 'DMG afastado',
    color: 'bg-emerald-500',
    meaning: 'GTT normal. Diagnóstico de DMG descartado. Pré-natal normal.',
  },
  dmg_confirmado: {
    label: 'DMG confirmado',
    color: 'bg-orange-500',
    meaning: 'Diagnóstico positivo (GJ ≥ 92, GTT alterado ou Overt). Em acompanhamento ativo.',
  },
  resultado_parto: {
    label: 'Resultado do parto',
    color: 'bg-purple-500',
    meaning: 'Parto realizado. Desfecho perinatal registrado.',
  },
  encaminhada_endocrino: {
    label: 'Associar endocrino',
    color: 'bg-red-500',
    meaning: 'Cenário 7: controle inadequado com insulina. MARI encerrada. Acompanhamento compartilhado GO + endocrinologista.',
  },
};

export interface IGInputs {
  dum?: string | null;
  usg_data?: string | null;
  usg_ig_semanas?: number | null;
  usg_ig_dias?: number | null;
}

/**
 * Idade gestacional calculada em runtime.
 * Prioriza USG (DUM corrigida) e cai pra DUM informada.
 * Retorna no formato "28 sem + 3 dias" ou "—" quando não calculável.
 */
export function calcIdadeGestacional(p: IGInputs): string {
  let refDate: Date | null = null;

  if (p.usg_data && p.usg_ig_semanas != null) {
    const usgDate = parseDateLocal(p.usg_data);
    if (usgDate) {
      const diasNaUsg = (p.usg_ig_semanas * 7) + (p.usg_ig_dias || 0);
      refDate = addDays(usgDate, -diasNaUsg);
    }
  } else if (p.dum) {
    refDate = parseDateLocal(p.dum);
  }

  if (!refDate) return '—';

  const totalDias = differenceInDays(new Date(), refDate);
  if (totalDias < 0) return '—';

  const semanas = Math.floor(totalDias / 7);
  const dias = totalDias % 7;
  return `${semanas} sem + ${dias} dias`;
}

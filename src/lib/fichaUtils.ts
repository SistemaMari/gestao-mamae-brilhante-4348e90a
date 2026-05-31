import { addDays, differenceInDays } from 'date-fns';
import { parseDateLocal } from '@/lib/dateUtils';

export const STATUS_CONFIG: Record<string, { label: string; color: string; meaning: string }> = {
  aguardando_gj: {
    label: 'Aguardando GJ',
    color: 'bg-gray-500',
    meaning: 'Caso Novo registrada. Aguardando resultado da glicemia de jejum.',
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

/**
 * Linha de USG mínima usada para cálculo de IG.
 * Espelha as colunas relevantes de exames_usg.
 */
export interface UsgRefInput {
  id: string;
  data_exame: string;
  ig_semanas: number;
  ig_dias: number;
  ordem: number;
}

/**
 * Calcula a IG HOJE a partir de uma data de DUM (yyyy-MM-dd).
 * Retorna { semanas, dias } ou null se a DUM é inválida / futura.
 *
 * Pensada para uso em listas/labels onde o usuário precisa comparar
 * a IG hoje gerada pela DUM com a IG hoje gerada por cada USG.
 * A ferramenta NÃO emite julgamento clínico — só devolve os números.
 */
export function calcIgHojeFromDum(
  dum: string | null | undefined,
): { semanas: number; dias: number } | null {
  if (!dum) return null;
  const base = parseDateLocal(dum);
  if (!base) return null;
  const totalDias = differenceInDays(new Date(), base);
  if (totalDias < 0) return null;
  return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7 };
}

/**
 * Calcula a IG HOJE a partir de uma USG (data do exame + IG do laudo).
 * Retorna { semanas, dias } ou null se a USG tem data inválida / futura.
 */
export function calcIgHojeFromUsg(
  usg: Pick<UsgRefInput, 'data_exame' | 'ig_semanas' | 'ig_dias'> | null | undefined,
): { semanas: number; dias: number } | null {
  if (!usg) return null;
  const examDate = parseDateLocal(usg.data_exame);
  if (!examDate) return null;
  const diasNaUsg = (usg.ig_semanas * 7) + (usg.ig_dias || 0);
  const base = addDays(examDate, -diasNaUsg);
  const totalDias = differenceInDays(new Date(), base);
  if (totalDias < 0) return null;
  return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7 };
}

/**
 * Formata uma IG como "Xs Yd" (ex.: "21s 3d"). Retorna "—" quando null.
 * Padrão visual unificado das listas de DUM e USGs.
 */
export function formatIgCurto(
  ig: { semanas: number; dias: number } | null | undefined,
): string {
  if (!ig) return '—';
  return `${ig.semanas}s ${ig.dias}d`;
}

export interface IGInputs {
  dum?: string | null;
  /**
   * Snapshot da 1ª USG (colunas pacientes.usg_data/ig_semanas/ig_dias).
   * Mantido por retrocompat: listagens (Dashboard, FichasUnidade, Excel) continuam
   * usando esse caminho. Quando o caller souber resolver a USG ativa dinamicamente,
   * preferir `usgs` + `referencia_usg_id`.
   */
  usg_data?: string | null;
  usg_ig_semanas?: number | null;
  usg_ig_dias?: number | null;
  /**
   * Novos campos (Prompt 33B) — quando fornecidos, têm precedência sobre o snapshot.
   * - referencia_ig: qual fonte usar ('dum' ou 'usg').
   * - referencia_usg_id: id da USG ativa em exames_usg. Quando NULL e referencia_ig='usg',
   *   aplica fallback silencioso para a USG de ordem = 1.
   * - usgs: lista de USGs disponíveis para o paciente (de exames_usg).
   */
  referencia_ig?: 'dum' | 'usg' | null;
  referencia_usg_id?: string | null;
  usgs?: UsgRefInput[];
}

/**
 * Resolve qual USG usar como referência.
 *
 * Regras (Prompt 33B):
 *  1. Se `referencia_usg_id` está setado e existe na lista → usa essa USG.
 *  2. Se `referencia_usg_id` é NULL/undefined → fallback silencioso para USG de ordem = 1.
 *  3. Se nenhuma USG existir → retorna null (caller decide se cai pra DUM).
 *
 * IMPORTANTE: nunca lança erro. O fallback é parte do contrato.
 */
export function resolveUsgAtiva(
  usgs: UsgRefInput[] | undefined,
  referencia_usg_id: string | null | undefined,
): UsgRefInput | null {
  if (!usgs || usgs.length === 0) return null;
  if (referencia_usg_id) {
    const found = usgs.find(u => u.id === referencia_usg_id);
    if (found) return found;
    // id inválido (USG apagada?) → cai pro fallback abaixo
  }
  // Fallback: USG de ordem = 1
  return usgs.find(u => u.ordem === 1) ?? usgs[0] ?? null;
}

/**
 * Idade gestacional calculada em runtime.
 * Prioriza USG (DUM corrigida) e cai pra DUM informada.
 * Retorna no formato "28 sem + 3 dias" ou "—" quando não calculável.
 *
 * Precedência (Prompt 33B):
 *  - Se `usgs` foi fornecido E `referencia_ig === 'usg'` → resolve via `resolveUsgAtiva`
 *    (com fallback ordem=1 quando referencia_usg_id=NULL).
 *  - Senão, mantém comportamento legado: snapshot `usg_data`/`usg_ig_semanas` ou DUM.
 */
export function calcIdadeGestacional(p: IGInputs): string {
  let refDate: Date | null = null;

  // Novo caminho (33B): caller forneceu lista de USGs + referência ativa
  if (p.usgs && p.usgs.length > 0 && p.referencia_ig === 'usg') {
    const usg = resolveUsgAtiva(p.usgs, p.referencia_usg_id);
    if (usg) {
      const usgDate = parseDateLocal(usg.data_exame);
      if (usgDate) {
        const diasNaUsg = (usg.ig_semanas * 7) + (usg.ig_dias || 0);
        refDate = addDays(usgDate, -diasNaUsg);
      }
    }
    // Se nem o fallback achou USG, cai pra DUM abaixo
  }

  // Caminho legado: snapshot usg_data ou DUM (mantido para listagens)
  if (!refDate) {
    if (p.usg_data && p.usg_ig_semanas != null && p.referencia_ig !== 'dum') {
      const usgDate = parseDateLocal(p.usg_data);
      if (usgDate) {
        const diasNaUsg = (p.usg_ig_semanas * 7) + (p.usg_ig_dias || 0);
        refDate = addDays(usgDate, -diasNaUsg);
      }
    } else if (p.dum) {
      refDate = parseDateLocal(p.dum);
    }
  }

  if (!refDate) return '—';

  const totalDias = differenceInDays(new Date(), refDate);
  if (totalDias < 0) return '—';

  const semanas = Math.floor(totalDias / 7);
  const dias = totalDias % 7;
  return `${semanas} sem + ${dias} dias`;
}

/**
 * Versão estruturada de `calcIdadeGestacional` — retorna { semanas, dias } ou null.
 * Útil quando o caller precisa do número (ex.: comparar com janelas clínicas, ifs).
 */
export function calcIdadeGestacionalStruct(p: IGInputs): { semanas: number; dias: number } | null {
  let refDate: Date | null = null;

  if (p.usgs && p.usgs.length > 0 && p.referencia_ig === 'usg') {
    const usg = resolveUsgAtiva(p.usgs, p.referencia_usg_id);
    if (usg) {
      const usgDate = parseDateLocal(usg.data_exame);
      if (usgDate) {
        const diasNaUsg = (usg.ig_semanas * 7) + (usg.ig_dias || 0);
        refDate = addDays(usgDate, -diasNaUsg);
      }
    }
  }

  if (!refDate) {
    if (p.usg_data && p.usg_ig_semanas != null && p.referencia_ig !== 'dum') {
      const usgDate = parseDateLocal(p.usg_data);
      if (usgDate) {
        const diasNaUsg = (p.usg_ig_semanas * 7) + (p.usg_ig_dias || 0);
        refDate = addDays(usgDate, -diasNaUsg);
      }
    } else if (p.dum) {
      refDate = parseDateLocal(p.dum);
    }
  }

  if (!refDate) return null;
  const totalDias = differenceInDays(new Date(), refDate);
  if (totalDias < 0) return null;
  return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7 };
}

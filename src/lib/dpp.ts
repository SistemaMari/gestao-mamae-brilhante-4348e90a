/**
 * PROMPT 42E — DPP (data provável de parto) e janela de reteste puerperal.
 *
 * DPP NÃO reimplementa cálculo de IG: apoia-se no `base_data` já devolvido pela
 * fonte única `calcular_ig` (via `getIg`/`useIg`). `base_data` é o ponto-zero da
 * gestação (DUM efetiva) para QUALQUER âncora — DUM ou USG, com a precedência
 * unificada da migration `unifica_ancora_ig`. Logo:
 *
 *   DPP = base_data + 280 dias (40 semanas)
 *
 * Quando a âncora muda (DUM ↔ USG), `base_data` muda e a DPP acompanha
 * automaticamente — sem cálculo paralelo aqui.
 */

import { addDays } from 'date-fns';
import { parseDateLocal, formatDateISO } from '@/lib/dateUtils';

/** 40 semanas de gestação em dias. */
const DIAS_GESTACAO_A_TERMO = 280;

/**
 * Janela clínica do reteste puerperal (GTT 75g pós-evento), em SEMANAS.
 *
 * FONTE CLÍNICA: "realizar GTT 75g (jejum + 2h) entre 6 e 8 semanas após o
 * parto" — copy fixada na Fase 1 (EncerramentoPartoCard). Constante isolada
 * aqui; nenhum número clínico solto nos componentes.
 */
export const JANELA_RETESTE_PUERPERAL_SEMANAS = { min: 6, max: 8 } as const;

/**
 * DPP como ISO 'YYYY-MM-DD' a partir do `base_data` (DUM efetiva) da paciente.
 * Retorna `null` quando não há âncora (base_data ausente).
 */
export function calcularDppISO(
  baseData: string | null | undefined,
): string | null {
  const base = parseDateLocal(baseData);
  if (!base) return null;
  return formatDateISO(addDays(base, DIAS_GESTACAO_A_TERMO));
}

/**
 * Janela de reteste puerperal a partir de uma ÂNCORA ISO ('YYYY-MM-DD').
 * A âncora é o evento real (parto/aborto → data_encerramento) ou a DPP estimada
 * (não-retornou/insulinização/outro). Retorna as bordas como ISO, ou `null`
 * quando a âncora é inválida/ausente.
 */
export function janelaRetestePuerperal(
  ancoraISO: string | null | undefined,
): { inicioISO: string; fimISO: string } | null {
  const ancora = parseDateLocal(ancoraISO);
  if (!ancora) return null;
  return {
    inicioISO: formatDateISO(addDays(ancora, JANELA_RETESTE_PUERPERAL_SEMANAS.min * 7)),
    fimISO: formatDateISO(addDays(ancora, JANELA_RETESTE_PUERPERAL_SEMANAS.max * 7)),
  };
}

/**
 * PROMPT 42E — Encerramento manual in-app (Fase 2).
 *
 * Fonte única de tipagem/labels PT do motivo de encerramento do acompanhamento.
 * O enum `motivo_encerramento_paciente` já é gerado em `types.ts`
 * (insulinizacao | parto | aborto | nao_retornou | outro); aqui damos a ele
 * um tipo local + rótulos em português consumidos pelo modal e pelo card.
 *
 * Regra de escrita (decisão 42E): o encerramento manual grava APENAS
 * `motivo_encerramento` (+ data/obs conforme o motivo) em `pacientes` — NÃO
 * sobrescreve `status_ficha`. Assim o motivo é a fonte de verdade da UI e o
 * sinal clínico de DMG (que vive em `status_ficha`) fica preservado. A
 * propagação do encerramento para listas/dashboard é o follow-up 42E.1.
 */

import type { Database } from '@/integrations/supabase/types';

export type MotivoEncerramento =
  Database['public']['Enums']['motivo_encerramento_paciente'];

/** Rótulos em português — ponto único, consumido por modal e card. */
export const MOTIVO_ENCERRAMENTO_LABEL: Record<MotivoEncerramento, string> = {
  insulinizacao: 'Insulinização',
  parto: 'Parto',
  aborto: 'Aborto',
  nao_retornou: 'Paciente não retornou',
  outro: 'Outro',
};

/**
 * Motivos que o profissional pode escolher manualmente no modal.
 * `insulinizacao` fica de fora — é gravado automaticamente pelo motor (42A/42B),
 * nunca escolhido à mão.
 */
export const MOTIVOS_MANUAIS: readonly MotivoEncerramento[] = [
  'parto',
  'aborto',
  'nao_retornou',
  'outro',
] as const;

/** Motivos que exigem a DATA do evento (date picker, não futura). */
export function motivoExigeData(motivo: MotivoEncerramento): boolean {
  return motivo === 'parto' || motivo === 'aborto';
}

/** Motivos que exigem TEXTO livre (observação). */
export function motivoExigeObs(motivo: MotivoEncerramento): boolean {
  return motivo === 'outro';
}

/**
 * Motivo EFETIVO da paciente — ponte `status_ficha` → `motivo_encerramento`.
 *
 * O 42B grava `motivo_encerramento='insulinizacao'` E
 * `status_ficha='encerrada_insulinizacao'`. Este resolver trata os dois como
 * OR, então mesmo uma ficha legada que só tenha o status (sem o motivo) resolve
 * para `insulinizacao`. Retorna `null` quando a paciente está ativa.
 */
export function resolverMotivoEfetivo(paciente: {
  motivo_encerramento?: MotivoEncerramento | null;
  status_ficha?: string | null;
}): MotivoEncerramento | null {
  if (paciente.motivo_encerramento) return paciente.motivo_encerramento;
  if (paciente.status_ficha === 'encerrada_insulinizacao') return 'insulinizacao';
  return null;
}

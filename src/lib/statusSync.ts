/**
 * V4 — Guarda de sincronia do status clínico da paciente.
 *
 * `pacientes.status_ficha` representa o estado clínico ATUAL da paciente, que é
 * ditado pela consulta MAIS RECENTE. Os forms, ao salvar, derivam um status
 * daquela consulta e o gravavam SEMPRE — então reabrir/editar uma consulta ANTIGA
 * (ex.: o Retorno 1 só para corrigir uma observação) revertia o status da paciente
 * para um estágio anterior (ex.: "Aguardando GTT"), dessincronizando a lista e a
 * ficha em relação ao histórico real.
 *
 * Regra: só a consulta mais recente (maior `numero_sequencial`) — ou uma consulta
 * NOVA (sem `editingConsulta`) — pode atualizar o status da paciente. Editar uma
 * consulta anterior preserva o status vigente.
 */
export function consultaDitaStatusPaciente(
  editingConsulta: { numero_sequencial?: number | null } | null | undefined,
  consultas: Array<{ numero_sequencial?: number | null }>,
): boolean {
  // Consulta nova (sem edição) é sempre a mais recente → dita o status.
  if (!editingConsulta) return true;
  const seqAtual = editingConsulta.numero_sequencial ?? 0;
  const maxSeq = consultas.reduce(
    (m, c) => Math.max(m, c.numero_sequencial ?? 0),
    0,
  );
  return seqAtual >= maxSeq;
}

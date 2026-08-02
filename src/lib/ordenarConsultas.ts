/**
 * Ordenação do histórico de consultas por SEQUÊNCIA CLÍNICA (Ajustes V4).
 *
 * O fluxo do DMG tem uma ordem clínica fixa: Caso Novo → Glicemia de jejum →
 * GTT 75g → perfis de acompanhamento (4 pontos / 6 pontos) → registro do parto.
 * Antes, o histórico era ordenado pela DATA da consulta digitada — então uma data
 * fora de ordem (ex.: a glicemia de jejum digitada com data posterior à do perfil
 * de 4 pontos) invertia a exibição e a numeração dos retornos.
 *
 * Aqui a ordem passa a seguir o estágio clínico (pelo `tipo`) e, dentro do mesmo
 * estágio, a ordem de CRIAÇÃO (`created_at`) — que reflete a ordem real do fluxo,
 * independente da data digitada. Assim, Caso Novo vem sempre antes da glicemia,
 * que vem antes do GTT, que vem antes dos perfis — e os perfis entre si seguem a
 * ordem em que foram criados.
 */

// Estágio clínico por tipo de consulta. Perfis de acompanhamento compartilham o
// mesmo estágio (ordenados entre si por created_at). Tipos desconhecidos entram
// após os perfis e antes do parto, sem quebrar a lista.
const ESTAGIO: Record<string, number> = {
  consulta_1: 0,
  retorno_1: 1,
  gtt: 2,
  ficha_a: 3,
  ficha_c: 3,
  ficha_b: 3,
  ficha_d: 3,
  ficha_e: 3,
  registro_parto: 5,
  resultado_parto: 5,
};

function estagio(tipo: string): number {
  return ESTAGIO[tipo] ?? 4;
}

export interface ConsultaOrdenavel {
  tipo: string;
  created_at?: string | null;
}

/**
 * Devolve uma NOVA lista ordenada por (estágio clínico, ordem de criação).
 * Não muta a entrada.
 */
export function ordenarPorSequenciaClinica<T extends ConsultaOrdenavel>(consultas: T[]): T[] {
  return [...consultas].sort((a, b) => {
    const ea = estagio(a.tipo);
    const eb = estagio(b.tipo);
    if (ea !== eb) return ea - eb;
    // Mesmo estágio → ordem de criação (created_at é ISO, comparação lexicográfica).
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    return 0;
  });
}

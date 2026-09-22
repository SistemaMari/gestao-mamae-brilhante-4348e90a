/**
 * V4 — decisão de "esta consulta abre pactuação do PRÓXIMO perfil ao final do laudo?".
 *
 * Regra clínica (Moara, set/2026): sempre que a paciente sai da consulta com
 * conduta "vai levar perfil para casa", o laudo termina com pactuação de janela
 * (1h/2h) + datas + botão de imprimir. Não é mais o form da ficha SEGUINTE que
 * decide isso — a decisão pertence ao laudo da consulta ATUAL.
 *
 * Retorna o número de pontos do próximo perfil (4 ou 6), ou null quando não há
 * próximo perfil (paciente saiu sem DMG, ou o acompanhamento encerrou).
 *
 * IMPORTANTE — cenários de insulina/encerramento (r2_insulina, r3_insulina,
 * r4b_insulina, e_insulina, regra_fetal, parto, aborto, nao_retornou) NÃO abrem
 * pactuação: a MARI encerra o acompanhamento nesses casos, sem próximo perfil.
 */

/** Tipos possíveis de consulta (espelha o campo `tipo` de `consultas`). */
export type TipoConsultaPactuacao =
  | 'consulta_1'
  | 'retorno_1'
  | 'gtt'
  | 'ficha_a'
  | 'ficha_c'
  | 'ficha_b'
  | 'ficha_d'
  | 'ficha_e';

export type PontosProxPerfil = 4 | 6;

/**
 * Devolve 4 ou 6 se este laudo deve terminar com pactuação do próximo perfil;
 * null se não deve (sem DMG, ou encerramento).
 *
 * A regra é fechada — qualquer combinação não listada devolve null. Isso evita
 * que um desfecho novo (ainda não classificado) mostre a pactuação por engano.
 */
export function pontosDoProximoPerfil(
  tipo: TipoConsultaPactuacao | string | null | undefined,
  desfecho: string | null | undefined,
): PontosProxPerfil | null {
  if (!tipo || !desfecho) return null;

  // Diagnóstico confirma DMG → próximo é 4 pontos.
  if (tipo === 'retorno_1' && (desfecho === '1' || desfecho === '6' || desfecho === '8')) return 4;
  if (tipo === 'gtt' && (desfecho === '6' || desfecho === '6B' || desfecho === '8')) return 4;

  // Ficha A/C que continua sem insulina.
  if (tipo === 'ficha_a' || tipo === 'ficha_c') {
    if (desfecho === 'r1_manter' || desfecho === 'r2_reforcar') return 4;
    // Regra 4 memória confirma → próxima ficha é E (6 pontos sem insulina).
    if (desfecho === 'r4a_fichae') return 6;
    // Regra 4 memória NÃO confirma + aceita reforçar → mantém 4 pontos.
    if (desfecho === 'r4_reforcar') return 4;
  }

  // Ficha E que continua no perfil de 6 pontos.
  if (tipo === 'ficha_e' && desfecho === 'e_manter') return 6;

  return null;
}

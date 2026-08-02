/**
 * Blindagem do "próximo passo" do acompanhamento do DMG (Ajustes V4).
 *
 * O fluxo é de MÃO ÚNICA: 4 pontos (Ficha A/C) → 6 pontos sem insulina (Ficha E)
 * → insulina (encerra). O motor NUNCA roteia de 6 pontos de volta para 4 — uma
 * Ficha E só recomenda outra Ficha E (mantém) ou insulina (encerra).
 *
 * O roteamento antigo escolhia "a última ficha com decisão por ordem do array"
 * (ordenado por data). Com datas fora de ordem, edição ou backdating, uma Ficha
 * A/C ANTIGA podia parecer a vigente e o app oferecia 4 pontos DEPOIS de 6 — o
 * defeito observado na paciente de teste "Ana".
 *
 * Esta função torna a regra à prova de dados tortos: se a paciente já alcançou os
 * 6 pontos (qualquer Ficha E com decisão), a decisão vigente é a da ÚLTIMA Ficha E
 * — nunca uma Ficha A/C posterior. Assim, "4 pontos depois de 6" é impossível por
 * construção, independentemente das datas.
 */
export interface ConsultaDecisao {
  tipo: string;
  proxima_ficha_recomendada?: string | null;
}

const TIPOS_COM_DECISAO = ['ficha_a', 'ficha_c', 'ficha_e'];

/**
 * Escolhe a consulta cuja `proxima_ficha_recomendada` deve ditar o próximo passo.
 * Espera `consultas` em ordem cronológica (como vêm do banco, ordenadas por data).
 * - Se houver qualquer Ficha E com decisão → retorna a ÚLTIMA Ficha E (mão única).
 * - Senão → a última Ficha A/C com decisão.
 * - Sem nenhuma decisão → null.
 */
export function escolherDecisaoVigente<T extends ConsultaDecisao>(consultas: T[]): T | null {
  const comDecisao = consultas.filter(
    (c) => TIPOS_COM_DECISAO.includes(c.tipo) && !!c.proxima_ficha_recomendada,
  );
  if (comDecisao.length === 0) return null;
  // Mão única: alcançados os 6 pontos, a vigente é a última Ficha E — nunca uma A/C.
  const ultimaFichaE = [...comDecisao].reverse().find((c) => c.tipo === 'ficha_e');
  if (ultimaFichaE) return ultimaFichaE;
  return comDecisao[comDecisao.length - 1];
}

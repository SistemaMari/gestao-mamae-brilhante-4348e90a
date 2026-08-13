/**
 * V4 — Quais exames de ultrassom/vigilância fetal o laudo deve SOLICITAR em uma
 * ficha, em função da idade gestacional (semanas). Determinístico e testável.
 *
 * Cronograma (transcrição das especialistas — DMG A1, não-farmacológico):
 *  - USG morfológico de 2º trimestre: 12–14 sem (solicitar enquanto ainda cabe).
 *  - USG obstétrico p/ crescimento fetal: entre 28 e 32 sem.
 *  - USG obstétrico p/ crescimento fetal: na 36ª sem.
 *  - Contagem de movimento fetal (CMF): diária a partir de 28 sem (todo retorno).
 *  - Cardiotocografia anteparto (CTG): semanal a partir de 34 sem.
 *  - Perfil biofísico fetal (PBF): semanal a partir de 34 sem.
 * (USG de datação é solicitado no Caso Novo; Doppler não se pede para DMG.)
 *
 * ⚠️ Limiares de IG são RASCUNHO — pendentes de ratificação clínica das Dras.
 * Retorna chaves i18n (ficha.pedidoExames.*) na ordem clínica de exibição.
 */
export function pedidosExamesFetais(igSemanas: number | null | undefined): string[] {
  if (igSemanas == null) return [];
  const p: string[] = [];
  if (igSemanas < 15) p.push('ficha.pedidoExames.morfologico');
  if (igSemanas >= 24 && igSemanas < 33) p.push('ficha.pedidoExames.crescimento2832');
  if (igSemanas >= 33) p.push('ficha.pedidoExames.crescimento36');
  if (igSemanas >= 28) p.push('ficha.pedidoExames.cmf');
  if (igSemanas >= 34) p.push('ficha.pedidoExames.ctg');
  if (igSemanas >= 34) p.push('ficha.pedidoExames.pbf');
  return p;
}

/** Tipos de ficha em que o pedido de exames aparece (acompanhamento pós-diagnóstico). */
const TIPOS_COM_PEDIDO = new Set(['ficha_a', 'ficha_c', 'ficha_e', 'ficha_b', 'ficha_d']);

export function fichaTemPedidoExames(tipo: string | null | undefined): boolean {
  return tipo != null && TIPOS_COM_PEDIDO.has(tipo);
}

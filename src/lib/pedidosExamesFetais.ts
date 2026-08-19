/**
 * V4 — Quais exames de ultrassom/vigilância fetal o laudo deve SOLICITAR em uma
 * ficha. Determinístico e testável.
 *
 * Cronograma (ratificado pelas especialistas):
 *  - USG morfológico de 2º trimestre: 12–14 sem (solicitar enquanto ainda cabe).
 *  - USG obstétrico p/ crescimento fetal: entre 28 e 32 sem.
 *  - USG obstétrico p/ crescimento fetal: na 36ª sem.
 *  - Contagem de movimento fetal (CMF): diária a partir de 28 sem (todo retorno).
 *  - Cardiotocografia (CTG) + perfil biofísico fetal (PBF): a partir de 32 sem no
 *    tratamento NÃO medicamentoso (dieta + atividade física).
 *  - Em tratamento MEDICAMENTOSO (insulina) a MARI encerra: fica só a MENSAGEM de
 *    que, a partir de 34 sem, CTG e PBF semanais devem ser solicitados.
 * (USG de datação é solicitado no Caso Novo; Doppler não se pede para DMG.)
 *
 * DUAS NATUREZAS DE PEDIDO (correção V4 — o laudo repetia exame já feito):
 *  - PONTUAL (morfológico, crescimento 28–32, crescimento 36): é um exame que se
 *    faz UMA VEZ na sua janela. Assim que o resultado é registrado, o pedido SAI
 *    do laudo — inclusive no laudo da própria consulta em que foi registrado.
 *  - CONTÍNUO (CMF diário, CTG e PBF semanais): é vigilância permanente. Registrar
 *    o resultado NÃO encerra o pedido — ele segue aparecendo em toda consulta,
 *    porque a orientação é manter a rotina.
 *
 * Retorna chaves i18n (ficha.pedidoExames.*) na ordem clínica de exibição.
 */

export const PEDIDO_MORFOLOGICO = 'ficha.pedidoExames.morfologico';
export const PEDIDO_CRESCIMENTO_2832 = 'ficha.pedidoExames.crescimento2832';
export const PEDIDO_CRESCIMENTO_36 = 'ficha.pedidoExames.crescimento36';

/** Pedidos PONTUAIS — únicos que podem ser dados por atendidos (ver docblock). */
export const PEDIDOS_PONTUAIS: readonly string[] = [
  PEDIDO_MORFOLOGICO, PEDIDO_CRESCIMENTO_2832, PEDIDO_CRESCIMENTO_36,
];

/**
 * Separa a lista em dois blocos de exibição no laudo, para que a repetição da
 * vigilância a cada consulta não seja lida como pedido repetido indevidamente:
 *  - `solicitar`: exames PONTUAIS ainda pendentes (agendar e trazer o resultado);
 *  - `vigilancia`: rotina CONTÍNUA (CMF diário, CTG/PBF semanais), que por
 *    definição reaparece em toda consulta enquanto a IG a mantiver indicada.
 */
export function separarPedidos(pedidos: readonly string[]): {
  solicitar: string[];
  vigilancia: string[];
} {
  return {
    solicitar: pedidos.filter((k) => PEDIDOS_PONTUAIS.includes(k)),
    vigilancia: pedidos.filter((k) => !PEDIDOS_PONTUAIS.includes(k)),
  };
}

export function pedidosExamesFetais(
  igSemanas: number | null | undefined,
  emInsulina = false,
  /** Pedidos pontuais já atendidos (de `pedidosJaAtendidos`) — saem da lista. */
  jaAtendidos: readonly string[] = [],
): string[] {
  if (igSemanas == null) return emInsulina ? ['ficha.pedidoExames.ctgPbfMedicamentoso'] : [];
  const p: string[] = [];
  if (igSemanas < 15) p.push(PEDIDO_MORFOLOGICO);
  if (igSemanas >= 24 && igSemanas < 33) p.push(PEDIDO_CRESCIMENTO_2832);
  if (igSemanas >= 33) p.push(PEDIDO_CRESCIMENTO_36);
  if (igSemanas >= 28) p.push('ficha.pedidoExames.cmf');
  if (emInsulina) {
    // MARI encerra ao insulinizar → só a instrução forward (34 sem, medicamentoso).
    p.push('ficha.pedidoExames.ctgPbfMedicamentoso');
  } else {
    if (igSemanas >= 32) p.push('ficha.pedidoExames.ctg');
    if (igSemanas >= 32) p.push('ficha.pedidoExames.pbf');
  }
  // Só pedido PONTUAL sai da lista quando atendido; vigilância contínua permanece.
  return p.filter((k) => !(PEDIDOS_PONTUAIS.includes(k) && jaAtendidos.includes(k)));
}

/**
 * Um resultado de exame fetal já registrado para a paciente, com a IG da consulta
 * em que foi registrado (a IG é o que define QUAL janela o exame atendeu).
 *
 * Duas origens, ambas contam como "USG de crescimento feita":
 *  - a linha de `exames_fetais` da consulta (campos crescimento/pfe_us/ca/la);
 *  - os itens 4/5/6 do checklist do Retorno 2 (`decisoes_ficha_a.checklist_*`),
 *    que na Ficha A/C são a própria leitura da US de crescimento.
 */
export interface RegistroFetalConsulta {
  igSemanas: number | null | undefined;
  morfologico?: string | null;
  crescimento?: string | null;
  pfe_us?: string | null;
  ca?: string | null;
  la?: string | null;
}

/** 'sem_info' (checklist) e null (card) significam "não trouxe o exame". */
function respondido(v: string | null | undefined): boolean {
  return v != null && v !== 'sem_info';
}

function temUsgCrescimento(r: RegistroFetalConsulta): boolean {
  return respondido(r.crescimento) || respondido(r.pfe_us) || respondido(r.ca) || respondido(r.la);
}

/**
 * Quais pedidos PONTUAIS já foram atendidos pelos registros informados.
 *
 * Passe apenas os registros até a consulta sendo laudada (inclusive) — o laudo de
 * uma consulta não deve mudar por causa de um exame trazido depois dela.
 *
 * Janelas: a US de crescimento feita entre 28 e 32 sem atende o pedido "28–32";
 * a feita a partir de 33 sem atende o da "36ª semana". Uma NÃO cancela a outra —
 * são dois exames diferentes do cronograma. Registro sem IG conhecida não atende
 * janela nenhuma (não dá para saber qual exame foi), então o pedido continua.
 */
export function pedidosJaAtendidos(registros: readonly RegistroFetalConsulta[]): string[] {
  const feitos = new Set<string>();
  for (const r of registros) {
    // Morfológico é de janela única na gestação: registrado uma vez, nunca mais pedido.
    if (respondido(r.morfologico)) feitos.add(PEDIDO_MORFOLOGICO);
    const ig = r.igSemanas;
    if (ig == null || !temUsgCrescimento(r)) continue;
    if (ig >= 28 && ig < 33) feitos.add(PEDIDO_CRESCIMENTO_2832);
    if (ig >= 33) feitos.add(PEDIDO_CRESCIMENTO_36);
  }
  return [...feitos];
}

/** Tipos de ficha em que o pedido de exames aparece (acompanhamento pós-diagnóstico). */
const TIPOS_COM_PEDIDO = new Set(['ficha_a', 'ficha_c', 'ficha_e', 'ficha_b', 'ficha_d']);

export function fichaTemPedidoExames(tipo: string | null | undefined): boolean {
  return tipo != null && TIPOS_COM_PEDIDO.has(tipo);
}

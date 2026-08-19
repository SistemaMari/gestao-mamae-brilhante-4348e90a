/**
 * V4 — A qual EXAME cada resposta de PFE/CA/LA (e crescimento) pertence.
 *
 * PFE-US, CA e LA não são perguntas de consulta: são a LEITURA de um ultrassom
 * obstétrico de crescimento fetal. Pelo cronograma ratificado, esse ultrassom é
 * feito DUAS vezes na gestação — uma na janela de 28–32 semanas e outra na 36ª.
 * (Em diagnóstico tardio, o USG do diagnóstico e o da janela 28–32 são o mesmo
 * exame.) Logo, esses parâmetros são respondidos duas vezes, não a cada retorno.
 *
 * Antes, o checklist do Retorno 2 repetia as três perguntas em TODA Ficha A/C a
 * partir de 28 semanas. Além do retrabalho, isso convidava a repetir de memória o
 * "Sim" do exame anterior — e é justamente o "Sim" que desliga a `regra_fetal`,
 * a regra que indica insulina por comprometimento fetal.
 *
 * Aqui a resposta passa a pertencer à JANELA do exame:
 *  - a primeira consulta da janela em que o resultado é trazido COLETA as respostas;
 *  - as consultas seguintes DA MESMA JANELA apenas EXIBEM o que foi registrado,
 *    identificando a consulta de origem;
 *  - ao entrar na janela seguinte (36ª sem), volta a coletar — é outro exame.
 *
 * As janelas são as mesmas de `pedidosExamesFetais` (fonte única do cronograma).
 */

export type JanelaCrescimento = 'j2832' | 'j36';

/** Janela do cronograma a que uma IG pertence. Antes de 28 sem não há exame de
 *  crescimento (não é mensurável) → null. */
export function janelaDaIg(igSemanas: number | null | undefined): JanelaCrescimento | null {
  if (igSemanas == null) return null;
  if (igSemanas >= 28 && igSemanas < 33) return 'j2832';
  if (igSemanas >= 33) return 'j36';
  return null;
}

/** Os parâmetros lidos do ultrassom de crescimento. */
export interface ValoresCrescimento {
  pfe_us: string | null;
  ca: string | null;
  la: string | null;
  crescimento?: string | null;
}

/** Um registro de consulta com os parâmetros (venha do checklist ou do card). */
export interface ConsultaComCrescimento extends ValoresCrescimento {
  consultaId: string;
  /** Data da consulta, para dizer ao usuário de onde veio a resposta. */
  data?: string | null;
  igSemanas: number | null | undefined;
}

/** A resposta vigente de uma janela e de qual consulta ela veio. */
export interface RespostaVigenteCrescimento {
  janela: JanelaCrescimento;
  consultaId: string;
  data?: string | null;
  igSemanas: number | null | undefined;
  valores: ValoresCrescimento;
}

/** 'sem_info' (checklist) e null (card) significam "não trouxe o exame". */
function respondido(v: string | null | undefined): boolean {
  return v != null && v !== 'sem_info';
}

function temResposta(v: ValoresCrescimento): boolean {
  return respondido(v.pfe_us) || respondido(v.ca) || respondido(v.la) || respondido(v.crescimento);
}

/**
 * A resposta já registrada na MESMA janela da consulta atual — ou null se esta é
 * a primeira consulta da janela a receber o exame (aí é ela quem coleta).
 *
 * `registros` deve vir em ordem clínica; vence o PRIMEIRO da janela, que é a
 * consulta em que o exame foi efetivamente trazido. A própria consulta atual é
 * excluída (senão ela travaria a si mesma enquanto está sendo preenchida).
 */
export function respostaVigenteDaJanela(
  igAtual: number | null | undefined,
  registros: readonly ConsultaComCrescimento[],
  consultaAtualId?: string | null,
): RespostaVigenteCrescimento | null {
  const janela = janelaDaIg(igAtual);
  if (janela == null) return null;
  for (const r of registros) {
    if (consultaAtualId && r.consultaId === consultaAtualId) continue;
    if (janelaDaIg(r.igSemanas) !== janela) continue;
    if (!temResposta(r)) continue;
    return {
      janela,
      consultaId: r.consultaId,
      data: r.data ?? null,
      igSemanas: r.igSemanas,
      valores: {
        pfe_us: r.pfe_us ?? null,
        ca: r.ca ?? null,
        la: r.la ?? null,
        crescimento: r.crescimento ?? null,
      },
    };
  }
  return null;
}

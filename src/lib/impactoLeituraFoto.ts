/**
 * V4 — Quanto um erro de leitura da foto pode mexer na conduta.
 *
 * Nasceu de um teste com uma foto real: de 28 valores, a leitura acertou 26 —
 * mas os dois erros caíram justamente onde ela tinha dito estar segura, e todas
 * as dúvidas que ela levantou estavam certas. Lição: **a marcação do que não foi
 * lido não é rede de segurança**; o profissional precisa conferir tudo.
 *
 * Só que os dois erros foram "138 lido como 137" — um miligrama, dentro da meta
 * dos dois lados. Não mudaram nada. O que importa, então, não é quantos dígitos
 * a leitura acerta: é **se um erro plausível atravessaria uma linha de decisão**.
 *
 * Duas linhas existem:
 *  - a meta do ponto (jejum < 95; pós-prandial < 140 em 1h, < 120 em 2h), que
 *    decide se AQUELE valor está na meta;
 *  - os 70% de valores na meta, que decidem a CONDUTA da ficha.
 *
 * Este módulo responde: considerando que qualquer valor na fronteira pode ter
 * sido lido errado, o percentual ainda garante a mesma conduta?
 */

/** Erro de leitura considerado plausível, em mg/dL, para cada lado do valor. */
export const MARGEM_LEITURA = 2;

/** Percentual mínimo de valores na meta que define controle adequado. */
export const META_CONTROLE = 70;

export interface PontoMeta {
  /** Chave do ponto na grade (jejum, pos_cafe, ...). */
  ponto: string;
  /** Valor abaixo do qual o ponto está na meta. */
  meta: number;
}

export interface ImpactoLeitura {
  /** Percentual na meta com os valores exatamente como foram lidos. */
  percentual: number | null;
  totalValores: number;
  naMeta: number;
  /** Controle adequado (≥ 70% na meta) com os valores como estão. */
  adequadoAgora: boolean;
  /** Células cujo valor está a menos de MARGEM_LEITURA da própria meta. */
  naFronteira: string[];
  /**
   * Quantos valores de fronteira precisariam estar errados, todos no mesmo
   * sentido, para a conduta virar. `null` = não vira, nem que todos estejam.
   *
   * É a medida honesta do risco. A primeira versão deste módulo devolvia a faixa
   * "de X% a Y%" supondo TODOS os valores de fronteira errados ao mesmo tempo —
   * num perfil bem controlado isso dava de 29% a 89%, uma faixa tão larga que o
   * alarme tocaria sempre. No teste real, 2 valores em 28 saíram errados; a
   * pergunta útil é quantos bastariam.
   */
  errosParaMudar: number | null;
}

/** Poucos erros bastando para virar a conduta → merece atenção redobrada. */
export const ERROS_PARA_ALARMAR = 2;

const HIPOGLICEMIA = 70;

/** Chave de célula, no mesmo formato de `perfilPorFoto`. */
function chave(dia: number, ponto: string): string {
  return `${dia}:${ponto}`;
}

/**
 * Um valor está na fronteira quando um erro de até MARGEM_LEITURA para qualquer
 * lado o levaria para o outro lado da meta. Ex.: com meta 95, o jejum 94 está na
 * fronteira (96 estouraria); o jejum 90 não está.
 */
function naFronteira(valor: number, meta: number): boolean {
  const dentro = valor < meta;
  const extremoAlto = valor + MARGEM_LEITURA;
  const extremoBaixo = valor - MARGEM_LEITURA;
  return dentro ? extremoAlto >= meta : extremoBaixo < meta;
}

/**
 * Calcula a faixa de percentuais possível para a grade.
 *
 * @param grid    grade preenchida
 * @param metas   ponto → meta desta ficha (depende da janela 1h/2h pactuada)
 * @param apenas  se informado, só considera estas células como incertas
 *                (as que vieram da foto — o que foi digitado à mão é confiável)
 */
export function calcularImpactoLeitura(
  grid: readonly Record<string, string>[],
  metas: readonly PontoMeta[],
  apenas?: ReadonlySet<string>,
): ImpactoLeitura {
  let total = 0;
  let naMeta = 0;
  let duvidosos = 0;
  const fronteira: string[] = [];

  grid.forEach((linha, dia) => {
    for (const { ponto, meta } of metas) {
      const valor = parseInt(linha[ponto]);
      if (!valor || valor <= 0) continue;

      total++;
      const dentro = valor >= HIPOGLICEMIA && valor < meta;
      if (dentro) naMeta++;

      // Hipoglicemia é achado próprio, não questão de fronteira de meta.
      if (valor < HIPOGLICEMIA) continue;

      const celula = chave(dia, ponto);
      if (apenas && !apenas.has(celula)) continue;
      if (!naFronteira(valor, meta)) continue;

      fronteira.push(celula);
      duvidosos++;
    }
  });

  if (total === 0) {
    return {
      percentual: null, totalValores: 0, naMeta: 0, adequadoAgora: false,
      naFronteira: [], errosParaMudar: null,
    };
  }

  const percentual = Math.round((naMeta / total) * 1000) / 10;
  const adequadoAgora = percentual >= META_CONTROLE;

  // Quantos valores na meta são necessários para o controle ser adequado.
  const minimoNaMeta = Math.ceil((META_CONTROLE / 100) * total);

  const naMetaFronteira = fronteira.length === 0 ? 0 : contarNaMeta(grid, metas, fronteira);
  const foraFronteira = duvidosos - naMetaFronteira;

  // Para PERDER o controle adequado, valores hoje na meta teriam de sair dela —
  // e só os de fronteira podem sair por erro de leitura. Para GANHAR, o inverso.
  let errosParaMudar: number | null;
  if (adequadoAgora) {
    const necessarios = naMeta - minimoNaMeta + 1;
    errosParaMudar = necessarios <= naMetaFronteira ? necessarios : null;
  } else {
    const necessarios = minimoNaMeta - naMeta;
    errosParaMudar = necessarios <= foraFronteira ? necessarios : null;
  }

  return {
    percentual, totalValores: total, naMeta, adequadoAgora,
    naFronteira: fronteira,
    errosParaMudar,
  };
}

/** A leitura merece alarme? Poucos erros bastariam para virar a conduta. */
export function leituraMereceAtencao(impacto: ImpactoLeitura): boolean {
  return impacto.errosParaMudar != null && impacto.errosParaMudar <= ERROS_PARA_ALARMAR;
}

function contarNaMeta(
  grid: readonly Record<string, string>[],
  metas: readonly PontoMeta[],
  celulas: readonly string[],
): number {
  const metaPorPonto = new Map(metas.map((m) => [m.ponto, m.meta]));
  let n = 0;
  for (const celula of celulas) {
    const [dia, ponto] = celula.split(':');
    const valor = parseInt(grid[Number(dia)]?.[ponto] ?? '');
    const meta = metaPorPonto.get(ponto);
    if (!valor || meta == null) continue;
    if (valor >= HIPOGLICEMIA && valor < meta) n++;
  }
  return n;
}

/**
 * V4 — Leitura do perfil glicêmico a partir de uma FOTO do controle da gestante.
 *
 * A foto NUNCA salva sozinha: ela preenche a grade, o profissional confere e só
 * então confirma. Este arquivo cuida da parte determinística e testável — o
 * contrato do resultado e a aplicação dele na grade. A chamada ao serviço de
 * leitura vive em `extrairPerfilFoto.ts`.
 *
 * Decisão que faz papel de terceiro funcionar: as leituras vêm indexadas por
 * DATA, nunca por posição de linha. Um papel de fora pode começar em outro dia,
 * ter mais linhas ou as colunas em outra ordem — alinhando por data, a grade
 * encaixa sozinha e o que sobra é descartado com aviso.
 */

/** Um dia lido do papel. Valor null = não lido (aparece também em `incertos`). */
export interface LeituraDia {
  /** ISO 'YYYY-MM-DD'. */
  data: string;
  jejum?: number | null;
  pos_cafe?: number | null;
  pre_almoco?: number | null;
  pos_almoco?: number | null;
  pre_jantar?: number | null;
  pos_jantar?: number | null;
}

/** Valor que o serviço não conseguiu ler com segurança — vira célula âmbar. */
export interface IncertoLeitura {
  data: string;
  ponto: string;
  motivo: string;
}

export interface ResultadoExtracao {
  leituras: LeituraDia[];
  incertos: IncertoLeitura[];
  /** Avisos prontos para exibir ao profissional, em português. */
  observacoes: string[];
}

/** Chave de célula na grade: "índiceDoDia:ponto". */
export function chaveCelula(dia: number, ponto: string): string {
  return `${dia}:${ponto}`;
}

export interface RelatorioAplicacao {
  /** Células que a foto preencheu. */
  daFoto: string[];
  /** Células que a foto não conseguiu ler — pedem preenchimento manual. */
  incertas: string[];
  /** Células que já tinham valor digitado e foram PRESERVADAS. */
  preservadas: number;
  /** Dias lidos que não pertencem ao período deste perfil. */
  foraDoPeriodo: number;
  /** Avisos vindos do serviço, repassados como estão. */
  observacoes: string[];
}

/** 'dd/MM/yyyy' (como a coluna Data da grade exibe) → 'yyyy-MM-dd'. */
function brParaIso(dataBr: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Aplica o resultado da leitura na grade.
 *
 * Regra de segurança: **a foto só preenche célula VAZIA**. Se o profissional já
 * digitou algum dia, o que ele escreveu prevalece — sobrescrever calado seria
 * apagar trabalho humano com palpite de máquina. O que foi preservado entra no
 * relatório para virar aviso na tela.
 *
 * @param grid       grade atual (uma linha por dia, chaves = pontos)
 * @param datasDias  data de cada linha em 'dd/MM/yyyy'; vazio = fora do período
 * @param resultado  o que o serviço de leitura devolveu
 * @param pontos     pontos válidos desta ficha (4 ou 6)
 */
export function aplicarLeituraNaGrade(
  grid: readonly Record<string, string>[],
  datasDias: readonly string[],
  resultado: ResultadoExtracao,
  pontos: readonly string[],
): { grid: Record<string, string>[]; relatorio: RelatorioAplicacao } {
  const novaGrade = grid.map((linha) => ({ ...linha }));

  // data ISO → índice da linha na grade
  const linhaPorData = new Map<string, number>();
  datasDias.forEach((dataBr, idx) => {
    const iso = dataBr ? brParaIso(dataBr) : null;
    if (iso && !linhaPorData.has(iso)) linhaPorData.set(iso, idx);
  });

  const daFoto: string[] = [];
  const incertas: string[] = [];
  let preservadas = 0;
  let foraDoPeriodo = 0;

  for (const leitura of resultado.leituras) {
    const idx = linhaPorData.get(leitura.data);
    if (idx == null) { foraDoPeriodo++; continue; }

    for (const ponto of pontos) {
      const valor = (leitura as Record<string, unknown>)[ponto];
      if (valor == null) continue;
      if (typeof valor !== 'number' || !Number.isFinite(valor)) continue;

      // Já digitado pelo profissional → mantém o que ele escreveu.
      if (novaGrade[idx][ponto]?.trim()) { preservadas++; continue; }

      novaGrade[idx][ponto] = String(Math.round(valor));
      daFoto.push(chaveCelula(idx, ponto));
    }
  }

  // Incertos viram célula âmbar — mas só os que caem dentro do período e em
  // ponto que esta ficha coleta.
  for (const inc of resultado.incertos) {
    const idx = linhaPorData.get(inc.data);
    if (idx == null || !pontos.includes(inc.ponto)) continue;
    if (novaGrade[idx][inc.ponto]?.trim()) continue; // já tem valor, não alarma
    incertas.push(chaveCelula(idx, inc.ponto));
  }

  return {
    grid: novaGrade,
    relatorio: {
      daFoto, incertas, preservadas, foraDoPeriodo,
      observacoes: resultado.observacoes ?? [],
    },
  };
}

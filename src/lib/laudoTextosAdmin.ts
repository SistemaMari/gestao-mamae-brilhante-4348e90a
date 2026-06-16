/**
 * Apoio ao editor de textos de laudo no painel admin (laudo_textos).
 * Rótulos amigáveis para tipo_consulta / desfecho_clinico / bloco e a legenda
 * das variáveis [entre colchetes] disponíveis (para o admin não digitar errado).
 */

export interface LaudoTextoRow {
  id: string;
  tipo_consulta: string;
  desfecho_clinico: string;
  bloco: string;
  ordem_bloco: number;
  titulo_bloco: string | null;
  texto: string;
  versao: number;
  status: 'rascunho' | 'publicado' | 'arquivado';
  observacoes: string | null;
}

/** Variáveis substituídas no laudo (espelha src/lib/laudoVariaveis.ts). */
export const VARIAVEIS_LAUDO: ReadonlyArray<{ chave: string; descricao: string }> = [
  { chave: 'nome da paciente', descricao: 'Nome da paciente' },
  { chave: 'IG', descricao: 'Idade gestacional na data da consulta (ex.: "22 semanas e 3 dias")' },
  { chave: 'IG no GTT', descricao: 'Idade gestacional na data do GTT' },
  { chave: 'glicemia de jejum', descricao: 'Glicemia de jejum do Retorno 1 (mg/dL)' },
  { chave: 'GTT jejum', descricao: 'GTT 75g — valor de jejum (mg/dL)' },
  { chave: 'GTT 1h', descricao: 'GTT 75g — valor de 1 hora (mg/dL)' },
  { chave: 'GTT 2h', descricao: 'GTT 75g — valor de 2 horas (mg/dL)' },
  { chave: 'janela GTT início', descricao: 'Início da janela do GTT 75g (dd/mm/aaaa)' },
  { chave: 'janela GTT fim', descricao: 'Fim da janela do GTT 75g (dd/mm/aaaa)' },
  { chave: 'data do próximo retorno', descricao: 'Data do próximo retorno (dd/mm/aaaa)' },
  { chave: 'dias preenchidos', descricao: 'Dias preenchidos no perfil glicêmico' },
  { chave: '% na meta', descricao: 'Percentual de glicemias dentro da meta' },
  { chave: 'dose total de insulina', descricao: 'Dose total de insulina (ex.: "20 UI")' },
  { chave: 'dose manhã', descricao: 'Dose de insulina da manhã (UI)' },
  { chave: 'dose noite', descricao: 'Dose de insulina da noite / bed time (UI)' },
  { chave: 'dose atual de insulina', descricao: 'Dose atual de insulina — Ficha B/D (UI)' },
];

const TIPO_LABEL: Record<string, string> = {
  consulta_1: 'Caso Novo',
  retorno_1: 'Retorno 1 — glicemia de jejum',
  gtt: 'GTT 75g',
  ficha_a: 'Ficha A — Retorno 2',
  ficha_c: 'Ficha C — Retorno 2',
  ficha_b: 'Ficha B — acompanhamento c/ insulina',
  ficha_d: 'Ficha D — acompanhamento c/ insulina',
};

const DESFECHO_LABEL: Record<string, string> = {
  negativo: 'Negativo (afasta DMG)',
  '1': 'DMG confirmado pela glicemia de jejum',
  '6': 'DMG confirmado pelo GTT',
  '6B': 'DMG borderline (GTT, IG tardia)',
  '8': 'Overt DM',
  r1_manter: 'Regra 1 — manter dieta + exercício',
  r2_reforcar: 'Regra 2 — reforçar adesão (aceita)',
  r2_insulina: 'Regra 2 — recusa → insulina',
  r3_insulina: 'Regra 3 — iniciar insulina',
  r4a_fichae: 'Regra 4a — memória confirma (Ficha E)',
  r4_reforcar: 'Regra 4 — reforçar, mantém 4 pontos',
  r4b_insulina: 'Regra 4b — memória não confirma → insulina',
  '2': 'Controle adequado (fallback)',
  '3': 'Controle inadequado → insulina (fallback)',
  '4': 'Controle adequado com insulina',
};

const BLOCO_LABEL: Record<string, string> = {
  justificativa: 'Justificativa Científica',
  conduta: 'Conduta Orientativa',
  nota_tardio: 'Nota — diagnóstico tardio',
};

export function labelTipo(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo;
}
export function labelDesfecho(desfecho: string): string {
  return DESFECHO_LABEL[desfecho] ?? desfecho;
}
export function labelBloco(bloco: string): string {
  return BLOCO_LABEL[bloco] ?? bloco;
}

/** Rótulo do cenário (tipo + desfecho) para agrupar a lista. */
export function labelCenario(tipo: string, desfecho: string): string {
  return `${labelTipo(tipo)} · ${labelDesfecho(desfecho)}`;
}

/**
 * Extrai as variáveis [entre colchetes] presentes num texto — usado para sinalizar
 * variáveis desconhecidas (digitadas errado) ao editar.
 */
export function extrairVariaveis(texto: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) out.push(m[1].trim());
  return out;
}

const CHAVES_VALIDAS = new Set(VARIAVEIS_LAUDO.map((v) => v.chave));

/** Variáveis usadas no texto que NÃO existem na legenda (provável erro de digitação). */
export function variaveisDesconhecidas(texto: string): string[] {
  return [...new Set(extrairVariaveis(texto).filter((c) => !CHAVES_VALIDAS.has(c)))];
}

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

/**
 * Ajuda por cenário (tooltip): quando a situação ocorre e o que o texto deve
 * transmitir. Baseado no motor de decisão (fichaADecisao) e nos textos do seed.
 * Ficha C usa a mesma ajuda de Ficha A; Ficha D, a de Ficha B.
 * RASCUNHO técnico — revisar com as especialistas.
 */
const AJUDA_CENARIO: Record<string, string> = {
  'retorno_1::negativo':
    'Retorno 1 com glicemia de jejum abaixo de 92 mg/dL: NÃO há DMG neste momento. O texto deve orientar seguir o pré-natal e realizar o GTT 75g entre 24 e 28 semanas.',
  'retorno_1::1':
    'Retorno 1 com glicemia de jejum entre 92 e 125 mg/dL: DMG confirmado. O texto confirma o diagnóstico e orienta iniciar o tratamento (dieta, exercício e monitorização de 4 pontos).',
  'retorno_1::6':
    'Rede de segurança — Retorno 1 com DMG confirmado pela glicemia de jejum (mesmo conteúdo do cenário "DMG confirmado pela glicemia de jejum").',
  'retorno_1::8':
    'Retorno 1 com glicemia de jejum igual ou acima de 126 mg/dL: Overt DM (diabetes diagnosticado na gestação). O texto confirma e orienta tratamento imediato.',
  'gtt::negativo':
    'GTT 75g normal (a partir de 24 semanas): afasta o DMG. O texto encerra a investigação — sem tratamento e sem repetir o exame.',
  'gtt::6':
    'GTT 75g com pelo menos um valor alterado: DMG confirmado. O texto confirma o diagnóstico e orienta iniciar o tratamento.',
  'gtt::6B':
    'GTT 75g positivo com idade gestacional tardia (acima de 28 semanas): DMG. O texto reforça que o início do tratamento é urgente.',
  'gtt::8':
    'GTT 75g com valores de Overt DM. O texto confirma o diagnóstico e orienta tratamento imediato.',
  'ficha_a::r1_manter':
    'Retorno 2 com pelo menos 70% das glicemias na meta, boa adesão (dieta, exercício e peso) e indicadores fetais normais: manter dieta e exercício, sem insulina.',
  'ficha_a::r2_reforcar':
    'Retorno 2 com menos de 70% na meta e falha de adesão, mas a gestante pactua melhorar: reforçar a adesão e manter o perfil de 4 pontos (ainda sem insulina).',
  'ficha_a::r2_insulina':
    'Retorno 2 com menos de 70% na meta e falha de adesão, e a gestante RECUSA pactuar: indicar insulina. (texto em rascunho do assistente — validar)',
  'ficha_a::r3_insulina':
    'Retorno 2 com menos de 70% na meta apesar de boa adesão: dieta e exercício foram insuficientes, então iniciar insulina.',
  'ficha_a::r4a_fichae':
    'Retorno 2 com pelo menos 70% na meta, porém com falha de adesão/ganho de peso (ou sinal fetal), e a memória do glicosímetro CONFIRMA o controle: ampliar para o perfil de 6 pontos (Ficha E), sem insulina ainda.',
  'ficha_a::r4_reforcar':
    'Retorno 2 com pelo menos 70% na meta, falha de adesão e memória que NÃO confirma, mas a gestante aceita reforçar: manter o perfil de 4 pontos e reavaliar. (texto em rascunho — validar)',
  'ficha_a::r4b_insulina':
    'Retorno 2 com pelo menos 70% na meta, falha de adesão, memória que NÃO confirma e a gestante RECUSA: iniciar insulina.',
  'ficha_a::2':
    'Rede de segurança — controle adequado quando o sistema não calculou a conduta detalhada (mesmo texto da Regra 1 — manter).',
  'ficha_a::3':
    'Rede de segurança — controle inadequado com insulina quando o sistema não calculou a conduta detalhada (mesmo texto da Regra 3 — insulina).',
  'ficha_b::4':
    'Acompanhamento com insulina (perfil de 6 pontos) e pelo menos 70% na meta: manter a dose atual de insulina, a dieta e o exercício.',
};

/** Ajuda contextual do cenário (tooltip). Ficha C↔A e Ficha D↔B compartilham. */
export function ajudaCenario(tipo: string, desfecho: string): string | null {
  const t = tipo === 'ficha_c' ? 'ficha_a' : tipo === 'ficha_d' ? 'ficha_b' : tipo;
  return AJUDA_CENARIO[`${t}::${desfecho}`] ?? null;
}

/**
 * Cenários técnicos/legados (redes de segurança) que NÃO aparecem no editor —
 * continuam no banco, mas somem da UI de edição para não confundir:
 *  - (retorno_1, '6'): resíduo do bug do #23 — Retorno 1 que recebia código de GTT;
 *    é cópia do '1' (DMG pela glicemia de jejum).
 *  - (ficha_a/c, '2'|'3'): fallbacks usados só quando a conduta não foi computada
 *    (cópias da Regra 1 e da Regra 3).
 */
export function cenarioTecnicoOculto(tipo: string, desfecho: string): boolean {
  if (tipo === 'retorno_1' && desfecho === '6') return true;
  if ((tipo === 'ficha_a' || tipo === 'ficha_c') && (desfecho === '2' || desfecho === '3')) return true;
  return false;
}

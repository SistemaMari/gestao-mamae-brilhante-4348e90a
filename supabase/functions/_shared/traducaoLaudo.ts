// Tradução automática dos textos de laudo (PT → EN/ES) — regras compartilhadas
// entre a Edge Function `traduzir-laudo-texto` e os testes (vitest).
//
// Regra de ouro: as variáveis [entre colchetes] NÃO são traduzidas. O laudo
// substitui as variáveis pelo nome em português nos 3 idiomas (ex.:
// "[data do próximo retorno]" aparece igual no texto em inglês e espanhol).

export const IDIOMAS_TRADUCAO = ["en-US", "es"] as const;
export type IdiomaTraducao = (typeof IDIOMAS_TRADUCAO)[number];

export interface TextoTraduzido {
  titulo: string;
  texto: string;
}
export type Traducoes = Record<IdiomaTraducao, TextoTraduzido>;

export const PROMPT_TRADUCAO = `Você traduz textos de laudos médicos da MARI, um sistema de acompanhamento de diabetes mellitus gestacional (DMG) usado por obstetras.

Traduza o texto em português do Brasil para inglês (en-US) e para espanhol (es), em linguagem clínica formal, como um médico especialista escreveria num laudo.

Regras obrigatórias:
1. Tudo que estiver entre colchetes é uma VARIÁVEL do sistema: copie exatamente igual, em português, sem traduzir nem alterar nada dentro dos colchetes. Ex.: "[data do próximo retorno]" continua "[data do próximo retorno]" nas duas traduções. Cada variável deve aparecer na tradução o mesmo número de vezes que no original.
2. Preserve a estrutura: quebras de linha, linhas em branco, marcadores (">>", "—", "(1)", "(2)"), MAIÚSCULAS de ênfase, números, doses, unidades (mg/dL, g, UI) e frações (⅔, ⅓, 2/3).
3. Use a terminologia médica consagrada em cada idioma: DMG = GDM (inglês) e DMG (espanhol); GTT 75g = 75g OGTT (inglês) e PTOG 75g (espanhol); USG = ultrasound/US (inglês) e ecografía (espanhol); IG = GA (inglês) e EG (espanhol).
4. "MARI" é o nome do sistema: não traduza.
5. Não acrescente, não resuma e não omita conteúdo. Não inclua comentários.
6. Se o título vier vazio, devolva o título vazio nas duas línguas.`;

/** JSON Schema da saída estruturada (output_config.format). */
export const SCHEMA_TRADUCAO = {
  type: "object",
  properties: {
    en: {
      type: "object",
      properties: { titulo: { type: "string" }, texto: { type: "string" } },
      required: ["titulo", "texto"],
      additionalProperties: false,
    },
    es: {
      type: "object",
      properties: { titulo: { type: "string" }, texto: { type: "string" } },
      required: ["titulo", "texto"],
      additionalProperties: false,
    },
  },
  required: ["en", "es"],
  additionalProperties: false,
} as const;

export function montarPedidoTraducao(titulo: string, texto: string): string {
  return `TÍTULO:\n${titulo}\n\nTEXTO:\n${texto}`;
}

/** Variáveis [entre colchetes] do texto, com repetição, em ordem alfabética. */
export function variaveisDoTexto(texto: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) out.push(m[1].trim());
  return out.sort();
}

/**
 * Confere se a tradução manteve exatamente as mesmas variáveis do original
 * (mesmos nomes, mesma quantidade). Devolve as diferenças, para a mensagem de erro.
 */
export function conferirVariaveis(original: string, traduzido: string): { faltando: string[]; sobrando: string[] } {
  const restante = [...variaveisDoTexto(traduzido)];
  const faltando: string[] = [];
  for (const v of variaveisDoTexto(original)) {
    const i = restante.indexOf(v);
    if (i === -1) faltando.push(v);
    else restante.splice(i, 1);
  }
  return { faltando, sobrando: restante };
}

/**
 * Lê a resposta estruturada do modelo e valida as variáveis nas duas línguas.
 * Lança erro com `codigo` quando a tradução não pode ser usada.
 */
export function validarTraducoes(textoOriginal: string, bruto: unknown): Traducoes {
  const r = bruto as { en?: Partial<TextoTraduzido>; es?: Partial<TextoTraduzido> } | null;
  const ler = (t?: Partial<TextoTraduzido>): TextoTraduzido | null =>
    t && typeof t.texto === "string" && t.texto.trim()
      ? { titulo: typeof t.titulo === "string" ? t.titulo.trim() : "", texto: t.texto }
      : null;
  const en = ler(r?.en);
  const es = ler(r?.es);
  if (!en || !es) throw Object.assign(new Error("Resposta sem tradução"), { codigo: "resposta_invalida" });

  const problemas: string[] = [];
  for (const [idioma, t] of [["en-US", en], ["es", es]] as const) {
    const { faltando, sobrando } = conferirVariaveis(textoOriginal, t.texto);
    if (faltando.length) problemas.push(`${idioma} sem ${faltando.map((v) => `[${v}]`).join(", ")}`);
    if (sobrando.length) problemas.push(`${idioma} com ${sobrando.map((v) => `[${v}]`).join(", ")} a mais`);
  }
  if (problemas.length) {
    throw Object.assign(new Error(`Variáveis alteradas na tradução: ${problemas.join("; ")}`), {
      codigo: "variaveis_alteradas",
    });
  }
  return { "en-US": en, es };
}

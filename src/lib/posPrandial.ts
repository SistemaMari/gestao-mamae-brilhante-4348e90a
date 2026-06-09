// 35B — Pactuação pós-prandial (1h vs 2h).
// Centraliza as constantes clínicas da janela pós-prandial usadas nas fichas A/B/C/D
// e nas grades read-only do histórico/laudo. Jejum e pré-prandiais não passam por aqui.

export type JanelaPosPrandial = '1h' | '2h';

/** Meta da glicemia pós-prandial conforme a janela pactuada: 1h → < 140, 2h → < 120. */
export function metaPosPrandial(janela: JanelaPosPrandial): number {
  return janela === '2h' ? 120 : 140;
}

/** Prefixo curto exibido no cabeçalho das colunas ("1h" / "2h"). */
export function prefixoHora(janela: JanelaPosPrandial): string {
  return janela === '2h' ? '2h' : '1h';
}

/** Forma por extenso, para textos de apoio e tooltips ("1 hora" / "2 horas"). */
export function horaExtenso(janela: JanelaPosPrandial): string {
  return janela === '2h' ? '2 horas' : '1 hora';
}

/** Rótulo de uma coluna pós-prandial, ex.: "2h pós almoço". */
export function rotuloPosPrandial(refeicao: 'café' | 'almoço' | 'jantar', janela: JanelaPosPrandial): string {
  return `${prefixoHora(janela)} pós ${refeicao}`;
}

/** Tooltip (ℹ) das colunas pós-prandiais, com a hora e a meta da janela escolhida. */
export function tooltipPosPrandial(janela: JanelaPosPrandial): string {
  return `Coleta exatamente ${horaExtenso(janela)} após o início da refeição. Meta: < ${metaPosPrandial(janela)} mg/dL. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.`;
}

/** Coage um valor vindo do banco/localStorage para a união. Default seguro: '1h'. */
export function normalizarJanela(value: string | null | undefined): JanelaPosPrandial {
  return value === '2h' ? '2h' : '1h';
}

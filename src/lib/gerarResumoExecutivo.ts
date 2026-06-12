import type {
  PainelOperacao,
  PainelPerfilClinico,
  PainelGargalos,
  PainelTendencia,
} from './painelEstrategicoTypes';

export interface ResumoExecutivoInput {
  unidadeNome: string;
  operacao: PainelOperacao;
  perfil: PainelPerfilClinico;
  gargalos: PainelGargalos;
}

export function gerarResumoExecutivo(input: ResumoExecutivoInput): string[] {
  const { unidadeNome, operacao, perfil, gargalos } = input;
  const frases: string[] = [];

  // Frase 1 — sempre
  frases.push(
    `A unidade ${unidadeNome} acompanha ${operacao.gestantes_ativas} gestante${operacao.gestantes_ativas === 1 ? '' : 's'} ativa${operacao.gestantes_ativas === 1 ? '' : 's'} e gerou ${operacao.laudos_30d} laudo${operacao.laudos_30d === 1 ? '' : 's'} nos últimos 30 dias.`,
  );

  // Frase 2 — prevalência
  const prev = perfil.prevalencia_pct;
  let qualificadorPrev = '';
  if (prev < 7) qualificadorPrev = ' — abaixo da faixa Febrasgo (7–18%), pode indicar subdiagnóstico';
  else if (prev > 18) qualificadorPrev = ' — acima da faixa Febrasgo (7–18%), sugere população de alto risco';
  else qualificadorPrev = ' — dentro da faixa Febrasgo (7–18%)';
  frases.push(
    `A prevalência atual de DMG é de ${prev}% (${perfil.total_dmg_confirmadas} de ${perfil.total_acompanhadas})${qualificadorPrev}.`,
  );

  // Frase 3 — gargalos (só se houver)
  const totalGargalos =
    gargalos.sem_gj_primeira_consulta.count +
    gargalos.atrasadas_gtt.count +
    gargalos.confirmadas_sem_retorno.count;
  if (totalGargalos > 0) {
    const partes: string[] = [];
    if (gargalos.sem_gj_primeira_consulta.count > 0)
      partes.push(`${gargalos.sem_gj_primeira_consulta.count} sem glicemia de jejum`);
    if (gargalos.atrasadas_gtt.count > 0)
      partes.push(`${gargalos.atrasadas_gtt.count} com GTT 75g em atraso`);
    if (gargalos.confirmadas_sem_retorno.count > 0)
      partes.push(`${gargalos.confirmadas_sem_retorno.count} com DMG confirmado sem retorno`);
    frases.push(
      `Foram identificados ${totalGargalos} caso${totalGargalos === 1 ? '' : 's'} em gargalos de cuidado: ${partes.join(', ')}.`,
    );
  }

  // Frase 4 — IG ao diagnóstico tardio
  if (perfil.ig_media_diagnostico_dias != null && perfil.ig_media_diagnostico_dias > 196) {
    const w = Math.floor(perfil.ig_media_diagnostico_dias / 7);
    const d = perfil.ig_media_diagnostico_dias % 7;
    frases.push(
      `Atenção: a IG média ao diagnóstico está em ${w}s ${d}d, acima da janela ideal Febrasgo (24–28 semanas) — diagnóstico tardio reduz tempo de tratamento.`,
    );
  }

  return frases;
}

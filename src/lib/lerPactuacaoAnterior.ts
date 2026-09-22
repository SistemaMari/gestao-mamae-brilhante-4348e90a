/**
 * V4 (set/2026) · etapa 2 — leitura da pactuação registrada na CONSULTA ANTERIOR.
 *
 * Cada consulta pode gravar, no seu laudo, a "pactuação do próximo perfil"
 * (janela pós-prandial + início + fim + nº de pontos). A ficha SEGUINTE
 * (Ficha A/C ou Ficha E) lê essa pactuação aqui e usa para pré-preencher os
 * campos do topo. O usuário confirma ou edita.
 *
 * Regra de escolha: pega a pactuação MAIS RECENTE nas consultas passadas que
 * tenha o nº de pontos casando com a ficha atual (4 = A/C; 6 = E).
 *
 * Consultas sem pactuação (as do fluxo antigo, antes da etapa 1) simplesmente
 * não têm o campo preenchido — a busca as ignora.
 */

/**
 * Assinatura mínima que precisamos das consultas — evita casar com o tipo
 * gerado do Supabase (que pode ou não ter as colunas novas dependendo do
 * momento do bundle). Aceita `PreviewConsulta` também.
 */
export interface ConsultaComPactuacao {
  id?: string;
  created_at?: string | null;
  pactuou_janela_prox_perfil?: '1h' | '2h' | string | null;
  pactuou_inicio_prox_perfil?: string | null;
  pactuou_fim_prox_perfil?: string | null;
  pactuou_pontos_prox_perfil?: number | null;
}

export interface PactuacaoLida {
  janela: '1h' | '2h';
  /** yyyy-MM-dd */
  inicio: string;
  /** yyyy-MM-dd */
  fim: string;
  pontos: 4 | 6;
}

/**
 * Devolve a pactuação vigente para uma ficha nova de `pontosDesejados` pontos,
 * ou null se nenhuma consulta anterior gravou uma que sirva.
 *
 * "Vigente" = a de created_at mais recente dentre as que casam com pontos
 * desejados. A ordem de `consultas` na chamada é irrelevante — a função ordena.
 */
export function lerPactuacaoAnterior(
  consultas: ReadonlyArray<ConsultaComPactuacao>,
  pontosDesejados: 4 | 6,
): PactuacaoLida | null {
  const candidatas = consultas.filter(
    (c) =>
      (c.pactuou_janela_prox_perfil === '1h' || c.pactuou_janela_prox_perfil === '2h') &&
      typeof c.pactuou_inicio_prox_perfil === 'string' &&
      typeof c.pactuou_fim_prox_perfil === 'string' &&
      c.pactuou_pontos_prox_perfil === pontosDesejados,
  );
  if (candidatas.length === 0) return null;

  // Ordena por created_at desc; empate mantém a ordem do array (estável).
  const ordenadas = [...candidatas].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });

  const c = ordenadas[0];
  return {
    janela: c.pactuou_janela_prox_perfil as '1h' | '2h',
    inicio: c.pactuou_inicio_prox_perfil as string,
    fim: c.pactuou_fim_prox_perfil as string,
    pontos: pontosDesejados,
  };
}

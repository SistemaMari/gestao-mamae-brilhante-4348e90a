/**
 * Mapeamento de cenários do laudo (Prompt 15 / 16)
 * 1  – Rastreio inicial (Caso Novo) e DMG confirmado pela glicemia de jejum
 * 2  – Ficha A/C controle adequado (≥70%, 4 pontos)
 * 3  – Ficha A/C controle inadequado (<70%, 4 pontos)
 * 4  – Ficha B/D controle adequado (≥70%, 6 pontos)
 * 5  – Registro do parto (encerramento)
 * 6  – DMG confirmado por GTT 75g positivo
 * 6B – DMG confirmado por GTT 75g borderline
 * 7  – Ficha B/D controle inadequado (<70%, 6 pontos) → endócrino
 * 8  – Encaminhada endócrino (Retorno 1)
 * negativo – Resultado afastou DMG
 */
export type Cenario = 1 | 2 | 3 | 4 | 5 | 6 | '6B' | 7 | 8 | 'negativo';

export interface ConsultaParaMapear {
  tipo: string;
  status_gerado?: string | null;
  decisao?: string | null;
  percentual_meta?: number | null;
  cenario_clinico?: string | null;
  // 34D-C: usados só para Ficha A/C — desfecho por conduta (vêm de decisoes_ficha_a).
  regra_aplicada?: string | null;
  proxima_ficha_recomendada?: string | null;
}

export function mapearCenario(c: ConsultaParaMapear): Cenario {
  switch (c.tipo) {
    case 'consulta_1':
      return c.status_gerado === 'dmg_afastado' ? 'negativo' : 1;

    case 'retorno_1':
      if (c.status_gerado === 'dmg_afastado') return 'negativo';
      if (c.status_gerado === 'encaminhada_endocrino') return 8;
      // 34D-C: DMG confirmado pela glicemia de jejum = Cenário 1 (é o que o form
      // grava como cenario_clinico='1' e o que as especialistas chamam de
      // "Cenário 1"). Antes devolvia 6 (DMG por GTT) — resíduo do '1 vs 6'.
      return 1;

    case 'gtt': {
      if (c.status_gerado === 'dmg_afastado') return 'negativo';
      // 38C #23: roteia pelo cenario_clinico do próprio registro (6 / 6B /
      // negativo). O tipo sozinho não distingue 6 de 6B — nunca hardcodar.
      const cen = (c.cenario_clinico ?? '').trim();
      if (cen === 'negativo') return 'negativo';
      if (cen === '6B') return '6B';
      if (cen === '6') return 6;
      // Sem cenario_clinico gravado (registro legado): GTT 75g positivo = DMG
      // confirmado, sem afirmar borderline.
      return 6;
    }

    case 'ficha_a':
    case 'ficha_c':
      return (c.percentual_meta ?? 0) >= 70 ? 2 : 3;

    case 'ficha_b':
    case 'ficha_d':
      return (c.percentual_meta ?? 0) >= 70 ? 4 : 7;

    case 'registro_parto':
    case 'resultado_parto':
      return 5;

    default:
      return 1;
  }
}

/**
 * 34D-C — Chave de laudo da Ficha A/C por CONDUTA. Espelha o roteamento de
 * `fichaADecisao.ts`: cada (regra_aplicada + proxima_ficha_recomendada) vira um
 * desfecho próprio, para cada conduta ter seu texto. Sem isso, R1/R4a/R4b
 * (cenário 2) e R2/R3 (cenário 3) dividiriam o mesmo laudo.
 */
function chaveCondutaFichaA(
  regra: string | null | undefined,
  proxima: string | null | undefined,
): string | null {
  const insulina = proxima === 'ficha_b' || proxima === 'ficha_d';
  switch (regra) {
    case 'regra_manter': return 'r1_manter';
    case 'regra_2':      return insulina ? 'r2_insulina' : 'r2_reforcar';
    case 'regra_3':      return 'r3_insulina';
    case 'regra_4':
      if (proxima === 'ficha_e') return 'r4a_fichae';
      return insulina ? 'r4b_insulina' : 'r4_reforcar';
    default: return null;
  }
}

/**
 * Deriva o `desfecho_clinico` (chave de `laudo_textos`) para uma consulta,
 * usado como parâmetro da Edge Function `obter-textos-laudo` (34D-B).
 *
 * Fonte primária: `consulta.cenario_clinico` — gravado pelos forms na forma
 * curta ('1'..'8', '6B', '5'), que é exatamente o que o backend (34D-A)
 * normaliza via `normalizarCenario`.
 *
 * Fallback determinístico: `mapearCenario` — necessário para o Caso Novo
 * (`consulta_1`), que não grava `cenario_clinico` mas tem desfecho definido
 * (rastreio inicial = '1', ou 'negativo' se DMG afastado).
 *
 * Retorna `null` quando o desfecho ainda não foi calculado (ficha incompleta):
 * nesse caso o 34D-B exige exibir a mensagem de orientação SEM chamar a Edge
 * Function (critério 9).
 */
export function derivarDesfechoClinico(
  c: ConsultaParaMapear & { cenario_clinico?: string | null },
): string | null {
  // 34D-C: Ficha A/C → chave por CONDUTA (regra + próxima ficha), não pelo
  // cenário grosso '2'/'3'. Se a decisão ainda não foi computada, cai no cenário.
  if (c.tipo === 'ficha_a' || c.tipo === 'ficha_c') {
    const chaveConduta = chaveCondutaFichaA(c.regra_aplicada, c.proxima_ficha_recomendada);
    if (chaveConduta) return chaveConduta;
  }

  const raw = (c.cenario_clinico ?? '').trim();
  if (raw) return raw;

  // 34D-C: GJ negativa (Retorno 1 aguardando GTT) → 'negativo'. Sem isto, o
  // fallback de mapearCenario devolvia '6' (DMG), escondendo o texto correto.
  if (c.tipo === 'retorno_1' && c.status_gerado === 'aguardando_gtt') return 'negativo';

  const cen = mapearCenario(c);
  if (cen === 'negativo') return 'negativo';
  // Caso Novo e Retorno 1 são determinísticos mesmo sem `cenario_clinico`
  // gravado: a glicemia de jejum sozinha já fecha o desfecho.
  if (c.tipo === 'consulta_1' || c.tipo === 'retorno_1') return String(cen);

  // Demais tipos sem `cenario_clinico` → diagnóstico ainda não calculado.
  return null;
}

export function cenarioLabel(cenario: Cenario): string {
  const map: Record<string, string> = {
    '1': 'Cenário 1 — Rastreio inicial',
    '2': 'Cenário 2 — Controle adequado (4 pontos)',
    '3': 'Cenário 3 — Controle inadequado (4 pontos)',
    '4': 'Cenário 4 — Controle adequado com insulina',
    '5': 'Cenário 5 — Encerramento (parto)',
    '6': 'Cenário 6 — DMG confirmado',
    '6B': 'Cenário 6B — DMG borderline',
    '7': 'Cenário 7 — Encaminhada ao endócrino',
    '8': 'Cenário 8 — Encaminhada (Retorno 1)',
    'negativo': 'DMG afastado',
  };
  return map[String(cenario)] ?? `Cenário ${cenario}`;
}

/** Cenários que NÃO renderizam "Próxima ficha" */
export function semProximaFicha(cenario: Cenario): boolean {
  return cenario === 5 || cenario === 7 || cenario === 'negativo';
}

/**
 * Cenários "card-only": o laudo é 100% o card de resultado (bloco 1), sem blocos
 * textuais 2/3 em `laudo_textos` — logo NÃO deve exibir o placeholder
 * "Texto pendente — solicitar ao time clínico". São eles:
 *  - Caso Novo (`consulta_1`): o laudo é o "Pedido de exame";
 *  - Parto (cenário 5): card de registro/encerramento do parto;
 *  - Encerramento por controle inadequado com insulina (Ficha B/D < 70% =
 *    cenário 7): card de referenciamento ao endócrino.
 * Os demais cenários têm texto publicado (diagnósticos, Ficha A/C, Ficha B/D ≥70%).
 */
export function cenarioSemTextoLaudo(c: ConsultaParaMapear): boolean {
  if (c.tipo === 'consulta_1') return true;
  const cen = mapearCenario(c);
  return cen === 5 || cen === 7;
}

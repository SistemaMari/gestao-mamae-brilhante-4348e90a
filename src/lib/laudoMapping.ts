/**
 * Mapeamento de cenários do laudo (Prompt 15 / 16)
 * 1  – Caso Novo → DMG afastado / aguardando GTT
 * 2  – Ficha A/C controle adequado (≥70%, 4 pontos)
 * 3  – Ficha A/C controle inadequado (<70%, 4 pontos)
 * 4  – Ficha B/D controle adequado (≥70%, 6 pontos)
 * 5  – Registro do parto (encerramento)
 * 6  – DMG confirmado (Retorno 1 ou GTT positivo)
 * 6B – DMG confirmado por GTT borderline
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
}

export function mapearCenario(c: ConsultaParaMapear): Cenario {
  switch (c.tipo) {
    case 'consulta_1':
      return c.status_gerado === 'dmg_afastado' ? 'negativo' : 1;

    case 'retorno_1':
      if (c.status_gerado === 'dmg_afastado') return 'negativo';
      if (c.status_gerado === 'encaminhada_endocrino') return 8;
      return 6;

    case 'retorno_gtt':
      if (c.status_gerado === 'dmg_afastado') return 'negativo';
      // 6B reservado para borderline — heurística simples por ora
      return 6;

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
  const raw = (c.cenario_clinico ?? '').trim();
  if (raw) return raw;

  const cen = mapearCenario(c);
  if (cen === 'negativo') return 'negativo';
  // Caso Novo é determinístico mesmo sem `cenario_clinico` gravado.
  if (c.tipo === 'consulta_1') return String(cen);

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

import { format } from 'date-fns';

/**
 * Substituição das variáveis [entre colchetes] dos textos de `laudo_textos`.
 *
 * Os textos escritos pelas especialistas (34D-A) são MODELOS: trazem variáveis
 * como `[nome da paciente]`, `[glicemia de jejum]`, `[% na meta]` etc. que devem
 * ser preenchidas com os dados da paciente/consulta. Até então o
 * `BlocosTextoLaudo` renderizava o texto cru (34D-B §3.5.2, "sem injeção de
 * variáveis") e os colchetes apareciam LITERAIS em produção — esta lib reabilita
 * a substituição conscientemente.
 *
 * Decisão de fallback (Suellen, 2026-06-15): valor ausente → MARCADOR neutro,
 * NUNCA colchete literal nem número inventado. Toda ausência é logada
 * (`console.warn`) para ser flagrável na validação.
 */

/** IG na forma usada pelo hook `useIg` / RPC `calcular_ig`. */
export type IgInfo = { semanas: number; dias: number } | null | undefined;

/** Mapa de variável → valor já formatado (string). null/undefined/'' → marcador. */
export type VariaveisLaudo = Record<string, string | null | undefined>;

/** Marcador clínico para valor ausente — decisão: marcador neutro, auto-explicativo. */
export const MARCADOR_AUSENTE = '(não informado)';

/**
 * Resolve toda ocorrência de `[chave]` no texto:
 *  - chave conhecida COM valor   → o valor;
 *  - chave conhecida SEM valor    → MARCADOR_AUSENTE (+ warn);
 *  - chave desconhecida           → MARCADOR_AUSENTE (+ warn) — pega erro de
 *                                   digitação no texto do banco.
 * Nunca deixa colchete literal escapar para produção.
 */
export function aplicarVariaveisLaudo(texto: string, vars: VariaveisLaudo): string {
  if (!texto) return texto;
  return texto.replace(/\[([^\]]+)\]/g, (_match, chaveRaw: string) => {
    const chave = chaveRaw.trim();
    const conhecida = Object.prototype.hasOwnProperty.call(vars, chave);
    const valor = conhecida ? vars[chave] : undefined;

    if (valor != null && String(valor).trim() !== '') {
      return String(valor);
    }

    // Observabilidade: ausência de valor é sempre registrada.
    console.warn(
      conhecida
        ? `[laudo] variável "${chave}" sem valor — usando marcador "${MARCADOR_AUSENTE}"`
        : `[laudo] variável desconhecida "${chave}" no texto — usando marcador "${MARCADOR_AUSENTE}"`,
    );
    return MARCADOR_AUSENTE;
  });
}

// ── Formatadores ────────────────────────────────────────────────────────────

/** "22 semanas e 3 dias" / "22 semanas" (quando dias = 0). */
function fmtIg(ig: IgInfo): string | null {
  if (!ig || ig.semanas == null || ig.dias == null) return null;
  const base = `${ig.semanas} semanas`;
  if (ig.dias <= 0) return base;
  return `${base} e ${ig.dias} ${ig.dias === 1 ? 'dia' : 'dias'}`;
}

/** Data ISO 'yyyy-MM-dd' → 'dd/MM/yyyy' sem shift de fuso (datas locais). */
function fmtDataISO(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Número em pt-BR (vírgula decimal). null/NaN → null. */
function fmtNum(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(n)) return null;
  return n.toLocaleString('pt-BR');
}

/** Dose de insulina com unidade: "20 UI". */
function fmtDose(n: number | null | undefined): string | null {
  const s = fmtNum(n);
  return s == null ? null : `${s} UI`;
}

/** Percentual inteiro (sem o símbolo — o "%" já está no texto). */
function fmtPercent(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(n)) return null;
  return String(Math.round(n));
}

// ── Montagem do mapa ──────────────────────────────────────────────────────────

/** Subconjunto do objeto de consulta hidratado em FichaPacientePage relevante ao laudo. */
export interface DadosConsultaLaudo {
  tipo?: string | null;
  retorno1_valor_gj?: number | null;
  gtt_jejum?: number | null;
  gtt_1h?: number | null;
  gtt_2h?: number | null;
  total_preenchidos?: number | null;
  percentual_meta?: number | null;
  dose_total?: number | null;
  dose_manha?: number | null;
  dose_noite?: number | null;
  data_proximo_retorno?: string | null;
}

/**
 * Monta o mapa de variáveis a partir dos dados JÁ hidratados na página.
 * `ig` é a IG ao vivo da consulta (na data da consulta, âncora atual — 34D);
 * para a consulta de GTT essa IG já é o "[IG no GTT]".
 */
export function montarVariaveisLaudo(params: {
  paciente: { nome: string };
  consulta: DadosConsultaLaudo;
  ig: IgInfo;
  janelaGTT?: { inicio: Date; fim: Date } | null;
}): VariaveisLaudo {
  const { paciente, consulta, ig, janelaGTT } = params;
  const igTexto = fmtIg(ig);

  return {
    'nome da paciente': paciente?.nome ?? null,
    'IG': igTexto,
    'IG no GTT': igTexto,
    'glicemia de jejum': fmtNum(consulta.retorno1_valor_gj),
    'GTT jejum': fmtNum(consulta.gtt_jejum),
    'GTT 1h': fmtNum(consulta.gtt_1h),
    'GTT 2h': fmtNum(consulta.gtt_2h),
    'janela GTT início': janelaGTT ? format(janelaGTT.inicio, 'dd/MM/yyyy') : null,
    'janela GTT fim': janelaGTT ? format(janelaGTT.fim, 'dd/MM/yyyy') : null,
    'data do próximo retorno': fmtDataISO(consulta.data_proximo_retorno),
    'dias preenchidos': fmtNum(consulta.total_preenchidos),
    '% na meta': fmtPercent(consulta.percentual_meta),
    'dose total de insulina': fmtDose(consulta.dose_total),
    'dose atual de insulina': fmtDose(consulta.dose_total),
    'dose manhã': fmtDose(consulta.dose_manha),
    'dose noite': fmtDose(consulta.dose_noite),
  };
}

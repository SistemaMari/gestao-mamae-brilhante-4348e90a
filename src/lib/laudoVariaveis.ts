import { addDays, format } from 'date-fns';
import { parseDateLocal } from '@/lib/dateUtils';
import { calcularIntervaloRetornoDias } from '@/lib/retornoInterval';

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
  id?: string;
  tipo?: string | null;
  data?: string | null;
  retorno1_valor_gj?: number | null;
  gtt_jejum?: number | null;
  gtt_1h?: number | null;
  gtt_2h?: number | null;
  total_preenchidos?: number | null;
  percentual_meta?: number | null;
  dose_total?: number | null;
  dose_manha?: number | null;
  dose_noite?: number | null;
}

/**
 * Monta o mapa de variáveis a partir dos dados JÁ hidratados na página.
 * `ig` é a IG ao vivo da consulta (na data da consulta, âncora atual — 34D);
 * para a consulta de GTT essa IG já é o "[IG no GTT]".
 */
const TIPOS_PERFIL = ['ficha_a', 'ficha_c', 'ficha_b', 'ficha_d', 'ficha_e'];

/**
 * Data do próximo retorno PARA O LAUDO de uma consulta de perfil (Ficha A/C/B/D/E).
 * A coluna `data_proximo_retorno` existe só na tabela `pacientes` (uma data, a
 * "próxima") — então, no laudo de cada consulta, calculamos a data por consulta:
 * `data da consulta + intervalo da conduta`, replicando exatamente os forms
 * (via calcularIntervaloRetornoDias). Tipos sem retorno datado (Caso Novo,
 * diagnósticos) → null.
 */
export function calcularDataProximoRetornoLaudo(
  consulta: { id?: string; tipo?: string | null; data?: string | null },
  consultas: Array<{ id?: string; tipo?: string | null }>,
  igSemanas: number | null,
): string | null {
  const tipo = consulta.tipo ?? '';
  if (!TIPOS_PERFIL.includes(tipo)) return null;
  const d = consulta.data ? parseDateLocal(consulta.data) : null;
  if (!d) return null;

  // Espelha os forms: Ficha E = 7d; 1ª Ficha A/C (1º perfil) = 10d;
  // demais = 15d (≤30 sem) / 7d (>30 sem).
  const ehFichaE = tipo === 'ficha_e';
  const ehPrimeiroPerfil =
    (tipo === 'ficha_a' || tipo === 'ficha_c') &&
    !consultas.some((x) => x.id !== consulta.id && TIPOS_PERFIL.includes(x.tipo ?? ''));

  const dias = calcularIntervaloRetornoDias({ ehFichaE, ehPrimeiroPerfil, igSemanas });
  return format(addDays(d, dias), 'yyyy-MM-dd');
}

export function montarVariaveisLaudo(params: {
  paciente: { nome: string };
  consulta: DadosConsultaLaudo;
  consultas?: Array<{ id?: string; tipo?: string | null }>;
  ig: IgInfo;
  janelaGTT?: { inicio: Date; fim: Date } | null;
}): VariaveisLaudo {
  const { paciente, consulta, consultas = [], ig, janelaGTT } = params;
  const igTexto = fmtIg(ig);

  // Doses: usa as gravadas (motor da Ficha A) ou deriva ⅔ manhã / ⅓ noite da total
  // — mesma regra do motor (fichaADecisao) e do card (FichaACResultCard). Cobre
  // registros em que só a dose total foi persistida (peso informado pelo card).
  const doseTotal = consulta.dose_total ?? null;
  const doseManha =
    consulta.dose_manha ?? (doseTotal != null ? Math.round((doseTotal * 2 / 3) * 10) / 10 : null);
  const doseNoite =
    consulta.dose_noite ?? (doseTotal != null ? Math.round((doseTotal / 3) * 10) / 10 : null);

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
    'data do próximo retorno': fmtDataISO(
      calcularDataProximoRetornoLaudo(consulta, consultas, ig?.semanas ?? null),
    ),
    'dias preenchidos': fmtNum(consulta.total_preenchidos),
    '% na meta': fmtPercent(consulta.percentual_meta),
    'dose total de insulina': fmtDose(doseTotal),
    'dose atual de insulina': fmtDose(doseTotal),
    'dose manhã': fmtDose(doseManha),
    'dose noite': fmtDose(doseNoite),
  };
}

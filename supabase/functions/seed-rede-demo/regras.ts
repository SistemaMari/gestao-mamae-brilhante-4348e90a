// Regras clínicas usadas pela carga da Rede de Demonstração.
//
// NÃO são regras novas: são cópias fiéis das regras que as telas aplicam ao
// salvar cada ficha. Elas vivem dentro dos componentes React (não importáveis
// por uma edge function), por isso estão replicadas aqui com a origem anotada.
// O teste src/lib/seedRedeDemo.test.ts compara a cópia do motor da Ficha A com
// o original (src/lib/fichaADecisao.ts) para pegar qualquer divergência.
//
// O cenário calculado aqui é gravado em consultas.cenario_clinico exatamente
// como a ficha grava; o TEXTO do laudo continua vindo do gerar-laudo.

// ── Retorno 1 — src/components/Retorno1Form.tsx (calcularDiagnostico) ──────
// Só vale para glicemia plasmática.
export function diagnosticoRetorno1(gj: number): { cenario: string | null; statusFicha: string } {
  if (gj < 92) return { cenario: null, statusFicha: 'aguardando_gtt' };
  if (gj < 126) return { cenario: '1', statusFicha: 'dmg_confirmado' };
  return { cenario: '8', statusFicha: 'dmg_confirmado' };
}

// ── GTT 75g — src/components/GttForm.tsx (calcularGttDiagnostico) ──────────
export function diagnosticoGtt(
  jejum: number,
  h1: number | null,
  h2: number | null,
  igSemanas: number | null,
): { cenario: string | null; statusFicha: string } {
  if (jejum >= 126 || (h2 != null && h2 >= 200)) return { cenario: '8', statusFicha: 'dmg_confirmado' };
  const alterado = jejum >= 92 || (h1 != null && h1 >= 180) || (h2 != null && h2 >= 153);
  if (alterado) return { cenario: (igSemanas ?? 0) > 28 ? '6B' : '6', statusFicha: 'dmg_confirmado' };
  return { cenario: null, statusFicha: 'dmg_afastado' };
}

// ── Ficha A/C (4 pontos) — src/components/FichaACForm.tsx ──────────────────
export const PONTOS_4 = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
export type Ponto4 = typeof PONTOS_4[number];
const META_JEJUM = 95;

// src/lib/posPrandial.ts
export function metaPosPrandial(janela: '1h' | '2h'): number {
  return janela === '2h' ? 120 : 140;
}

// FichaACForm.tsx — useMemo do percentual (hipoglicemia < 70 conta fora da meta).
export function percentualNaMeta4Pontos(
  grid: Array<Partial<Record<Ponto4, number>>>,
  janela: '1h' | '2h',
): { total: number; ok: number; percentual: number | null; dias: number } {
  let total = 0;
  let ok = 0;
  let dias = 0;
  for (const row of grid) {
    let diaTemValor = false;
    for (const p of PONTOS_4) {
      const val = row[p];
      if (!val || val <= 0) continue;
      diaTemValor = true;
      total++;
      if (val > 0 && val < 70) continue;
      const meta = p === 'jejum' ? META_JEJUM : metaPosPrandial(janela);
      if (val < meta) ok++;
    }
    if (diaTemValor) dias++;
  }
  return { total, ok, percentual: total > 0 ? Math.round((ok / total) * 1000) / 10 : null, dias };
}

// src/lib/janelaCrescimentoFetal.ts + ChecklistRetorno2.tsx (fetaisAplicaveis)
export function fetaisAplicaveis(igSemanas: number | null): boolean {
  if (igSemanas == null) return true;
  return (igSemanas >= 28 && igSemanas < 33) || igSemanas >= 36;
}

// src/lib/retornoInterval.ts
export function calcularIntervaloRetornoDias(params: {
  ehFichaE: boolean;
  ehPrimeiroPerfil: boolean;
  igSemanas: number | null;
  regraAplicada?: string | null;
}): number {
  if (params.ehFichaE) return 7;
  if (params.regraAplicada === 'regra_2') return 7;
  if (params.ehPrimeiroPerfil) return 10;
  return (params.igSemanas ?? 0) > 30 ? 7 : 15;
}

// ── Motor de decisão da Ficha A — cópia de src/lib/fichaADecisao.ts ────────
export type Regra = 'regra_manter' | 'regra_2' | 'regra_3' | 'regra_4' | 'regra_fetal';
export type Conduta = 'manter_mev' | 'reforcar_mev' | 'insulina' | 'avaliar_memoria';
export type ProximaFicha = 'ficha_a' | 'ficha_b' | 'ficha_c' | 'ficha_d' | 'ficha_e';
export type FetalAnswer = 'sim' | 'nao' | 'sem_info' | null;

export interface ChecklistInput {
  checklist_dieta: boolean | null;
  checklist_exercicio: boolean | null;
  checklist_ganho_peso: boolean | null;
  checklist_pfe_us: FetalAnswer;
  checklist_ca: FetalAnswer;
  checklist_la: FetalAnswer;
  memoria_glicosimetro: 'confirma' | 'nao_confirma' | null;
  pactuacao_adesao: 'aceita' | 'recusa' | null;
}

export interface DecisaoResultado {
  regra_aplicada: Regra | null;
  conduta_gerada: Conduta | null;
  proxima_ficha_recomendada: ProximaFicha | null;
  dose_total: number | null;
  dose_manha: number | null;
  dose_noite: number | null;
  pendencias: string[];
}

export function aplicarRegrasFichaA(
  d: ChecklistInput,
  pct: number,
  peso: number | null,
  igSemanas: number | null,
  pactuacoesPrevias = 0,
): DecisaoResultado {
  const adesao_ok =
    d.checklist_dieta === true && d.checklist_exercicio === true && d.checklist_ganho_peso === true;
  const adesao_falhou =
    d.checklist_dieta === false || d.checklist_exercicio === false || d.checklist_ganho_peso === false;
  const fetal_nao =
    d.checklist_pfe_us === 'nao' || d.checklist_ca === 'nao' || d.checklist_la === 'nao';

  let regra: Regra | null = null;
  let conduta: Conduta | null = null;

  if (fetal_nao) {
    regra = 'regra_fetal';
    conduta = 'insulina';
  } else if (pct >= 70 && adesao_ok) {
    regra = 'regra_manter';
    conduta = 'manter_mev';
  } else if (pct < 70 && adesao_falhou) {
    regra = 'regra_2';
    conduta = pactuacoesPrevias > 0 ? 'insulina' : 'reforcar_mev';
  } else if (pct < 70 && adesao_ok) {
    regra = 'regra_3';
    conduta = 'insulina';
  } else if (pct >= 70 && adesao_falhou) {
    regra = 'regra_4';
    conduta = 'avaliar_memoria';
  }

  let dose_total: number | null = null;
  let dose_manha: number | null = null;
  let dose_noite: number | null = null;

  const vaiParaInsulina =
    regra === 'regra_fetal' ||
    regra === 'regra_3' ||
    (regra === 'regra_2' && (pactuacoesPrevias > 0 || d.pactuacao_adesao === 'recusa')) ||
    (regra === 'regra_4' && d.memoria_glicosimetro === 'nao_confirma' && d.pactuacao_adesao === 'recusa');

  if (vaiParaInsulina && peso && peso > 0) {
    dose_total = Math.round(0.5 * peso * 10) / 10;
    dose_manha = Math.round((dose_total * 2) / 3 * 10) / 10;
    dose_noite = Math.round((dose_total / 3) * 10) / 10;
  }

  let proxima: ProximaFicha | null = null;
  const ig30 = igSemanas != null ? igSemanas <= 30 : null;
  const ac = (a: ProximaFicha, c: ProximaFicha): ProximaFicha | null =>
    ig30 == null ? null : ig30 ? a : c;
  const bd = (): ProximaFicha | null => ac('ficha_b', 'ficha_d');
  const semInsulinaAC = (): ProximaFicha | null => ac('ficha_a', 'ficha_c');

  const pendencias: string[] = [];

  if (regra === 'regra_fetal') {
    proxima = bd();
  } else if (regra === 'regra_manter') {
    proxima = semInsulinaAC();
  } else if (regra === 'regra_2') {
    if (pactuacoesPrevias > 0) proxima = bd();
    else if (d.pactuacao_adesao === 'aceita') proxima = semInsulinaAC();
    else if (d.pactuacao_adesao === 'recusa') proxima = bd();
    else pendencias.push('pactuacao_adesao');
  } else if (regra === 'regra_3') {
    proxima = bd();
  } else if (regra === 'regra_4') {
    if (d.memoria_glicosimetro === 'confirma') {
      proxima = 'ficha_e';
    } else if (d.memoria_glicosimetro === 'nao_confirma') {
      if (d.pactuacao_adesao === 'aceita') proxima = semInsulinaAC();
      else if (d.pactuacao_adesao === 'recusa') proxima = bd();
      else pendencias.push('pactuacao_adesao');
    } else {
      pendencias.push('memoria_glicosimetro');
    }
  }

  if (proxima == null && regra && pendencias.length === 0 && ig30 == null) {
    pendencias.push('ig_para_roteamento');
  }

  return {
    regra_aplicada: regra,
    conduta_gerada: conduta,
    proxima_ficha_recomendada: proxima,
    dose_total,
    dose_manha,
    dose_noite,
    pendencias,
  };
}

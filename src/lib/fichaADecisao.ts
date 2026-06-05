/**
 * 36B REV3 — Port frontend do motor de decisão da Ficha A (Retorno 2).
 * Espelha aplicarRegras() de supabase/functions/salvar-ficha-retorno/index.ts.
 * Mantenha SEMPRE sincronizado com o backend (ele é a fonte canônica em produção).
 */
export type Regra = 'regra_manter' | 'regra_2' | 'regra_3' | 'regra_4';
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
): DecisaoResultado {
  const adesao_ok =
    d.checklist_dieta === true && d.checklist_exercicio === true && d.checklist_ganho_peso === true;
  const adesao_falhou =
    d.checklist_dieta === false || d.checklist_exercicio === false || d.checklist_ganho_peso === false;
  const fetal_nao =
    d.checklist_pfe_us === 'nao' || d.checklist_ca === 'nao' || d.checklist_la === 'nao';

  let regra: Regra | null = null;
  let conduta: Conduta | null = null;

  if (pct >= 70 && adesao_ok && !fetal_nao) {
    regra = 'regra_manter';
    conduta = 'manter_mev';
  } else if (pct < 70 && adesao_falhou) {
    regra = 'regra_2';
    conduta = 'reforcar_mev';
  } else if (pct < 70 && adesao_ok) {
    regra = 'regra_3';
    conduta = 'insulina';
  } else if (pct >= 70 && (adesao_falhou || fetal_nao)) {
    regra = 'regra_4';
    conduta = 'avaliar_memoria';
  }

  let dose_total: number | null = null;
  let dose_manha: number | null = null;
  let dose_noite: number | null = null;

  const vaiParaInsulina =
    regra === 'regra_3' ||
    (regra === 'regra_2' && d.pactuacao_adesao === 'recusa') ||
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

  if (regra === 'regra_manter') {
    proxima = semInsulinaAC();
  } else if (regra === 'regra_2') {
    if (d.pactuacao_adesao === 'aceita') proxima = semInsulinaAC();
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

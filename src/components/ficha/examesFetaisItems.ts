/**
 * V4 — Definição dos campos de resultado de exames de crescimento e vitalidade
 * fetal, coletados na ficha (retorno). Fonte única compartilhada entre o form
 * editável (ExamesFetaisCard) e a versão read-only. Persistidos em `exames_fetais`
 * (1 linha por consulta); valor null = "sem dados".
 *
 * Grupos clínicos:
 *  - Família 1 (repercussão metabólica → dirige insulina; conduta é FOLLOW-UP):
 *    pfe_us, ca, la, crescimento (excessivo).
 *  - Família 2 (vitalidade/morfologia → apenas ALERTA, nunca insulina):
 *    morfologico (alterado), crescimento (restrito), cmf (diminuido),
 *    ctg (nao_tranquilizador), pbf (nao/<8/10).
 */

export type ExameFetalCampo =
  | 'morfologico' | 'pfe_us' | 'ca' | 'la' | 'crescimento' | 'cmf' | 'ctg' | 'pbf';

export interface ExamesFetaisState {
  morfologico: 'normal' | 'alterado' | null;
  pfe_us: 'sim' | 'nao' | null;
  ca: 'sim' | 'nao' | null;
  la: 'sim' | 'nao' | null;
  crescimento: 'adequado' | 'restrito' | 'excessivo' | null;
  cmf: 'normal' | 'diminuido' | null;
  ctg: 'tranquilizador' | 'nao_tranquilizador' | null;
  pbf: 'sim' | 'nao' | null;
}

export const EXAMES_FETAIS_VAZIO: ExamesFetaisState = {
  morfologico: null, pfe_us: null, ca: null, la: null,
  crescimento: null, cmf: null, ctg: null, pbf: null,
};

/** Opção de resposta: valor persistido + chave i18n do rótulo exibido. */
export interface OpcaoExame {
  value: string;
  labelKey: string;
}

export interface DefExameFetal {
  key: ExameFetalCampo;
  grupo: 'usg' | 'vigilancia';
  /** Itens 4/5/6 do Retorno 2, ocultos na Ficha A/C (já vêm do checklist). */
  ocultaNaFichaAC?: boolean;
  labelKey: string;
  opcoes: OpcaoExame[];
  /** Valor que caracteriza achado da Família 2 (dispara alerta de vitalidade). */
  alertaFamilia2?: string;
  /** Chave i18n do texto do alerta (placeholder até ratificação das Dras). */
  alertaKey?: string;
}

// common.yes / common.no reaproveitados para os campos Sim/Não.
export const EXAMES_FETAIS_DEFS: DefExameFetal[] = [
  {
    key: 'morfologico', grupo: 'usg',
    labelKey: 'ficha.examesFetais.morfologico.label',
    opcoes: [
      { value: 'normal', labelKey: 'ficha.examesFetais.opt.normal' },
      { value: 'alterado', labelKey: 'ficha.examesFetais.opt.alterado' },
    ],
    alertaFamilia2: 'alterado', alertaKey: 'ficha.examesFetais.alerta.morfologico',
  },
  {
    key: 'pfe_us', grupo: 'usg', ocultaNaFichaAC: true,
    labelKey: 'ficha.examesFetais.pfe.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'ca', grupo: 'usg', ocultaNaFichaAC: true,
    labelKey: 'ficha.examesFetais.ca.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'la', grupo: 'usg', ocultaNaFichaAC: true,
    labelKey: 'ficha.examesFetais.la.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'crescimento', grupo: 'usg',
    labelKey: 'ficha.examesFetais.crescimento.label',
    opcoes: [
      { value: 'adequado', labelKey: 'ficha.examesFetais.opt.adequado' },
      { value: 'restrito', labelKey: 'ficha.examesFetais.opt.restrito' },
      { value: 'excessivo', labelKey: 'ficha.examesFetais.opt.excessivo' },
    ],
    alertaFamilia2: 'restrito', alertaKey: 'ficha.examesFetais.alerta.crescimentoRestrito',
  },
  {
    key: 'cmf', grupo: 'vigilancia',
    labelKey: 'ficha.examesFetais.cmf.label',
    opcoes: [
      { value: 'normal', labelKey: 'ficha.examesFetais.opt.normal' },
      { value: 'diminuido', labelKey: 'ficha.examesFetais.opt.diminuido' },
    ],
    alertaFamilia2: 'diminuido', alertaKey: 'ficha.examesFetais.alerta.cmf',
  },
  {
    key: 'ctg', grupo: 'vigilancia',
    labelKey: 'ficha.examesFetais.ctg.label',
    opcoes: [
      { value: 'tranquilizador', labelKey: 'ficha.examesFetais.opt.tranquilizador' },
      { value: 'nao_tranquilizador', labelKey: 'ficha.examesFetais.opt.naoTranquilizador' },
    ],
    alertaFamilia2: 'nao_tranquilizador', alertaKey: 'ficha.examesFetais.alerta.ctg',
  },
  {
    key: 'pbf', grupo: 'vigilancia',
    labelKey: 'ficha.examesFetais.pbf.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
    alertaFamilia2: 'nao', alertaKey: 'ficha.examesFetais.alerta.pbf',
  },
];

/** Alertas da Família 2 ativos para um estado (usado no card e no laudo). */
export function alertasFamilia2(v: ExamesFetaisState): { key: ExameFetalCampo; alertaKey: string }[] {
  return EXAMES_FETAIS_DEFS
    .filter((d) => d.alertaFamilia2 != null && v[d.key] === d.alertaFamilia2)
    .map((d) => ({ key: d.key, alertaKey: d.alertaKey! }));
}

/** Mapeia o estado da UI (null = sem dados) para o payload de `exames_fetais`. */
export function toExamesFetaisPayload(v: ExamesFetaisState) {
  return {
    morfologico: v.morfologico, pfe_us: v.pfe_us, ca: v.ca, la: v.la,
    crescimento: v.crescimento, cmf: v.cmf, ctg: v.ctg, pbf: v.pbf,
  };
}

/** Reconstrói o estado da UI a partir de uma linha de `exames_fetais` (ou null). */
export function fromExamesFetaisRow(row: Partial<ExamesFetaisState> | null | undefined): ExamesFetaisState {
  if (!row) return { ...EXAMES_FETAIS_VAZIO };
  return {
    morfologico: row.morfologico ?? null,
    pfe_us: row.pfe_us ?? null,
    ca: row.ca ?? null,
    la: row.la ?? null,
    crescimento: row.crescimento ?? null,
    cmf: row.cmf ?? null,
    ctg: row.ctg ?? null,
    pbf: row.pbf ?? null,
  };
}

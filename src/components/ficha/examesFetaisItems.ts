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
  /** Valores que disparam alerta de atenção → chave i18n do texto. Cobre achados de
   *  vitalidade/morfologia (Família 2) e macrossomia (crescimento excessivo). Um mesmo
   *  campo pode ter mais de um gatilho (ex.: crescimento restrito e excessivo). */
  alertas?: Record<string, string>;
  /** IG mínima (semanas) para o campo aparecer no card. Ex.: CMF a partir de 28 sem,
   *  CTG/PBF a partir de 32 sem. Sem igMinima → sempre visível. */
  igMinima?: number;
  /** Exame de UMA VEZ só (ex.: USG morfológico 12-14 sem). Uma vez registrado em
   *  qualquer consulta da paciente, não é mais perguntado nas fichas seguintes. */
  umaVez?: boolean;
  /** Campo lido do ULTRASSOM DE CRESCIMENTO, feito duas vezes na gestação (janela
   *  de 28–32 sem e 36ª). É respondido uma vez POR JANELA: nas demais consultas
   *  da mesma janela o card exibe o resultado registrado em vez de reperguntar.
   *  Ver `janelaCrescimentoFetal`. */
  exameCrescimento?: boolean;
}

/** Filtra as definições visíveis na IG informada (respeita igMinima). Sem IG,
 *  mostra tudo (não some campo por falta de âncora). */
export function defsVisiveisNaIg(igSemanas: number | null | undefined): DefExameFetal[] {
  return EXAMES_FETAIS_DEFS.filter(
    (d) => d.igMinima == null || igSemanas == null || igSemanas >= d.igMinima,
  );
}




// common.yes / common.no reaproveitados para os campos Sim/Não.
export const EXAMES_FETAIS_DEFS: DefExameFetal[] = [
  {
    key: 'morfologico', grupo: 'usg', umaVez: true,
    labelKey: 'ficha.examesFetais.morfologico.label',
    opcoes: [
      { value: 'normal', labelKey: 'ficha.examesFetais.opt.normal' },
      { value: 'alterado', labelKey: 'ficha.examesFetais.opt.alterado' },
    ],
    alertas: { alterado: 'ficha.examesFetais.alerta.morfologico' },
  },
  {
    key: 'pfe_us', grupo: 'usg', ocultaNaFichaAC: true, exameCrescimento: true,
    labelKey: 'ficha.examesFetais.pfe.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'ca', grupo: 'usg', ocultaNaFichaAC: true, exameCrescimento: true,
    labelKey: 'ficha.examesFetais.ca.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'la', grupo: 'usg', ocultaNaFichaAC: true, exameCrescimento: true,
    labelKey: 'ficha.examesFetais.la.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
  },
  {
    key: 'crescimento', grupo: 'usg', igMinima: 28, exameCrescimento: true,
    labelKey: 'ficha.examesFetais.crescimento.label',
    opcoes: [
      { value: 'adequado', labelKey: 'ficha.examesFetais.opt.adequado' },
      { value: 'restrito', labelKey: 'ficha.examesFetais.opt.restrito' },
      { value: 'excessivo', labelKey: 'ficha.examesFetais.opt.excessivo' },
    ],
    alertas: {
      restrito: 'ficha.examesFetais.alerta.crescimentoRestrito',
      excessivo: 'ficha.examesFetais.alerta.crescimentoExcessivo',
    },
  },
  {
    key: 'cmf', grupo: 'vigilancia', igMinima: 28,
    labelKey: 'ficha.examesFetais.cmf.label',
    opcoes: [
      { value: 'normal', labelKey: 'ficha.examesFetais.opt.normal' },
      { value: 'diminuido', labelKey: 'ficha.examesFetais.opt.diminuido' },
    ],
    alertas: { diminuido: 'ficha.examesFetais.alerta.cmf' },
  },
  {
    key: 'ctg', grupo: 'vigilancia', igMinima: 32,
    labelKey: 'ficha.examesFetais.ctg.label',
    opcoes: [
      { value: 'tranquilizador', labelKey: 'ficha.examesFetais.opt.tranquilizador' },
      { value: 'nao_tranquilizador', labelKey: 'ficha.examesFetais.opt.naoTranquilizador' },
    ],
    alertas: { nao_tranquilizador: 'ficha.examesFetais.alerta.ctg' },
  },
  {
    key: 'pbf', grupo: 'vigilancia', igMinima: 32,
    labelKey: 'ficha.examesFetais.pbf.label',
    opcoes: [
      { value: 'sim', labelKey: 'common.yes' },
      { value: 'nao', labelKey: 'common.no' },
    ],
    alertas: { nao: 'ficha.examesFetais.alerta.pbf' },
  },
];

/** Campos de exame de UMA VEZ só (não repergunta uma vez registrados).
 *  Declarado DEPOIS de EXAMES_FETAIS_DEFS: referenciá-lo antes causa TDZ
 *  ("Cannot access before initialization") no bundle de produção. */
export const EXAMES_UMA_VEZ: ExameFetalCampo[] =
  EXAMES_FETAIS_DEFS.filter((d) => d.umaVez).map((d) => d.key);



/** Alertas de atenção ativos para um estado (usado no card e no laudo). */
export function alertasFamilia2(v: ExamesFetaisState): { key: ExameFetalCampo; alertaKey: string }[] {
  const out: { key: ExameFetalCampo; alertaKey: string }[] = [];
  for (const d of EXAMES_FETAIS_DEFS) {
    const val = v[d.key];
    if (d.alertas && val != null && d.alertas[val]) {
      out.push({ key: d.key, alertaKey: d.alertas[val] });
    }
  }
  return out;
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

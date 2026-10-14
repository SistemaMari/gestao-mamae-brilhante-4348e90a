// Dados fictícios da linha de cuidado para as rotas /vitrine (sem banco).
import type { LinhaCuidadoBloco, LinhaCuidadoResposta } from '@/lib/linhaCuidado';
import { periodoAnterior, type Periodo } from '@/lib/periodo';
import type { LinhaCuidadoPorUnidade } from '@/lib/metas';

const CRITERIOS: LinhaCuidadoBloco['criterios'] = { perfil_min_dias: 7, meta_pct: 70, ig_limite_semanas: 28, provisorio: true };

function bloco(periodo: Periodo, fator: number): LinhaCuidadoBloco {
  const k = (n: number) => Math.round(n * fator);
  const rastreadas = k(64);
  const diag = k(11);
  const enc = { insulinizacao: k(2), parto: k(1), aborto: 0, nao_retornou: k(1), outro: 0 };
  const encTotal = enc.insulinizacao + enc.parto + enc.aborto + enc.nao_retornou + enc.outro;
  const comPerfil = k(9);
  const completo = k(8);
  const meta = k(6);
  const atendidas = k(88);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  return {
    periodo,
    criterios: CRITERIOS,
    funil: {
      rastreadas,
      diagnosticadas: diag,
      em_acompanhamento: diag - encTotal,
      encerradas: enc,
      encerradas_total: encTotal,
      taxa_diagnostico_pct: pct(diag, rastreadas),
      perda_seguimento_pct: pct(enc.nao_retornou, diag),
    },
    adesao: {
      diagnosticadas: diag,
      com_perfil: comPerfil,
      com_perfil_completo: completo,
      perfil_completo_pct: pct(completo, diag),
      ultimo_na_meta: meta,
      ultimo_na_meta_pct: pct(meta, comPerfil),
    },
    tempos: {
      gj_gtt_mediana_dias: fator > 1 ? 66 : 71,
      gj_gtt_n: k(30),
      diag_perfil_mediana_dias: fator > 1 ? 6 : 8,
      diag_perfil_n: comPerfil,
      diag_insulina_mediana_dias: 17,
      diag_insulina_n: enc.insulinizacao,
      diag_com_ig: diag,
      diag_antes_28s: k(9),
      diag_antes_28s_pct: pct(k(9), diag),
    },
    perfil_gestantes: {
      atendidas,
      faixas_idade: { menos_20: k(6), de_20_34: k(58), de_35_39: k(19), mais_40: k(4), sem_info: k(1) },
      dmg_anterior: k(10),
      dmg_anterior_pct: pct(k(10), atendidas),
    },
  };
}

// Uma unidade de cada jeito (metas da vitrine em useMetasRede: METAS_VITRINE),
// incluindo uma unidade pequena que cai em "poucos dados".
const AJUSTES_UNIDADE = [
  { fator: 0.45, gjGtt: 52, antes28: 91 },
  { fator: 0.4, gjGtt: 78, antes28: 72 },
  { fator: 0.5, gjGtt: 58, antes28: 86 },
  { fator: 0.08, gjGtt: 41, antes28: 100 },
];

export function mockLinhaCuidadoPorUnidade(
  periodo: Periodo,
  unidades: { id: string; nome: string; contratante_id?: string }[],
): LinhaCuidadoPorUnidade[] {
  return unidades.map((u, i) => {
    const aj = AJUSTES_UNIDADE[i % AJUSTES_UNIDADE.length];
    const b = bloco(periodo, aj.fator);
    b.tempos.gj_gtt_mediana_dias = aj.gjGtt;
    b.tempos.diag_antes_28s_pct = b.tempos.diag_com_ig > 0 ? aj.antes28 : null;
    return { unidade_id: u.id, unidade_nome: u.nome, contratante_id: u.contratante_id ?? null, atual: b };
  });
}

export function mockLinhaCuidado(periodo: Periodo): LinhaCuidadoResposta {
  const ant = periodoAnterior(periodo) ?? periodo;
  return { atual: bloco(periodo, 1.1), anterior: bloco(ant, 1) };
}

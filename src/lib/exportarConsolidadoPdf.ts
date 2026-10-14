// "Exportar PDF" do consolidado da rede (gestor geral): relatório desenhado para
// A4 (src/components/relatorioPdf/RelatorioRede) com os números do Consolidador,
// do Diagnóstico (ranking, destaques, alertas) e da Visão geral, metas por
// unidade e apêndice nominal das pendências — tudo com os filtros da tela.
import { createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from './slugify';
import { formatDateISO } from './dateUtils';
import { agruparMetas, metasDaSelecao, type LinhaCuidadoPorUnidade, type LinhaMetaRede } from './metas';
import type { LinhaCuidadoResposta } from './linhaCuidado';
import { dataBr, ig, periodoTexto } from './relatorioPdf/formatos';
import { gerarRelatorioPdf } from './relatorioPdf/motor';
import RelatorioRede from '@/components/relatorioPdf/RelatorioRede';
import type { GestanteApendice } from '@/components/relatorioPdf/blocosComuns';
import type {
  Alerta,
  ConsolidadorGargalos,
  ConsolidadorGargalosDetalhado,
  ConsolidadorOperacao,
  ConsolidadorPerfilClinico,
  GargaloGestanteGG,
  KpisPayload,
  RankingUnidade,
  TendenciaPonto,
  TopDestaquesPayload,
  VisaoGeralRow,
} from '@/hooks/usePainelDataGestorGeral';

/** Gestantes por pendência no apêndice. */
export const LIMITE_APENDICE_REDE = 50;

export interface ExportarConsolidadoInput {
  redeNome: string;
  unidadesNomes: string[];
  periodo: { inicio: string; fim: string };
  /** Unidades do filtro (null = todas as da rede). */
  unidadesIds: string[] | null;
  /** Rede de cada unidade (para escolher as metas que valem). */
  redeDaUnidade: Record<string, string | null | undefined>;
  /** Todas as unidades do filtro, para resolver as metas quando unidadesIds = null. */
  todasUnidadesIds: string[];
}

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(nome, args);
  if (error) {
    console.warn(`[exportarConsolidadoPdf] ${nome}:`, error.message);
    return null;
  }
  return data as T;
}

const paraApendice = (l: GargaloGestanteGG[] | undefined): GestanteApendice[] =>
  (l ?? []).map((p) => ({
    nome: p.nome,
    unidade: p.unidade_nome,
    ig: ig(p.ig_atual_dias),
    ultima: dataBr(p.ultima_consulta),
    profissional: p.profissional_nome || '—',
  }));

export async function exportarConsolidadoPdf(
  input: ExportarConsolidadoInput,
): Promise<{ ok: boolean; tempoMs: number; error?: string }> {
  const comPeriodo = {
    p_data_inicio: input.periodo.inicio,
    p_data_fim: input.periodo.fim,
    p_unidades: input.unidadesIds ?? undefined,
  };
  const soUnidades = { p_unidades: input.unidadesIds ?? undefined };
  const redes = Array.from(new Set(Object.values(input.redeDaUnidade).filter((r): r is string => !!r)));

  const [operacao, perfil, kpis, linhaCuidado, porUnidade, visaoGeral, ranking, alertas, destaques, gargalos, tendencia, detalhes, metasLinhas] =
    await Promise.all([
      rpc<ConsolidadorOperacao>('get_consolidador_operacao_gestor_geral', comPeriodo),
      rpc<ConsolidadorPerfilClinico>('get_consolidador_perfil_clinico_gestor_geral', comPeriodo),
      rpc<KpisPayload>('get_metricas_consolidadas_gestor_geral', comPeriodo),
      rpc<LinhaCuidadoResposta>('get_linha_cuidado_gestor_geral', comPeriodo),
      rpc<LinhaCuidadoPorUnidade[]>('get_linha_cuidado_por_unidade_gestor_geral', comPeriodo),
      rpc<VisaoGeralRow[]>('get_visao_geral_gestor_geral', comPeriodo),
      rpc<RankingUnidade[]>('get_ranking_unidades_gestor_geral', comPeriodo),
      rpc<Alerta[]>('get_alertas_gestor_geral', soUnidades),
      rpc<TopDestaquesPayload>('get_top_destaques_gestor_geral', comPeriodo),
      rpc<ConsolidadorGargalos>('get_consolidador_gargalos_gestor_geral', comPeriodo),
      rpc<TendenciaPonto[]>('get_consolidador_tendencia_gestor_geral', soUnidades),
      rpc<ConsolidadorGargalosDetalhado>('get_consolidador_gargalos_detalhado_gestor_geral', {
        ...soUnidades,
        p_limit: LIMITE_APENDICE_REDE,
      }),
      redes.length > 0
        ? supabase
            .from('metas_rede')
            .select('contratante_id, indicador, valor')
            .in('contratante_id', redes)
            .then(({ data }) => (data ?? []) as LinhaMetaRede[])
        : Promise.resolve([] as LinhaMetaRede[]),
    ]);

  // Metas só valem quando todas as unidades do relatório são da mesma rede.
  const { metas } = metasDaSelecao(
    input.unidadesIds ?? input.todasUnidadesIds,
    input.redeDaUnidade,
    agruparMetas(metasLinhas),
  );

  const geradoEm = new Date();
  return gerarRelatorioPdf(
    createElement(RelatorioRede, {
      redeNome: input.redeNome,
      unidadesNomes: input.unidadesNomes,
      periodo: input.periodo,
      operacao,
      perfil,
      kpis,
      linhaCuidado,
      metas,
      porUnidade: porUnidade ?? [],
      visaoGeral: visaoGeral ?? [],
      ranking: ranking ?? [],
      alertas: alertas ?? [],
      destaques,
      gargalos,
      tendencia: tendencia ?? [],
      apendice: {
        sem_gj_primeira_consulta: paraApendice(detalhes?.sem_gj_primeira_consulta),
        atrasadas_gtt: paraApendice(detalhes?.atrasadas_gtt),
        confirmadas_sem_retorno: paraApendice(detalhes?.confirmadas_sem_retorno),
      },
      limiteApendice: LIMITE_APENDICE_REDE,
    }),
    {
      rodape: `Rede ${input.redeNome} · Período ${periodoTexto(input.periodo)}`,
      nomeArquivo: `consolidado-${slugify(input.redeNome)}-${formatDateISO(geradoEm)}.pdf`,
    },
  );
}

// "Exportar PDF" do painel do gestor de unidade: relatório desenhado para A4
// (src/components/relatorioPdf/RelatorioUnidade) com todos os blocos do painel,
// equipe e apêndice nominal das pendências.
import { createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from './slugify';
import { formatDateISO } from './dateUtils';
import { fetchDadosEquipe } from './fetchDadosEquipe';
import type { LinhaCuidadoResposta } from './linhaCuidado';
import type { MetasRede } from './metas';
import { dataBr, ig, periodoTexto } from './relatorioPdf/formatos';
import { gerarRelatorioPdf } from './relatorioPdf/motor';
import RelatorioUnidade from '@/components/relatorioPdf/RelatorioUnidade';
import type { GestanteApendice } from '@/components/relatorioPdf/blocosComuns';
import type {
  PainelOperacao,
  PainelPerfilClinico,
  PainelGargalos,
  PainelTendencia,
} from './painelEstrategicoTypes';

interface PacienteGargaloDetalhe {
  paciente_id: string;
  nome: string;
  ig_atual_dias: number;
  ultima_consulta: string | null;
  profissional_nome: string | null;
}

interface DetalhesGargalos {
  sem_gj_primeira_consulta: PacienteGargaloDetalhe[];
  atrasadas_gtt: PacienteGargaloDetalhe[];
  confirmadas_sem_retorno: PacienteGargaloDetalhe[];
}

export interface ExportarPainelInput {
  unidadeId: string;
  unidadeNome: string;
  operacao: PainelOperacao;
  perfil: PainelPerfilClinico;
  gargalos: PainelGargalos;
  tendencia: PainelTendencia;
  /** Seção "Linha de cuidado" (opcional: sem dados, o PDF sai sem ela). */
  linhaCuidado?: LinhaCuidadoResposta | null;
  metas?: MetasRede | null;
  notaMetas?: string | null;
  /** Período escolhido no filtro do painel (datas AAAA-MM-DD). */
  periodo?: { inicio: string; fim: string } | null;
}

/** Gestantes por pendência no apêndice. */
export const LIMITE_APENDICE_UNIDADE = 40;

const paraApendice = (l: PacienteGargaloDetalhe[] | undefined): GestanteApendice[] =>
  (l ?? []).map((p) => ({
    nome: p.nome,
    ig: ig(p.ig_atual_dias),
    ultima: dataBr(p.ultima_consulta),
    profissional: p.profissional_nome || '—',
  }));

export async function exportarPainelPdf(
  input: ExportarPainelInput,
): Promise<{ ok: boolean; tempoMs: number; error?: string }> {
  const isVitrine = input.unidadeId === 'vitrine-unidade';
  let detalhes: DetalhesGargalos = { sem_gj_primeira_consulta: [], atrasadas_gtt: [], confirmadas_sem_retorno: [] };
  if (!isVitrine) {
    const { data, error } = await supabase.rpc('get_painel_gargalos_detalhado', {
      p_unidade_id: input.unidadeId,
      p_limit: LIMITE_APENDICE_UNIDADE,
    });
    if (!error && data) detalhes = data as unknown as DetalhesGargalos;
  }
  const equipe = isVitrine ? null : await fetchDadosEquipe(input.unidadeId).catch(() => null);

  const geradoEm = new Date();
  const periodoTxt = periodoTexto(input.periodo);
  return gerarRelatorioPdf(
    createElement(RelatorioUnidade, {
      unidadeNome: input.unidadeNome,
      periodo: input.periodo ?? null,
      operacao: input.operacao,
      perfil: input.perfil,
      gargalos: input.gargalos,
      tendencia: input.tendencia,
      linhaCuidado: input.linhaCuidado ?? null,
      metas: input.metas ?? null,
      notaMetas: input.notaMetas ?? null,
      equipe,
      apendice: {
        sem_gj_primeira_consulta: paraApendice(detalhes.sem_gj_primeira_consulta),
        atrasadas_gtt: paraApendice(detalhes.atrasadas_gtt),
        confirmadas_sem_retorno: paraApendice(detalhes.confirmadas_sem_retorno),
      },
      limiteApendice: LIMITE_APENDICE_UNIDADE,
    }),
    {
      rodape: `${input.unidadeNome}${periodoTxt ? ` · Período ${periodoTxt}` : ''}`,
      nomeArquivo: `painel-${slugify(input.unidadeNome)}-${formatDateISO(geradoEm)}.pdf`,
    },
  );
}

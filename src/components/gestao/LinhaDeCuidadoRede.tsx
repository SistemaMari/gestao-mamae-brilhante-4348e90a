import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useFiltrosGestorGeral } from '@/contexts/FiltrosGestorGeralContext';
import type { LinhaCuidadoResposta } from '@/lib/linhaCuidado';
import { mockLinhaCuidado } from '@/lib/mockLinhaCuidado';
import LinhaDeCuidado from './LinhaDeCuidado';

/** Linha de cuidado no consolidado da rede (gestor geral): usa os filtros globais (período + unidades). */
export default function LinhaDeCuidadoRede() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith('/vitrine');
  const { filtros, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  const unidadesKey = unidadesEfetivas === null ? '_all' : [...unidadesEfetivas].sort().join(',') || '_none';

  const q = useQuery({
    queryKey: ['painel-gg', 'linha-cuidado', filtros.dataInicio, filtros.dataFim, unidadesKey, isVitrine],
    enabled: !semSelecao,
    queryFn: async (): Promise<LinhaCuidadoResposta> => {
      if (isVitrine) return mockLinhaCuidado({ inicio: filtros.dataInicio, fim: filtros.dataFim });
      const { data, error } = await supabase.rpc('get_linha_cuidado_gestor_geral', {
        p_data_inicio: filtros.dataInicio,
        p_data_fim: filtros.dataFim,
        p_unidades: unidadesEfetivas ?? undefined,
      });
      if (error) throw error;
      return data as unknown as LinhaCuidadoResposta;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
  });

  return (
    <LinhaDeCuidado
      data={q.data}
      loading={q.isLoading}
      error={q.isError ? t('gestao.linhaCuidado.loadError') : null}
      escopo="rede"
    />
  );
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import {
  fimDoCiclo, inicioDoCiclo, mesDeUso, diasParaVencer, emJanelaDeRenovacao, dentroDaGarantia,
} from '../../supabase/functions/_shared/renovacao';

export interface PedidoNaoRenovacao {
  id: string;
  criado_em: string;
  ciclo_fim: string | null;
}

/**
 * Situação do ano pago da conta de consultório (Meu plano e aviso do topo).
 * Conta institucional (contratada pela rede) não tem renovação: aplica = false.
 */
export function useRenovacaoPlano() {
  const { profissionalData, loading: loadingProf } = useProfissionalData();
  const [pedido, setPedido] = useState<PedidoNaoRenovacao | null>(null);
  const [loadingPedido, setLoadingPedido] = useState(true);

  const profId = profissionalData?.id ?? null;
  // Toda conta de consultório (mesmo sem data de vencimento, ex.: criada pelo admin).
  const aplica = Boolean(profissionalData && !profissionalData.unidade_id);

  const recarregar = useCallback(async () => {
    if (!profId) { setPedido(null); setLoadingPedido(false); return; }
    const { data } = await supabase
      .from('pedidos_nao_renovacao')
      .select('id, criado_em, ciclo_fim')
      .eq('profissional_id', profId)
      .is('desfeito_em', null)
      .maybeSingle();
    setPedido((data as PedidoNaoRenovacao | null) ?? null);
    setLoadingPedido(false);
  }, [profId]);

  useEffect(() => {
    if (loadingProf) return;
    recarregar();
  }, [loadingProf, recarregar]);

  const c = profissionalData;
  return {
    loading: loadingProf || loadingPedido,
    aplica,
    planoNome: c?.planos?.nome ?? null,
    planoStatus: c?.plano_status ?? null,
    fim: c ? fimDoCiclo(c) : null,
    inicio: c ? inicioDoCiclo(c) : null,
    mes: c ? mesDeUso(c) : null,
    dias: c ? diasParaVencer(c) : null,
    emJanela: c ? emJanelaDeRenovacao(c) : false,
    garantia: c ? dentroDaGarantia(c) : false,
    pedido,
    recarregar,
  };
}

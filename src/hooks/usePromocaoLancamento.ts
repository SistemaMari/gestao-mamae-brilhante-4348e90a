import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const PROMOCAO_LANCAMENTO_QUERY_KEY = ['promocao-lancamento'] as const;

/**
 * Promoção de lançamento ligada? Liga/desliga manual em /admin/planos.
 * Em erro ou enquanto carrega, considera DESLIGADA — a tela nunca mostra um
 * preço com desconto que a cobrança não vai aplicar.
 */
export function usePromocaoLancamento() {
  const { data, isLoading } = useQuery({
    queryKey: PROMOCAO_LANCAMENTO_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promocao_lancamento')
        .select('ativa')
        .eq('id', 1)
        .maybeSingle();
      if (error) return false;
      return data?.ativa === true;
    },
    staleTime: 60_000,
  });
  return { ativa: data === true, carregando: isLoading };
}

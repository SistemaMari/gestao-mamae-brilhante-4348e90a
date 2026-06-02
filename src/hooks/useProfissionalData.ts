import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlanoInfo {
  slug: string;
  nome: string;
  laudos_por_mes: number;
  preco_mensal: number;
}

export interface ProfissionalData {
  id: string;
  plano_id: string | null;
  planos: PlanoInfo | null;
  plano_status: string;
  plano_expira_em: string | null;
  proxima_renovacao: string | null;
  laudos_limite: number;
  laudos_usados: number;
  crm: string | null;
  especialidade: string | null;
  nome: string;
  unidade_id: string | null;
}

export function useProfissionalData() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<ProfissionalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (profile !== 'consultorio' && profile !== 'institucional')) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data: prof } = await supabase
        .from('profissionais')
        .select(
          'id, plano_id, plano_status, plano_expira_em, proxima_renovacao, laudos_limite, laudos_usados, crm, especialidade, nome, identificador_padrao, unidade_id, planos:plano_id(slug, nome, laudos_por_mes, preco_mensal)'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      setData(prof as unknown as ProfissionalData | null);
      setLoading(false);
    };

    fetch();
  }, [user, profile]);

  const perfilIncompleto = data && (!data.crm || !data.especialidade);

  return { profissionalData: data, loading, perfilIncompleto };
}

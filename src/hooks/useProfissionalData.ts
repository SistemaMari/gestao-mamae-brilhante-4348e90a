import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlanoInfo {
  slug: string;
  nome: string;
  laudos_por_mes: number;
  pacientes_max: number | null;
  preco_mensal: number;
  metricas_habilitado: boolean;
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
  pacientes_usados: number;
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
          'id, plano_id, plano_status, plano_expira_em, proxima_renovacao, laudos_limite, laudos_usados, crm, especialidade, nome, identificador_padrao, unidade_id, planos:plano_id(slug, nome, laudos_por_mes, pacientes_max, preco_mensal, metricas_habilitado)'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (!prof) {
        setData(null);
        setLoading(false);
        return;
      }

      const { count } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('profissional_id', prof.id)
        .eq('is_rascunho', false);

      setData({ ...prof, pacientes_usados: count ?? 0 } as unknown as ProfissionalData);
      setLoading(false);
    };

    fetch();
  }, [user, profile]);

  const perfilIncompleto = data && (!data.crm || !data.especialidade);

  return { profissionalData: data, loading, perfilIncompleto };
}

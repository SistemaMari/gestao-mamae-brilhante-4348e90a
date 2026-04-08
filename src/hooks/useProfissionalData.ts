import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfissionalData {
  id: string;
  plano: string;
  plano_status: string;
  laudos_limite: number;
  laudos_usados: number;
  crm: string | null;
  especialidade: string | null;
  nome: string;
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
        .select('id, plano, plano_status, laudos_limite, laudos_usados, crm, especialidade, nome, identificador_padrao, unidade_id')
        .eq('user_id', user.id)
        .maybeSingle();

      setData(prof as ProfissionalData | null);
      setLoading(false);
    };

    fetch();
  }, [user, profile]);

  const perfilIncompleto = data && (!data.crm || !data.especialidade);

  return { profissionalData: data, loading, perfilIncompleto };
}

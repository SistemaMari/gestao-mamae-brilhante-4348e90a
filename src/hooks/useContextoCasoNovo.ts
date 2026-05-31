import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useContextoCasoNovo — busca o contexto clínico do Caso Novo de uma paciente
 * para exibir no topo das fichas de retorno (Prompt 34B seção 3.8).
 *
 * Consome a view v_ficha_retorno_contexto. Em modo preview, devolve um
 * placeholder vazio (a view não roda contra dados de localStorage).
 *
 * Roda uma vez por mount, gated por pacienteId + isPreview.
 */

export interface ContextoCasoNovo {
  data_caso_novo: string | null;
  glicemia_jejum_caso_novo: number | null;
  tipo_exame_caso_novo: string | null;
  data_exame_caso_novo: string | null;
  cenario_caso_novo: string | null;
}

interface Resultado {
  contexto: ContextoCasoNovo | null;
  loading: boolean;
}

export function useContextoCasoNovo(
  pacienteId: string | null | undefined,
  isPreview: boolean,
  /** Em modo preview, dados de fallback da primeira consulta (opcional). */
  previewFallback?: { data?: string | null; cenario_clinico?: string | null } | null,
): Resultado {
  const [contexto, setContexto] = useState<ContextoCasoNovo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setLoading(true);
      if (!pacienteId) {
        if (!cancelado) {
          setContexto(null);
          setLoading(false);
        }
        return;
      }
      if (isPreview) {
        if (!cancelado) {
          setContexto({
            data_caso_novo: previewFallback?.data ?? null,
            glicemia_jejum_caso_novo: null,
            tipo_exame_caso_novo: null,
            data_exame_caso_novo: null,
            cenario_caso_novo: previewFallback?.cenario_clinico ?? null,
          });
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('v_ficha_retorno_contexto' as never)
          .select(
            'data_caso_novo, glicemia_jejum_caso_novo, tipo_exame_caso_novo, data_exame_caso_novo, cenario_caso_novo',
          )
          .eq('paciente_id', pacienteId)
          .limit(1)
          .maybeSingle();
        if (cancelado) return;
        if (error || !data) {
          setContexto(null);
        } else {
          setContexto(data as ContextoCasoNovo);
        }
      } catch {
        if (!cancelado) setContexto(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, isPreview]);

  return { contexto, loading };
}

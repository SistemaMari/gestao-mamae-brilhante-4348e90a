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
        // Lê o Caso Novo (consulta_1) DIRETO, em vez da view v_ficha_retorno_contexto.
        // A view parte de `FROM consultas c_ret WHERE tipo <> 'consulta_1'`, ou seja,
        // só devolve linha quando JÁ EXISTE uma consulta de retorno. Ao abrir um retorno
        // NOVO (antes do primeiro save), essa linha ainda não existe, a view vinha vazia
        // e o card mostrava "Caso Novo não localizado" mesmo com o Caso Novo preenchido.
        // Aqui replicamos o mesmo join da view, mas ancorado no consulta_1 da paciente —
        // disponível desde o início. Tudo SELECT (sem mudança de schema/backend).
        const { data: casoNovo, error: errCn } = await supabase
          .from('consultas')
          .select('id, data, cenario_clinico')
          .eq('paciente_id', pacienteId)
          .eq('tipo', 'consulta_1')
          .order('numero_sequencial', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (cancelado) return;
        if (errCn || !casoNovo) {
          setContexto(null);
          return;
        }
        // Exame de glicemia mais antigo vinculado ao Caso Novo (mesma ordenação da view).
        const { data: exame } = await supabase
          .from('exames_glicemia')
          .select('valor_mgdl, tipo_exame, data_exame')
          .eq('consulta_id', casoNovo.id)
          .order('data_exame', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (cancelado) return;
        setContexto({
          data_caso_novo: casoNovo.data ?? null,
          glicemia_jejum_caso_novo: exame?.valor_mgdl ?? null,
          tipo_exame_caso_novo: exame?.tipo_exame ?? null,
          data_exame_caso_novo: exame?.data_exame ?? null,
          cenario_caso_novo: casoNovo.cenario_clinico ?? null,
        });
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

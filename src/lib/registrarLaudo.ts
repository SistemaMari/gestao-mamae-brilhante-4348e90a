import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Persiste o laudo de uma consulta (via Edge Function `gerar-laudo`), fazendo o
 * laudo entrar no contador e no histórico. É idempotente por consulta (1 laudo
 * por consulta; re-geração atualiza sem duplicar nem gastar cota de novo).
 *
 * NÃO-BLOQUEANTE: falha silenciosa (igual ao carimbo) — nunca trava o
 * atendimento. Única exceção: limite de laudos do plano (consultório) → avisa o
 * usuário com um toast. Institucional é ilimitado (não bate no limite).
 */
export async function registrarLaudo(pacienteId: string, consultaId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("gerar-laudo", {
      body: { paciente_id: pacienteId, consulta_id: consultaId },
    });

    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (status === 402) {
        toast.error(
          "Limite de laudos do seu plano atingido. Faça upgrade para gerar mais laudos.",
        );
      } else {
        // Demais casos (texto pendente de ratificação, cenário sem laudo, rede):
        // não bloqueiam o atendimento — apenas registra para telemetria.
        console.error("[registrarLaudo] falha ao persistir laudo", { pacienteId, consultaId, error });
      }
    }
  } catch (err) {
    console.error("[registrarLaudo] exceção ao persistir laudo", { pacienteId, consultaId, err });
  }
}

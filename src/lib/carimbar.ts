import { supabase } from "@/integrations/supabase/client";
import type { TipoOperacao } from "./tiposOperacao";

/**
 * Carimba um atendimento. Falha silenciosamente — NUNCA bloqueia
 * a operação clínica principal. Para profissional de consultório
 * (sem unidade_id), o backend retorna NULL e nada é gravado.
 */
export async function carimbarAtendimento(args: {
  pacienteId: string;
  tipoOperacao: TipoOperacao;
  recursoId?: string | null;
  recursoTipo?: string | null;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("carimbar_atendimento" as any, {
      p_paciente_id: args.pacienteId,
      p_tipo_operacao: args.tipoOperacao,
      p_recurso_id: args.recursoId ?? null,
      p_recurso_tipo: args.recursoTipo ?? null,
    });
    if (error) {
      console.error("[carimbar_atendimento]", error);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[carimbar_atendimento] exception", err);
    return null;
  }
}

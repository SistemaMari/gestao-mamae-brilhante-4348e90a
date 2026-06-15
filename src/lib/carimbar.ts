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
      reportarFalhaCarimbo(args, error.message ?? "erro no RPC carimbar_atendimento");
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    reportarFalhaCarimbo(args, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * 40B (3.5) — a falha de auditoria NÃO pode ser invisível, mas também NÃO pode
 * quebrar o atendimento. Em vez de engolir o erro, registra um sinal observável
 * e não-bloqueante: log estruturado com contexto + um CustomEvent que uma camada
 * de telemetria pode escutar depois. (Telemetria persistente fica para outro item.)
 */
function reportarFalhaCarimbo(
  args: { pacienteId: string; tipoOperacao: string; recursoId?: string | null; recursoTipo?: string | null },
  motivo: string,
): void {
  const contexto = {
    pacienteId: args.pacienteId,
    tipoOperacao: args.tipoOperacao,
    recursoId: args.recursoId ?? null,
    recursoTipo: args.recursoTipo ?? null,
    motivo,
  };
  console.error("[carimbar_atendimento] FALHA AO REGISTRAR ATENDIMENTO", contexto);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("carimbo:falha", { detail: contexto }));
  }
}

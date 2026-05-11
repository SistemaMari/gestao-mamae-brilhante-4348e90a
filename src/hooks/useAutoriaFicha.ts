import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RegistroAutoria {
  id: string;
  tipo_operacao: string;
  recurso_id: string | null;
  recurso_tipo: string | null;
  profissional_nome: string;
  profissional_crm: string | null;
  profissional_especialidade: string | null;
  created_at: string;
}

export interface AutoriaLookup {
  /** Busca autoria preferindo recurso_id; cai para o registro mais recente do tipo_operacao. */
  getAutoria: (args: { recursoId?: string | null; tipoOperacao?: string | null }) => RegistroAutoria | null;
  /** Se o usuário atual tem acesso ao histórico (institucional, gestor, gestor_geral). */
  enabled: boolean;
}

/**
 * Carrega TODOS os registros_atendimento da paciente em UMA query e indexa em memória.
 * Evita N+1 em fichas com muitos cards.
 */
export function useAutoriaFicha(pacienteId: string | null | undefined): AutoriaLookup {
  const { profile } = useAuth();
  const enabled =
    !!pacienteId &&
    (profile === "institucional" || profile === "gestor" || profile === "gestor_geral");

  const { data } = useQuery({
    queryKey: ["autoria_ficha", pacienteId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_atendimento" as any)
        .select(
          "id, tipo_operacao, recurso_id, recurso_tipo, profissional_nome, profissional_crm, profissional_especialidade, created_at",
        )
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RegistroAutoria[];
    },
  });

  return useMemo<AutoriaLookup>(() => {
    if (!enabled || !data) {
      return { enabled, getAutoria: () => null };
    }
    const porRecurso = new Map<string, RegistroAutoria>();
    const porTipo = new Map<string, RegistroAutoria>(); // mais recente primeiro (ordem desc)
    for (const r of data) {
      if (r.recurso_id && !porRecurso.has(r.recurso_id)) {
        porRecurso.set(r.recurso_id, r);
      }
      if (r.tipo_operacao && !porTipo.has(r.tipo_operacao)) {
        porTipo.set(r.tipo_operacao, r);
      }
    }
    return {
      enabled,
      getAutoria: ({ recursoId, tipoOperacao }) => {
        if (recursoId && porRecurso.has(recursoId)) return porRecurso.get(recursoId)!;
        if (tipoOperacao && porTipo.has(tipoOperacao)) return porTipo.get(tipoOperacao)!;
        return null;
      },
    };
  }, [data, enabled]);
}

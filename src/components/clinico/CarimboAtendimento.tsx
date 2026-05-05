import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { labelTipoOperacao } from "@/lib/tiposOperacao";

interface RegistroLista {
  id: string;
  tipo_operacao: string;
  profissional_nome: string;
  profissional_crm: string | null;
  profissional_especialidade: string | null;
  created_at: string;
}

interface PropsBanner {
  variant: "banner";
}
interface PropsInline {
  variant: "inline";
  registro?: RegistroLista | null;
}
interface PropsLista {
  variant: "lista";
  pacienteId: string;
}
type Props = PropsBanner | PropsInline | PropsLista;

/**
 * Carimbo CFM do profissional atendente. Só renderiza para usuários
 * institucionais (profissional vinculado a uma unidade ou gestor).
 */
export default function CarimboAtendimento(props: Props) {
  const { user, profile } = useAuth();
  const [meuProf, setMeuProf] = useState<{ nome: string; crm: string | null; unidade_nome: string | null } | null>(null);
  const ehInstitucional = profile === "institucional" || profile === "gestor";

  useEffect(() => {
    if (!user || !ehInstitucional || props.variant !== "banner") return;
    (async () => {
      const { data } = await supabase
        .from("profissionais")
        .select("nome, crm, unidade_id, unidades:unidade_id(nome)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setMeuProf({
          nome: (data as any).nome,
          crm: (data as any).crm,
          unidade_nome: (data as any).unidades?.nome ?? null,
        });
      }
    })();
  }, [user, ehInstitucional, props.variant]);

  if (props.variant === "banner") {
    if (!ehInstitucional || !meuProf) return null;
    return (
      <div className="rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-4 py-2 text-sm">
        <span className="text-muted-foreground">Atendendo como: </span>
        <strong className="text-[#0F766E]">{meuProf.nome}</strong>
        {meuProf.crm && <span className="text-[#0F766E]"> — CRM {meuProf.crm}</span>}
        {meuProf.unidade_nome && (
          <span className="text-muted-foreground"> | {meuProf.unidade_nome}</span>
        )}
      </div>
    );
  }

  if (props.variant === "inline") {
    const r = props.registro;
    if (!r) return null;
    return (
      <span className="text-xs text-muted-foreground">
        {r.profissional_nome}
        {r.profissional_crm ? ` — CRM ${r.profissional_crm}` : ""}
      </span>
    );
  }

  return <ListaHistorico pacienteId={props.pacienteId} ehInstitucional={ehInstitucional || profile === "admin" || profile === "gestor_geral"} />;
}

function ListaHistorico({ pacienteId, ehInstitucional }: { pacienteId: string; ehInstitucional: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["registros_atendimento", pacienteId],
    enabled: ehInstitucional,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_atendimento" as any)
        .select("id, tipo_operacao, profissional_nome, profissional_crm, profissional_especialidade, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RegistroLista[];
    },
  });

  if (!ehInstitucional) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-[Sora] text-base font-semibold text-[#5B3A8E]">
        Histórico de atendimentos
      </h3>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum atendimento registrado ainda.
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-white">
          {data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <div>
                <div className="font-medium">{labelTipoOperacao(r.tipo_operacao)}</div>
                <div className="text-xs text-muted-foreground">
                  {r.profissional_nome}
                  {r.profissional_crm ? ` — CRM ${r.profissional_crm}` : ""}
                  {r.profissional_especialidade ? ` • ${r.profissional_especialidade}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

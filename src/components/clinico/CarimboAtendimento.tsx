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
  mockProfissional?: { nome: string; crm: string | null; unidade_nome: string | null };
  /** Quando informado, mostra essa unidade no banner (ex.: gestor geral atuando em N unidades). */
  unidadeContextoId?: string | null;
}
interface PropsInline {
  variant: "inline";
  registro?: RegistroLista | null;
}
interface PropsLista {
  variant: "lista";
  pacienteId?: string;
  registros?: RegistroLista[];
  forceVisible?: boolean;
}
type Props = PropsBanner | PropsInline | PropsLista;

/**
 * Carimbo CFM do profissional atendente. Só renderiza para usuários
 * com acesso ao histórico cross-profissional (institucional, gestor de
 * unidade ou gestor geral). Admin é excluído por política de LGPD —
 * admin não acessa fichas clínicas individuais.
 */
export default function CarimboAtendimento(props: Props) {
  const { user, profile } = useAuth();
  const [meuProf, setMeuProf] = useState<{ nome: string; crm: string | null; unidade_nome: string | null } | null>(null);
  const [unidadeContextoNome, setUnidadeContextoNome] = useState<string | null>(null);
  const ehInstitucional =
    profile === "institucional" || profile === "gestor" || profile === "gestor_geral";

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

  // Quando a página passa explicitamente a unidade da paciente, prefere essa
  // (gestor geral pode atuar em múltiplas unidades).
  const unidadeContextoId = props.variant === "banner" ? props.unidadeContextoId : null;
  useEffect(() => {
    if (!unidadeContextoId) {
      setUnidadeContextoNome(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("unidades")
        .select("nome")
        .eq("id", unidadeContextoId)
        .maybeSingle();
      setUnidadeContextoNome((data as any)?.nome ?? null);
    })();
  }, [unidadeContextoId]);

  if (props.variant === "banner") {
    const dados = props.mockProfissional ?? meuProf;
    if (!dados) return null;
    if (!props.mockProfissional && !ehInstitucional) return null;
    const unidadeMostrada = unidadeContextoNome ?? dados.unidade_nome;
    return (
      <div className="rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-4 py-2 text-sm">
        <span className="text-muted-foreground">Atendendo como: </span>
        <strong className="text-[#0F766E]">{dados.nome}</strong>
        {dados.crm && <span className="text-[#0F766E]"> — CRM {dados.crm}</span>}
        {unidadeMostrada && (
          <span className="text-muted-foreground"> | {unidadeMostrada}</span>
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

  if (props.registros) {
    return <ListaHistoricoMock registros={props.registros} />;
  }
  return <ListaHistorico pacienteId={props.pacienteId!} ehInstitucional={props.forceVisible || ehInstitucional || profile === "admin"} />;
}

function ListaHistoricoMock({ registros }: { registros: RegistroLista[] }) {
  return <ListaRender data={registros} isLoading={false} />;
}

function ListaRender({ data, isLoading }: { data: RegistroLista[] | undefined; isLoading: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className="font-[Sora] text-base font-semibold text-[#5B3A8E]">
        Histórico de atendimentos
      </h3>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum atendimento registrado ainda.</p>
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
  return <ListaRender data={data} isLoading={isLoading} />;
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ContratanteOpt {
  id: string;
  nome: string;
  cnpj: string;
  status: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Inclui contratantes encerrados (uso no Modal Editar Gestor Geral). Default: false */
  incluirEncerrados?: boolean;
  /** Callback opcional: navegar para a aba Contratantes quando lista vazia. */
  onIrParaContratantes?: () => void;
  placeholder?: string;
}

const MARI_SANDBOX_NOME = "MARI Sandbox";

export default function SelectContratante({
  value, onChange, disabled,
  incluirEncerrados = false, onIrParaContratantes,
  placeholder = "Selecione um contratante…",
}: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["institucional", "contratantes-select", incluirEncerrados],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_contratantes" },
      });
      if (error) return [] as ContratanteOpt[];
      const all = (data?.contratantes ?? []) as ContratanteOpt[];
      return all
        .filter((c) => c.nome !== MARI_SANDBOX_NOME)
        .filter((c) => incluirEncerrados ? true : c.status === "ativo");
    },
  });

  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
        <p>Não há contratantes ativos cadastrados. Cadastre um contratante antes de criar a unidade.</p>
        {onIrParaContratantes && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onIrParaContratantes}
            className="border-amber-400"
          >
            Ir para aba Contratantes
          </Button>
        )}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {data.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
            {c.status !== "ativo" ? ` (${c.status})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

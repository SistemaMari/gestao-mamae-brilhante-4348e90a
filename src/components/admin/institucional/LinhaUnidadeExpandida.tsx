import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  cnes: string | null;
  plano: string | null;
  gestorEmail: string | null;
  createdAt: string;
  contratanteId: string | null;
  contratanteNome: string | null;
  contratanteAtivo: boolean;
  onTransferir?: () => void;
}

const PERFIL_LABEL: Record<string, string> = {
  gestor: "Gestor",
  institucional: "Institucional",
  consultorio: "Consultório",
};

export default function LinhaUnidadeExpandida({
  unidadeId, cnes, plano, gestorEmail, createdAt,
  contratanteAtivo, onTransferir,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["institucional", "unidade-profissionais", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, especialidade, perfil_institucional, user_id, plano_status")
        .eq("unidade_id", unidadeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="border-l-4 border-l-[#7C4DBA] bg-[#F9F7FC] p-4">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">CNES:</span> <strong>{cnes || "—"}</strong></div>
        <div><span className="text-muted-foreground">Plano:</span> <strong>{plano || "—"}</strong></div>
        <div><span className="text-muted-foreground">E-mail do gestor:</span> <strong>{gestorEmail || "—"}</strong></div>
        <div><span className="text-muted-foreground">Cadastrada em:</span> <strong>{new Date(createdAt).toLocaleDateString("pt-BR")}</strong></div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-[#5B3A8E]">Profissionais vinculados</h4>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum profissional vinculado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade/Perfil</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nome}</TableCell>
                  <TableCell>{p.especialidade || PERFIL_LABEL[p.perfil_institucional ?? ""] || "—"}</TableCell>
                  <TableCell>{p.plano_status === "ativo" ? "Ativo" : "Convite pendente"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {onTransferir && (
        <div className="mt-4 flex justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onTransferir}
                    disabled={!contratanteAtivo}
                  >
                    <ArrowRightLeft className="mr-1 h-3 w-3" /> Transferir contratante
                  </Button>
                </span>
              </TooltipTrigger>
              {!contratanteAtivo && (
                <TooltipContent>
                  Reative o contratante atual ou aguarde reativação para transferir.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

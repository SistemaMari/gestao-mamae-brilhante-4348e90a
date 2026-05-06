import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import ModalContratante, { type ContratanteForm } from "./ModalContratante";
import { formatCNPJ, unmaskCNPJ } from "@/lib/cnpj";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface ContratanteRow {
  id: string;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string | null;
  data_inicio_contrato: string;
  data_termino_contrato: string | null;
  status: "ativo" | "suspenso" | "encerrado" | string;
  observacoes: string | null;
  created_at: string;
  unidades_count: number;
  gestores_gerais_count: number;
  profissionais_count: number;
  unidades_nomes?: string[];
}

type StatusFiltro = "ativos" | "todos" | "suspensos" | "encerrados";

const MARI_SANDBOX_NOME = "MARI Sandbox";

function StatusBadge({ status }: { status: string }) {
  if (status === "ativo") {
    return <Badge className="bg-[#10B981] text-white hover:bg-[#10B981]">Ativo</Badge>;
  }
  if (status === "suspenso") {
    return <Badge className="bg-[#F59E0B] text-[#92400E] hover:bg-[#F59E0B]">Suspenso</Badge>;
  }
  return <Badge className="bg-[#DC2626] text-white hover:bg-[#DC2626]">Encerrado</Badge>;
}

function fmtData(d?: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

export default function AbaContratantes() {
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("ativos");
  const [busca, setBusca] = useState("");
  const [openCriar, setOpenCriar] = useState(false);
  const [editar, setEditar] = useState<ContratanteRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["institucional", "contratantes"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_contratantes" },
      });
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.contratantes ?? []) as ContratanteRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes"] });
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes-select"] });
  };

  const linhas = useMemo(() => {
    let r = (data ?? []).filter((c) => c.nome !== MARI_SANDBOX_NOME);
    if (statusFiltro === "ativos") r = r.filter((c) => c.status === "ativo");
    else if (statusFiltro === "suspensos") r = r.filter((c) => c.status === "suspenso");
    else if (statusFiltro === "encerrados") r = r.filter((c) => c.status === "encerrado");
    const q = busca.trim().toLowerCase();
    if (q) {
      const qDigits = unmaskCNPJ(q);
      r = r.filter((c) =>
        c.nome.toLowerCase().includes(q) ||
        (qDigits.length > 0 && unmaskCNPJ(c.cnpj).includes(qDigits))
      );
    }
    return r;
  }, [data, statusFiltro, busca]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="suspensos">Suspensos</SelectItem>
                  <SelectItem value="encerrados">Encerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou CNPJ"
                className="w-[260px]"
              />
            </div>
            <p className="text-sm text-muted-foreground pb-2">
              {isLoading ? "Carregando…" : `${linhas.length} contratante${linhas.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button onClick={() => setOpenCriar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar contratante
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-[#5B3A8E]">
                {["Nome", "CNPJ", "Início", "Término", "Unidades", "Profis.", "Ações"].map((h, i) => (
                  <TableHead
                    key={h}
                    className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 6 ? "text-right" : ""}`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [0, 1, 2].map((i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))}
              {!isLoading && isError && (
                <TableRow><TableCell colSpan={7} className="text-center text-destructive">Erro ao carregar contratantes.</TableCell></TableRow>
              )}
              {!isLoading && !isError && linhas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum contratante encontrado.</TableCell></TableRow>
              )}
              {linhas.map((c, idx) => {
                const encerrado = c.status === "encerrado";
                return (
                  <TableRow
                    key={c.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"} ${encerrado ? "opacity-60" : ""}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.nome}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      {c.razao_social && (
                        <div className="text-xs text-muted-foreground">{c.razao_social}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCNPJ(c.cnpj)}</TableCell>
                    <TableCell>{fmtData(c.data_inicio_contrato)}</TableCell>
                    <TableCell>{c.data_termino_contrato ? fmtData(c.data_termino_contrato) : "Contínuo"}</TableCell>
                    <TableCell>
                      {c.unidades_nomes && c.unidades_nomes.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">{c.unidades_count}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <ul className="text-xs">
                              {c.unidades_nomes.slice(0, 10).map((n) => <li key={n}>• {n}</li>)}
                              {c.unidades_nomes.length > 10 && <li>… (+{c.unidades_nomes.length - 10})</li>}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        c.unidades_count
                      )}
                    </TableCell>
                    <TableCell>{c.profissionais_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditar(c)} disabled={encerrado}>
                          Editar
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="ghost" size="sm" disabled>
                                {encerrado ? "Reativar" : "Encerrar"}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Em breve — 28.3c</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <ModalContratante
          open={openCriar}
          modo="criar"
          onOpenChange={setOpenCriar}
          onSucesso={refresh}
        />
        <ModalContratante
          open={!!editar}
          modo="editar"
          inicial={editar as ContratanteForm | null}
          onOpenChange={(v) => !v && setEditar(null)}
          onSucesso={refresh}
        />
      </div>
    </TooltipProvider>
  );
}

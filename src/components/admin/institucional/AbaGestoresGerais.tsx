import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ModalCadastrarGestorGeral from "./ModalCadastrarGestorGeral";
import ModalEditarVinculos from "./ModalEditarVinculos";
import AlertDesativarGestorGeral from "./AlertDesativarGestorGeral";
import ModalReenviarConvite from "./ModalReenviarConvite";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface GestorGeralRow {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  instituicao: string | null;
  convite_pendente: boolean | null;
  contratantes_vinculados: { id: string; nome: string; status?: string }[];
  // legacy compat (não usado mais na UI, mas evita quebra se backend retornar)
  unidades_vinculadas?: number;
  unidades?: { id: string; nome: string }[];
}

export default function AbaGestoresGerais() {
  const qc = useQueryClient();
  const [openCadastrar, setOpenCadastrar] = useState(false);
  const [editar, setEditar] = useState<GestorGeralRow | null>(null);
  const [desativar, setDesativar] = useState<{ id: string; nome: string } | null>(null);
  const [reenviar, setReenviar] = useState<{ tipo: "gestor_geral"; id: string; email?: string | null } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["institucional", "gestores-gerais"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_gestores_gerais" },
      });
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.gestores_gerais ?? []) as GestorGeralRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["institucional", "gestores-gerais"] });
  const lista = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando…" : `${lista.length} gestor${lista.length === 1 ? "" : "es"} gera${lista.length === 1 ? "l" : "is"}`}
        </p>
        <Button onClick={() => setOpenCadastrar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
          <Plus className="mr-2 h-4 w-4" /> Cadastrar gestor geral
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-[#5B3A8E]">
                {["Nome", "Instituição", "Contratantes", "Ações"].map((h, i) => (
                  <TableHead key={h} className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 3 ? "text-right" : ""}`}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [0, 1].map((i) => (
                <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))}
              {!isLoading && isError && (
                <TableRow><TableCell colSpan={4} className="text-center text-destructive">Erro ao carregar.</TableCell></TableRow>
              )}
              {!isLoading && !isError && lista.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum gestor geral cadastrado.</TableCell></TableRow>
              )}
              {lista.map((g, idx) => (
                <TableRow key={g.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}>
                  <TableCell className="font-medium">
                    {g.nome}
                    {g.convite_pendente && <span className="ml-1" title="Convite pendente">⏳</span>}
                  </TableCell>
                  <TableCell>{g.instituicao || "—"}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">
                          {g.contratantes_vinculados?.length ?? 0} contratante{(g.contratantes_vinculados?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!g.contratantes_vinculados?.length
                          ? "Sem contratantes vinculados"
                          : g.contratantes_vinculados.slice(0, 10).map((c) => (c.status === "encerrado" ? `⊘ ${c.nome}` : c.nome)).join(", ") +
                            (g.contratantes_vinculados.length > 10 ? "…" : "")}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditar(g)}>Editar</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDesativar({ id: g.id, nome: g.nome })}
                        className="text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                      >
                        Desativar
                      </Button>
                      {g.convite_pendente && (
                        <Button variant="ghost" size="sm" onClick={() => setReenviar({ tipo: "gestor_geral", id: g.id, email: g.email })}>
                          <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      <ModalCadastrarGestorGeral open={openCadastrar} onOpenChange={setOpenCadastrar} onSucesso={refresh} />
      <ModalEditarVinculos alvo={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <AlertDesativarGestorGeral alvo={desativar} onClose={() => setDesativar(null)} onSucesso={refresh} />
      <ModalReenviarConvite alvo={reenviar} onClose={() => setReenviar(null)} />
    </div>
  );
}

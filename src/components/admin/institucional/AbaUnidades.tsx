import { useState, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ModalCriarUnidade from "./ModalCriarUnidade";
import ModalEditarUnidade, { type UnidadeEditavel } from "./ModalEditarUnidade";
import ModalTrocarGestor from "./ModalTrocarGestor";
import ModalReenviarConvite from "./ModalReenviarConvite";
import LinhaUnidadeExpandida from "./LinhaUnidadeExpandida";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

export interface UnidadeRow extends UnidadeEditavel {
  gestor_nome: string | null;
  gestor_email: string | null;
  convite_pendente: boolean | null;
  profissionais_count: number;
  pacientes_count: number;
  created_at: string;
  plano?: string | null;
}

export default function AbaUnidades() {
  const qc = useQueryClient();
  const [openCriar, setOpenCriar] = useState(false);
  const [editar, setEditar] = useState<UnidadeEditavel | null>(null);
  const [trocar, setTrocar] = useState<{ id: string; nome: string } | null>(null);
  const [reenviar, setReenviar] = useState<{ tipo: "gestor_unidade"; id: string; email?: string | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["institucional", "unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.unidades ?? []) as UnidadeRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["institucional", "unidades"] });
  const unidades = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando…" : `${unidades.length} unidade${unidades.length === 1 ? "" : "s"}`}
        </p>
        <Button onClick={() => setOpenCriar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
          <Plus className="mr-2 h-4 w-4" /> Criar unidade
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {["Nome", "Tipo", "Cidade", "Gestor", "Profis.", "Pacient.", "Desde", "Ações"].map((h, i) => (
                <TableHead key={h} className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 7 ? "text-right" : ""}`}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [0, 1, 2].map((i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!isLoading && isError && (
              <TableRow><TableCell colSpan={8} className="text-center text-destructive">Erro ao carregar unidades.</TableCell></TableRow>
            )}
            {!isLoading && !isError && unidades.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma unidade cadastrada.</TableCell></TableRow>
            )}
            {unidades.map((u, idx) => (
              <Fragment key={u.id}>
                <TableRow
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}`}
                  onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                >
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.tipo || "—"}</TableCell>
                  <TableCell>{u.cidade || "—"}</TableCell>
                  <TableCell>
                    {u.gestor_nome || "—"}
                    {u.convite_pendente && <span className="ml-1" title="Convite pendente">⏳</span>}
                  </TableCell>
                  <TableCell>{u.profissionais_count}</TableCell>
                  <TableCell>{u.pacientes_count}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditar(u)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setTrocar({ id: u.id, nome: u.nome })}>Trocar gestor</Button>
                      {u.convite_pendente && (
                        <Button variant="ghost" size="sm" onClick={() => setReenviar({ tipo: "gestor_unidade", id: u.id, email: u.gestor_email })}>
                          <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expanded === u.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <LinhaUnidadeExpandida
                        unidadeId={u.id}
                        cnes={u.cnes ?? null}
                        plano={u.plano ?? null}
                        gestorEmail={u.gestor_email ?? null}
                        createdAt={u.created_at}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModalCriarUnidade open={openCriar} onOpenChange={setOpenCriar} onSucesso={refresh} />
      <ModalEditarUnidade unidade={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <ModalTrocarGestor unidade={trocar} onClose={() => setTrocar(null)} onSucesso={refresh} />
      <ModalReenviarConvite alvo={reenviar} onClose={() => setReenviar(null)} />
    </div>
  );
}

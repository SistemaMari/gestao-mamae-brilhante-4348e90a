import { useState, useMemo, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ModalCriarUnidade from "./ModalCriarUnidade";
import ModalEditarUnidade, { type UnidadeEditavel } from "./ModalEditarUnidade";
import ModalTrocarGestor from "./ModalTrocarGestor";
import ModalReenviarConvite from "./ModalReenviarConvite";
import ModalVincularGestor, { type AlvoVinculacao } from "./ModalVincularGestor";
import AlertDesvincularGestor from "./AlertDesvincularGestor";
import LinhaUnidadeExpandida from "./LinhaUnidadeExpandida";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

export interface UnidadeRow extends UnidadeEditavel {
  gestor_id: string | null;
  gestor_nome: string | null;
  gestor_email: string | null;
  convite_pendente: boolean | null;
  profissionais_count: number;
  pacientes_count: number;
  created_at: string;
  plano?: string | null;
  contratante_id?: string | null;
  contratante_nome?: string | null;
}

interface ContratanteOpt { id: string; nome: string; status: string; }
const MARI_SANDBOX_NOME = "MARI Sandbox";

type StatusGestorFiltro = "todos" | "com_gestor" | "em_aberto";

export default function AbaUnidades({ onIrParaContratantes }: { onIrParaContratantes?: () => void } = {}) {
  const qc = useQueryClient();
  const [openCriar, setOpenCriar] = useState(false);
  const [editar, setEditar] = useState<UnidadeEditavel | null>(null);
  const [trocar, setTrocar] = useState<{ id: string; nome: string } | null>(null);
  const [reenviar, setReenviar] = useState<{ tipo: "gestor_unidade"; id: string; email?: string | null } | null>(null);
  const [vincular, setVincular] = useState<AlvoVinculacao | null>(null);
  const [desvincular, setDesvincular] = useState<{ gestor_id: string; gestor_nome: string; unidade_nome: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtroGestor, setFiltroGestor] = useState<StatusGestorFiltro>("todos");
  const [filtroContratante, setFiltroContratante] = useState<string>("todos");

  const { data: contratantesOpt = [] } = useQuery({
    queryKey: ["institucional", "contratantes-ativos"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_contratantes" },
      });
      return ((data?.contratantes ?? []) as ContratanteOpt[]).filter((c) => c.status === "ativo");
    },
  });

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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["institucional", "unidades"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-unidade"] });
    qc.invalidateQueries({ queryKey: ["institucional", "unidades-sem-gestor"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-disponiveis"] });
  };

  const unidades = useMemo(() => {
    let r = data ?? [];
    if (filtroGestor === "com_gestor") r = r.filter((u) => !!u.gestor_id);
    if (filtroGestor === "em_aberto") r = r.filter((u) => !u.gestor_id);
    if (filtroContratante !== "todos") r = r.filter((u) => u.contratante_id === filtroContratante);
    return r;
  }, [data, filtroGestor, filtroContratante]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status do gestor</label>
            <Select value={filtroGestor} onValueChange={(v) => setFiltroGestor(v as StatusGestorFiltro)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com_gestor">Com gestor</SelectItem>
                <SelectItem value="em_aberto">Em aberto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Contratante</label>
            <Select value={filtroContratante} onValueChange={setFiltroContratante}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os contratantes</SelectItem>
                {contratantesOpt.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground pb-2">
            {isLoading ? "Carregando…" : `${unidades.length} unidade${unidades.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setOpenCriar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
          <Plus className="mr-2 h-4 w-4" /> Criar unidade
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {["Nome", "Tipo", "Cidade", "Contratante", "Gestor", "Profis.", "Pacient.", "Desde", "Ações"].map((h, i) => (
                <TableHead key={h} className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 8 ? "text-right" : ""}`}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [0, 1, 2].map((i) => (
              <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!isLoading && isError && (
              <TableRow><TableCell colSpan={9} className="text-center text-destructive">Erro ao carregar unidades.</TableCell></TableRow>
            )}
            {!isLoading && !isError && unidades.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhuma unidade encontrada.</TableCell></TableRow>
            )}
            {unidades.map((u, idx) => {
              const emAberto = !u.gestor_id;
              return (
              <Fragment key={u.id}>
                <TableRow
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}`}
                  onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                >
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.tipo || "—"}</TableCell>
                  <TableCell>{u.cidade || "—"}</TableCell>
                  <TableCell onClick={(e) => { e.stopPropagation(); onIrParaContratantes?.(); }} className={onIrParaContratantes ? "cursor-pointer hover:underline" : ""}>
                    {u.contratante_nome === MARI_SANDBOX_NOME ? (
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">⚙ Sandbox</Badge>
                    ) : (
                      u.contratante_nome ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {emAberto ? (
                      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">⚠ Sem gestor — em aberto</Badge>
                    ) : (
                      <>
                        {u.gestor_nome}
                        {u.convite_pendente && <span className="ml-1" title="Convite pendente">⏳</span>}
                      </>
                    )}
                  </TableCell>
                  <TableCell>{u.profissionais_count}</TableCell>
                  <TableCell>{u.pacientes_count}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditar(u)}>Editar</Button>
                      {emAberto ? (
                        <Button variant="ghost" size="sm" onClick={() => setVincular({ modo: "fixar_unidade", unidade_id: u.id, unidade_nome: u.nome })}>
                          Vincular gestor
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setTrocar({ id: u.id, nome: u.nome })}>Trocar gestor</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDesvincular({ gestor_id: u.gestor_id!, gestor_nome: u.gestor_nome ?? "Gestor", unidade_nome: u.nome })}>
                            Desvincular
                          </Button>
                        </>
                      )}
                      {u.convite_pendente && !emAberto && (
                        <Button variant="ghost" size="sm" onClick={() => setReenviar({ tipo: "gestor_unidade", id: u.id, email: u.gestor_email })}>
                          <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expanded === u.id && (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
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
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModalCriarUnidade open={openCriar} onOpenChange={setOpenCriar} onSucesso={refresh} onIrParaContratantes={onIrParaContratantes} />
      <ModalEditarUnidade unidade={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <ModalTrocarGestor unidade={trocar} onClose={() => setTrocar(null)} onSucesso={refresh} />
      <ModalReenviarConvite alvo={reenviar} onClose={() => setReenviar(null)} />
      <ModalVincularGestor alvo={vincular} onClose={() => setVincular(null)} onSucesso={refresh} />
      <AlertDesvincularGestor alvo={desvincular} onClose={() => setDesvincular(null)} onSucesso={refresh} />
    </div>
  );
}

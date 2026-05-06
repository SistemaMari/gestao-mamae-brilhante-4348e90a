import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw, Search, Ban, RefreshCcw, Pencil, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PERFIL_CLINICO_LABEL, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import { toast } from "sonner";
import ModalConvidarProfissional from "./ModalConvidarProfissional";
import ModalEditarProfissional from "./ModalEditarProfissional";
import ModalTransferirProfissional from "./ModalTransferirProfissional";
import AlertRevogarAcesso from "./AlertRevogarAcesso";
import AlertReativarAcesso from "./AlertReativarAcesso";
import type { UnidadeRow } from "./AbaUnidades";

export interface ProfissionalRow {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  crm: string | null;
  especialidade: string | null;
  perfil_clinico: string | null;
  unidade_id: string;
  unidade_nome: string | null;
  contratante_id?: string | null;
  contratante_nome?: string | null;
  contratante_status?: string | null;
  convite_pendente: boolean;
  acesso_revogado: boolean;
  acesso_revogado_em: string | null;
  motivo_revogacao: string | null;
  created_at: string;
}

interface ContratanteOpt { id: string; nome: string; status: string; }
const MARI_SANDBOX_NOME = "MARI Sandbox";

type StatusFiltro = "todos" | "ativos" | "pendente" | "revogado";

export default function AbaProfissionais() {
  const qc = useQueryClient();
  const [openConvidar, setOpenConvidar] = useState(false);
  const [editar, setEditar] = useState<ProfissionalRow | null>(null);
  const [transferir, setTransferir] = useState<ProfissionalRow | null>(null);
  const [revogar, setRevogar] = useState<ProfissionalRow | null>(null);
  const [reativar, setReativar] = useState<ProfissionalRow | null>(null);

  const [filtroUnidade, setFiltroUnidade] = useState<string>("todas");
  const [filtroContratante, setFiltroContratante] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("ativos");
  const [busca, setBusca] = useState("");

  const { data: contratantesOpt = [] } = useQuery({
    queryKey: ["institucional", "contratantes-ativos"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_contratantes" },
      });
      return ((data?.contratantes ?? []) as ContratanteOpt[]).filter((c) => c.status === "ativo");
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["institucional", "unidades"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      return (data?.unidades ?? []) as UnidadeRow[];
    },
  });

  const { data: profs, isLoading, isError } = useQuery({
    queryKey: ["institucional", "profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_profissionais" },
      });
      if (error) throw new Error("Erro ao listar profissionais.");
      return (data?.profissionais ?? []) as ProfissionalRow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["institucional", "profissionais"] });

  const lista = useMemo(() => {
    let r = profs ?? [];
    if (filtroUnidade !== "todas") r = r.filter((p) => p.unidade_id === filtroUnidade);
    if (filtroContratante !== "todos") r = r.filter((p) => p.contratante_id === filtroContratante);
    if (filtroStatus === "ativos") r = r.filter((p) => !p.acesso_revogado && !p.convite_pendente);
    if (filtroStatus === "pendente") r = r.filter((p) => p.convite_pendente && !p.acesso_revogado);
    if (filtroStatus === "revogado") r = r.filter((p) => p.acesso_revogado);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      r = r.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [profs, filtroUnidade, filtroContratante, filtroStatus, busca]);

  function limpar() {
    setFiltroUnidade("todas");
    setFiltroContratante("todos");
    setFiltroStatus("ativos");
    setBusca("");
  }

  async function reenviar(p: ProfissionalRow) {
    if (!p.email) return;
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reenviar_convite", tipo: "profissional", email: p.email, id: p.id },
    });
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(`Convite reenviado para ${p.email}.`);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Unidade</label>
          <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {(unidades ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Contratante</label>
          <Select value={filtroContratante} onValueChange={setFiltroContratante}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os contratantes</SelectItem>
              {contratantesOpt.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="pendente">Convite pendente</SelectItem>
              <SelectItem value="revogado">Acesso revogado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">Buscar por nome ou e-mail</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite…" />
          </div>
        </div>
        <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
        <Button onClick={() => setOpenConvidar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E] ml-auto">
          <Plus className="mr-2 h-4 w-4" /> Convidar profissional
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {["Nome", "E-mail", "CRM", "Perfil clínico", "Unidade", "Contratante", "Status", "Ações"].map((h, i) => (
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
              <TableRow><TableCell colSpan={8} className="text-center text-destructive">Erro ao carregar profissionais.</TableCell></TableRow>
            )}
            {!isLoading && !isError && lista.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum profissional encontrado.</TableCell></TableRow>
            )}
            {lista.map((p, idx) => (
              <TableRow
                key={p.id}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"} ${p.acesso_revogado || p.contratante_status === "encerrado" ? "opacity-60" : ""}`}
              >
                <TableCell className="font-medium">
                  {p.nome}
                  {p.convite_pendente && <span className="ml-1" title="Convite pendente">⏳</span>}
                  {p.acesso_revogado && <span className="ml-1" title="Acesso revogado">⛔</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.email ?? "—"}</TableCell>
                <TableCell>{p.crm ?? "—"}</TableCell>
                <TableCell>{p.perfil_clinico ? PERFIL_CLINICO_LABEL[p.perfil_clinico] ?? p.perfil_clinico : "—"}</TableCell>
                <TableCell>{p.unidade_nome ?? "—"}</TableCell>
                <TableCell>
                  {p.contratante_nome === MARI_SANDBOX_NOME ? (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">⚙ Sandbox</Badge>
                  ) : p.contratante_status === "encerrado" ? (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100" title="Contratante encerrado">⊘ {p.contratante_nome}</Badge>
                  ) : (
                    p.contratante_nome ?? "—"
                  )}
                </TableCell>
                <TableCell>
                  {p.acesso_revogado ? (
                    <Badge variant="destructive">Revogado</Badge>
                  ) : p.convite_pendente ? (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Pendente</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Ativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditar(p)} disabled={p.acesso_revogado}>
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setTransferir(p)} disabled={p.acesso_revogado}>
                      <ArrowRightLeft className="mr-1 h-3 w-3" /> Transferir
                    </Button>
                    {p.acesso_revogado ? (
                      <Button variant="ghost" size="sm" onClick={() => setReativar(p)}>
                        <RefreshCcw className="mr-1 h-3 w-3" /> Reativar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevogar(p)}>
                        <Ban className="mr-1 h-3 w-3" /> Desativar
                      </Button>
                    )}
                    {p.convite_pendente && !p.acesso_revogado && (
                      <Button variant="ghost" size="sm" onClick={() => reenviar(p)}>
                        <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModalConvidarProfissional
        open={openConvidar}
        onOpenChange={setOpenConvidar}
        unidades={unidades ?? []}
        onSucesso={refresh}
      />
      <ModalEditarProfissional profissional={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <ModalTransferirProfissional
        profissional={transferir}
        unidades={unidades ?? []}
        onClose={() => setTransferir(null)}
        onSucesso={refresh}
      />
      <AlertRevogarAcesso profissional={revogar} onClose={() => setRevogar(null)} onSucesso={refresh} />
      <AlertReativarAcesso profissional={reativar} onClose={() => setReativar(null)} onSucesso={refresh} />
    </div>
  );
}

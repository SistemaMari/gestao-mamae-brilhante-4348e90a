import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw, Search, Ban, RefreshCcw, Pencil, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import { toast } from "sonner";
import ModalCadastrarGestorUnidade from "./ModalCadastrarGestorUnidade";
import ModalEditarGestorUnidade from "./ModalEditarGestorUnidade";
import AlertRevogarGestorUnidade from "./AlertRevogarGestorUnidade";
import AlertReativarGestorUnidade from "./AlertReativarGestorUnidade";
import ModalVincularGestor, { type AlvoVinculacao } from "./ModalVincularGestor";
import AlertDesvincularGestor from "./AlertDesvincularGestor";

export interface GestorUnidadeRow {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  unidade_id: string | null;
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

type StatusFiltro = "todos" | "ativos" | "pendente" | "revogado" | "sem_unidade";

export default function AbaGestoresUnidade() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [openCadastrar, setOpenCadastrar] = useState(false);
  const [editar, setEditar] = useState<GestorUnidadeRow | null>(null);
  const [revogar, setRevogar] = useState<GestorUnidadeRow | null>(null);
  const [reativar, setReativar] = useState<GestorUnidadeRow | null>(null);
  const [vincular, setVincular] = useState<AlvoVinculacao | null>(null);
  const [desvincular, setDesvincular] = useState<{ gestor_id: string; gestor_nome: string; unidade_nome: string } | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("ativos");
  const [filtroContratante, setFiltroContratante] = useState<string>("todos");
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["institucional", "gestores-unidade"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_gestores_unidade" },
      });
      if (error) throw new Error("Erro ao listar gestores.");
      return (data?.gestores ?? []) as GestorUnidadeRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-unidade"] });
    qc.invalidateQueries({ queryKey: ["institucional", "unidades"] });
    qc.invalidateQueries({ queryKey: ["institucional", "unidades-sem-gestor"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-disponiveis"] });
  };

  const lista = useMemo(() => {
    let r = data ?? [];
    if (filtroStatus === "ativos") r = r.filter((g) => !g.acesso_revogado);
    if (filtroStatus === "pendente") r = r.filter((g) => g.convite_pendente && !g.acesso_revogado);
    if (filtroStatus === "revogado") r = r.filter((g) => g.acesso_revogado);
    if (filtroStatus === "sem_unidade") r = r.filter((g) => !g.unidade_id && !g.acesso_revogado);
    if (filtroContratante !== "todos") r = r.filter((g) => g.contratante_id === filtroContratante);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      r = r.filter((g) => g.nome.toLowerCase().includes(q) || (g.email ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [data, filtroStatus, filtroContratante, busca]);

  function limpar() { setFiltroStatus("ativos"); setFiltroContratante("todos"); setBusca(""); }

  async function reenviar(g: GestorUnidadeRow) {
    if (!g.email) return;
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reenviar_convite", tipo: "gestor_unidade", id: g.id, email: g.email },
    });
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.gestoresUnidade.inviteResent", { email: g.email }));
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("common.status")}</label>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("common.all")}</SelectItem>
              <SelectItem value="ativos">{t("admin.gestoresUnidade.filterActive")}</SelectItem>
              <SelectItem value="pendente">{t("admin.gestoresUnidade.filterPending")}</SelectItem>
              <SelectItem value="revogado">{t("admin.gestoresUnidade.filterRevoked")}</SelectItem>
              <SelectItem value="sem_unidade">{t("admin.gestoresUnidade.filterNoUnit")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("admin.gestoresUnidade.contratante")}</label>
          <Select value={filtroContratante} onValueChange={setFiltroContratante}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("admin.gestoresUnidade.allContratantes")}</SelectItem>
              {contratantesOpt.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">{t("admin.gestoresUnidade.searchLabel")}</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("admin.gestoresUnidade.searchPlaceholder")} />
          </div>
        </div>
        <Button variant="outline" onClick={limpar}>{t("admin.clearFilters")}</Button>
        <Button onClick={() => setOpenCadastrar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E] ml-auto">
          <Plus className="mr-2 h-4 w-4" /> {t("admin.gestoresUnidade.addGestor")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {[
                t("common.name"),
                t("common.email"),
                t("admin.gestoresUnidade.colLinkedUnit"),
                t("admin.gestoresUnidade.contratante"),
                t("common.status"),
                t("common.actions"),
              ].map((h, i) => (
                <TableHead key={h} className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 5 ? "text-right" : ""}`}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [0, 1, 2].map((i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!isLoading && isError && (
              <TableRow><TableCell colSpan={6} className="text-center text-destructive">{t("admin.gestoresUnidade.loadError")}</TableCell></TableRow>
            )}
            {!isLoading && !isError && lista.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin.gestoresUnidade.empty")}</TableCell></TableRow>
            )}
            {lista.map((g, idx) => (
              <TableRow
                key={g.id}
                className={`${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"} ${g.acesso_revogado ? "opacity-60" : ""}`}
              >
                <TableCell className="font-medium">
                  {g.nome}
                  {g.convite_pendente && <span className="ml-1" title={t("admin.gestoresUnidade.pending")}>⏳</span>}
                  {g.acesso_revogado && <span className="ml-1" title={t("admin.gestoresUnidade.revoked")}>⛔</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{g.email ?? "—"}</TableCell>
                <TableCell>
                  {g.unidade_nome ? (
                    g.unidade_nome
                  ) : !g.acesso_revogado ? (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">⚠ {t("admin.gestoresUnidade.noUnit")}</Badge>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {g.contratante_nome === MARI_SANDBOX_NOME ? (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">⚙ Sandbox</Badge>
                  ) : g.contratante_status === "encerrado" ? (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100" title={t("admin.gestoresUnidade.contratanteEnded")}>⊘ {g.contratante_nome}</Badge>
                  ) : (
                    g.contratante_nome ?? <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {g.acesso_revogado ? (
                    <Badge variant="destructive">{t("admin.gestoresUnidade.badgeRevoked")}</Badge>
                  ) : g.convite_pendente ? (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{t("admin.gestoresUnidade.badgePending")}</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">{t("admin.gestoresUnidade.badgeActive")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditar(g)} disabled={g.acesso_revogado}>
                      <Pencil className="mr-1 h-3 w-3" /> {t("common.edit")}
                    </Button>
                    {!g.acesso_revogado && !g.unidade_id && (
                      <Button variant="ghost" size="sm" onClick={() => setVincular({ modo: "fixar_gestor", gestor_id: g.id, gestor_nome: g.nome })}>
                        <Link2 className="mr-1 h-3 w-3" /> {t("admin.gestoresUnidade.link")}
                      </Button>
                    )}
                    {!g.acesso_revogado && g.unidade_id && g.unidade_nome && (
                      <Button variant="ghost" size="sm" onClick={() => setDesvincular({ gestor_id: g.id, gestor_nome: g.nome, unidade_nome: g.unidade_nome! })}>
                        <Unlink className="mr-1 h-3 w-3" /> {t("admin.gestoresUnidade.unlink")}
                      </Button>
                    )}
                    {g.acesso_revogado ? (
                      <Button variant="ghost" size="sm" onClick={() => setReativar(g)}>
                        <RefreshCcw className="mr-1 h-3 w-3" /> {t("admin.gestoresUnidade.reactivate")}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevogar(g)}>
                        <Ban className="mr-1 h-3 w-3" /> {t("admin.gestoresUnidade.revoke")}
                      </Button>
                    )}
                    {g.convite_pendente && !g.acesso_revogado && (
                      <Button variant="ghost" size="sm" onClick={() => reenviar(g)}>
                        <RotateCw className="mr-1 h-3 w-3" /> {t("admin.gestoresUnidade.resend")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModalCadastrarGestorUnidade open={openCadastrar} onOpenChange={setOpenCadastrar} onSucesso={refresh} />
      <ModalEditarGestorUnidade alvo={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <AlertRevogarGestorUnidade alvo={revogar} onClose={() => setRevogar(null)} onSucesso={refresh} />
      <AlertReativarGestorUnidade alvo={reativar} onClose={() => setReativar(null)} onSucesso={refresh} />
      <ModalVincularGestor alvo={vincular} onClose={() => setVincular(null)} onSucesso={refresh} />
      <AlertDesvincularGestor alvo={desvincular} onClose={() => setDesvincular(null)} onSucesso={refresh} />
    </div>
  );
}

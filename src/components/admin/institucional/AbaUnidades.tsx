import { useState, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw, Search, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ModalCriarUnidade from "./ModalCriarUnidade";
import ImportarEmMassaModal, { type ImportConfig } from "./ImportarEmMassaModal";
import ModalEditarUnidade, { type UnidadeEditavel } from "./ModalEditarUnidade";
import ModalTrocarGestor from "./ModalTrocarGestor";
import ModalReenviarConvite from "./ModalReenviarConvite";
import ModalVincularGestor, { type AlvoVinculacao } from "./ModalVincularGestor";
import AlertDesvincularGestor from "./AlertDesvincularGestor";
import LinhaUnidadeExpandida from "./LinhaUnidadeExpandida";
import ModalTransferirUnidade from "./ModalTransferirUnidade";
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
  contratante_status?: string | null;
}

interface ContratanteOpt { id: string; nome: string; status: string; }
const MARI_SANDBOX_NOME = "MARI Sandbox";

type StatusGestorFiltro = "todos" | "com_gestor" | "em_aberto";

export default function AbaUnidades({ onIrParaContratantes }: { onIrParaContratantes?: () => void } = {}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [openCriar, setOpenCriar] = useState(false);
  const [openImportar, setOpenImportar] = useState(false);
  const [editar, setEditar] = useState<UnidadeEditavel | null>(null);
  const [trocar, setTrocar] = useState<{ id: string; nome: string } | null>(null);
  const [reenviar, setReenviar] = useState<{ tipo: "gestor_unidade"; id: string; email?: string | null } | null>(null);
  const [vincular, setVincular] = useState<AlvoVinculacao | null>(null);
  const [desvincular, setDesvincular] = useState<{ gestor_id: string; gestor_nome: string; unidade_nome: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transferir, setTransferir] = useState<{ unidade_id: string; unidade_nome: string; contratante_origem_id: string | null; contratante_origem_nome: string | null } | null>(null);
  const [filtroGestor, setFiltroGestor] = useState<StatusGestorFiltro>("todos");
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
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      r = r.filter((u) => u.nome.toLowerCase().includes(q));
    }
    return r;
  }, [data, filtroGestor, filtroContratante, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.unidades.gestorStatusLabel")}</label>
            <Select value={filtroGestor} onValueChange={(v) => setFiltroGestor(v as StatusGestorFiltro)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("common.all")}</SelectItem>
                <SelectItem value="com_gestor">{t("admin.unidades.withGestor")}</SelectItem>
                <SelectItem value="em_aberto">{t("admin.unidades.open")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.unidades.contratanteLabel")}</label>
            <Select value={filtroContratante} onValueChange={setFiltroContratante}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("admin.unidades.allContratantes")}</SelectItem>
                {contratantesOpt.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.unidades.searchLabel")}</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-[260px]" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("admin.unidades.searchPlaceholder")} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground pb-2">
            {isLoading ? t("common.loading") : t("admin.unidades.count", { count: unidades.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenImportar(true)}>
            <Upload className="mr-2 h-4 w-4" /> {t("importar.button")}
          </Button>
          <Button onClick={() => setOpenCriar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            <Plus className="mr-2 h-4 w-4" /> {t("admin.unidades.createUnit")}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {[
                t("common.name"),
                t("admin.unidades.colType"),
                t("admin.unidades.colCity"),
                t("admin.unidades.colContratante"),
                t("admin.unidades.colGestor"),
                t("admin.unidades.colProfShort"),
                t("admin.unidades.colPatientsShort"),
                t("admin.unidades.colSince"),
                t("common.actions"),
              ].map((h, i) => (
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
              <TableRow><TableCell colSpan={9} className="text-center text-destructive">{t("admin.unidades.loadError")}</TableCell></TableRow>
            )}
            {!isLoading && !isError && unidades.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t("admin.unidades.empty")}</TableCell></TableRow>
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
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">⚙ {t("admin.unidades.sandbox")}</Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {u.contratante_nome ?? "—"}
                        {u.contratante_status && u.contratante_status !== "ativo" && (
                          <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">⊘ {t("admin.unidades.closed")}</Badge>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {emAberto ? (
                      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">⚠ {t("admin.unidades.noGestorOpen")}</Badge>
                    ) : (
                      <>
                        {u.gestor_nome}
                        {u.convite_pendente && <span className="ml-1" title={t("admin.unidades.invitePending")}>⏳</span>}
                      </>
                    )}
                  </TableCell>
                  <TableCell>{u.profissionais_count}</TableCell>
                  <TableCell>{u.pacientes_count}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "2-digit" })}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditar(u)}>{t("common.edit")}</Button>
                      {emAberto ? (
                        <Button variant="ghost" size="sm" onClick={() => setVincular({ modo: "fixar_unidade", unidade_id: u.id, unidade_nome: u.nome })}>
                          {t("admin.unidades.linkGestor")}
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setTrocar({ id: u.id, nome: u.nome })}>{t("admin.unidades.changeGestor")}</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDesvincular({ gestor_id: u.gestor_id!, gestor_nome: u.gestor_nome ?? t("admin.unidades.gestorFallback"), unidade_nome: u.nome })}>
                            {t("admin.unidades.unlink")}
                          </Button>
                        </>
                      )}
                      {u.convite_pendente && !emAberto && (
                        <Button variant="ghost" size="sm" onClick={() => setReenviar({ tipo: "gestor_unidade", id: u.id, email: u.gestor_email })}>
                          <RotateCw className="mr-1 h-3 w-3" /> {t("admin.reenviarConvite.resendButton")}
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
                        unidadeNome={u.nome}
                        cnes={u.cnes ?? null}
                        plano={u.plano ?? null}
                        gestorEmail={u.gestor_email ?? null}
                        createdAt={u.created_at}
                        contratanteId={u.contratante_id ?? null}
                        contratanteNome={u.contratante_nome ?? null}
                        contratanteAtivo={(u.contratante_status ?? "ativo") === "ativo"}
                        onTransferir={u.contratante_nome !== MARI_SANDBOX_NOME ? () => setTransferir({
                          unidade_id: u.id,
                          unidade_nome: u.nome,
                          contratante_origem_id: u.contratante_id ?? null,
                          contratante_origem_nome: u.contratante_nome ?? null,
                        }) : undefined}
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
      <ImportarEmMassaModal
        open={openImportar}
        onOpenChange={setOpenImportar}
        onSucesso={refresh}
        config={{
          slug: "unidades",
          titulo: t("importar.unidades.title"),
          descricao: t("importar.unidades.desc"),
          acao: "criar_unidade",
          colunas: [
            { chave: "contratante", obrigatoria: true },
            { chave: "nome", obrigatoria: true },
            { chave: "tipo", obrigatoria: true },
            { chave: "cnes" },
            { chave: "pais" },
            { chave: "estado", obrigatoria: true },
            { chave: "cidade", obrigatoria: true },
          ],
          exemplo: { contratante: "Demo Health", nome: "UBS Exemplo", tipo: "UBS", cnes: "", pais: "Brasil", estado: "SP", cidade: "São Paulo" },
          preparar: (linha) => {
            const nome = (linha.nome ?? "").trim();
            const contratanteNome = (linha.contratante ?? "").trim();
            const tipo = (linha.tipo ?? "").trim();
            const pais = (linha.pais ?? "").trim() || "Brasil";
            const estado = (linha.estado ?? "").trim();
            const cidade = (linha.cidade ?? "").trim();
            const cnes = (linha.cnes ?? "").trim();
            const ct = contratantesOpt.find((c) => c.nome.trim().toLowerCase() === contratanteNome.toLowerCase());
            const erros: string[] = [];
            if (!contratanteNome) erros.push(t("importar.err.contratanteVazio"));
            else if (!ct) erros.push(t("importar.err.contratanteNaoEncontrado"));
            if (!nome) erros.push(t("importar.err.nomeUnidade"));
            if (!tipo) erros.push(t("importar.err.tipo"));
            if (!estado) erros.push(t("importar.err.estado"));
            if (!cidade) erros.push(t("importar.err.cidade"));
            return {
              payload: erros.length ? null : { contratante_id: ct!.id, nome, tipo, cnes: cnes || null, pais, estado, cidade },
              erros,
              rotulo: nome || "—",
            };
          },
        } as ImportConfig}
      />
      <ModalEditarUnidade unidade={editar} onClose={() => setEditar(null)} onSucesso={refresh} />
      <ModalTrocarGestor unidade={trocar} onClose={() => setTrocar(null)} onSucesso={refresh} />
      <ModalReenviarConvite alvo={reenviar} onClose={() => setReenviar(null)} />
      <ModalVincularGestor alvo={vincular} onClose={() => setVincular(null)} onSucesso={refresh} />
      <AlertDesvincularGestor alvo={desvincular} onClose={() => setDesvincular(null)} onSucesso={refresh} />
      <ModalTransferirUnidade alvo={transferir} onClose={() => setTransferir(null)} onSucesso={refresh} />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [openCadastrar, setOpenCadastrar] = useState(false);
  const [editar, setEditar] = useState<GestorGeralRow | null>(null);
  const [desativar, setDesativar] = useState<{ id: string; nome: string } | null>(null);
  const [reenviar, setReenviar] = useState<{ tipo: "gestor_geral"; id: string; email?: string | null } | null>(null);
  const [busca, setBusca] = useState("");

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
  const lista = useMemo(() => {
    const todos = data ?? [];
    if (!busca.trim()) return todos;
    const q = busca.trim().toLowerCase();
    return todos.filter((g) => g.nome.toLowerCase().includes(q));
  }, [data, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.gestoresGerais.searchLabel")}</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-[260px]" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("admin.gestoresGerais.searchPlaceholder")} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground pb-2">
            {isLoading ? t("common.loading") : t("admin.gestoresGerais.count", { count: lista.length })}
          </p>
        </div>
        <Button onClick={() => setOpenCadastrar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
          <Plus className="mr-2 h-4 w-4" /> {t("admin.gestoresGerais.addManager")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-[#5B3A8E]">
                {[
                  t("common.name"),
                  t("admin.gestoresGerais.colInstitution"),
                  t("admin.gestoresGerais.colContractors"),
                  t("common.actions"),
                ].map((h, i) => (
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
                <TableRow><TableCell colSpan={4} className="text-center text-destructive">{t("admin.gestoresGerais.loadError")}</TableCell></TableRow>
              )}
              {!isLoading && !isError && lista.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("admin.gestoresGerais.empty")}</TableCell></TableRow>
              )}
              {lista.map((g, idx) => (
                <TableRow key={g.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}>
                  <TableCell className="font-medium">
                    {g.nome}
                    {g.convite_pendente && <span className="ml-1" title={t("admin.gestoresGerais.pendingInvite")}>⏳</span>}
                  </TableCell>
                  <TableCell>{g.instituicao || "—"}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">
                          {t("admin.gestoresGerais.contractorsCount", { count: g.contratantes_vinculados?.length ?? 0 })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!g.contratantes_vinculados?.length
                          ? t("admin.gestoresGerais.noContractors")
                          : g.contratantes_vinculados.slice(0, 10).map((c) => (c.status === "encerrado" ? `⊘ ${c.nome}` : c.nome)).join(", ") +
                            (g.contratantes_vinculados.length > 10 ? "…" : "")}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditar(g)}>{t("common.edit")}</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDesativar({ id: g.id, nome: g.nome })}
                        className="text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                      >
                        {t("admin.gestoresGerais.deactivate")}
                      </Button>
                      {g.convite_pendente && (
                        <Button variant="ghost" size="sm" onClick={() => setReenviar({ tipo: "gestor_geral", id: g.id, email: g.email })}>
                          <RotateCw className="mr-1 h-3 w-3" /> {t("admin.gestoresGerais.resend")}
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

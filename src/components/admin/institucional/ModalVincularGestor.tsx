import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

/**
 * Modo "fixar_gestor": gestor já definido, escolher unidade.
 * Modo "fixar_unidade": unidade já definida, escolher gestor.
 */
export type AlvoVinculacao =
  | { modo: "fixar_gestor"; gestor_id: string; gestor_nome: string }
  | { modo: "fixar_unidade"; unidade_id: string; unidade_nome: string };

interface Props {
  alvo: AlvoVinculacao | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalVincularGestor({ alvo, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [selecionadoId, setSelecionadoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (alvo) { setSelecionadoId(""); setErro(null); }
  }, [alvo]);

  const { data: unidadesAbertas = [] } = useQuery({
    queryKey: ["institucional", "unidades-sem-gestor"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      return ((data?.unidades ?? []) as Array<{ id: string; nome: string; gestor_id: string | null }>)
        .filter((u) => !u.gestor_id);
    },
    enabled: !!alvo && alvo.modo === "fixar_gestor",
  });

  const { data: gestoresDisponiveis = [] } = useQuery({
    queryKey: ["institucional", "gestores-disponiveis"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_gestores_unidade" },
      });
      return ((data?.gestores ?? []) as Array<any>)
        .filter((g) => !g.unidade_id && !g.acesso_revogado);
    },
    enabled: !!alvo && alvo.modo === "fixar_unidade",
  });

  const titulo = useMemo(() => {
    if (!alvo) return "";
    return alvo.modo === "fixar_gestor"
      ? t("admin.institucional.linkManagerToUnit", { nome: alvo.gestor_nome })
      : t("admin.institucional.linkManagerToNamedUnit", { unidade: alvo.unidade_nome });
  }, [alvo, t]);

  async function handleSubmit() {
    if (!alvo || !selecionadoId || submitting) return;
    setSubmitting(true);
    setErro(null);
    const body =
      alvo.modo === "fixar_gestor"
        ? { acao: "vincular_gestor_a_unidade", gestor_id: alvo.gestor_id, unidade_id: selecionadoId }
        : { acao: "vincular_gestor_a_unidade", gestor_id: selecionadoId, unidade_id: alvo.unidade_id };
    const { error } = await supabase.functions.invoke("gerenciar-institucional", { body });
    setSubmitting(false);
    if (error) {
      const { codigo, mensagem } = await extrairErroEdge(error);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
      setErro(mensagem || FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.institucional.linkCreated"));
    onSucesso();
    onClose();
  }

  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{titulo}</DialogTitle>
          <DialogDescription>
            {alvo?.modo === "fixar_gestor"
              ? t("admin.institucional.linkDescChooseUnit")
              : t("admin.institucional.linkDescChooseManager")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {alvo?.modo === "fixar_gestor" && (
            <div className="space-y-1.5">
              <Label>{t("admin.institucional.unitLabel")}</Label>
              {unidadesAbertas.length === 0 ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {t("admin.institucional.noOpenUnits")}
                </p>
              ) : (
                <Select value={selecionadoId} onValueChange={setSelecionadoId} disabled={submitting}>
                  <SelectTrigger><SelectValue placeholder={t("admin.institucional.chooseUnit")} /></SelectTrigger>
                  <SelectContent>
                    {unidadesAbertas.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {alvo?.modo === "fixar_unidade" && (
            <div className="space-y-1.5">
              <Label>{t("admin.institucional.managerLabel")}</Label>
              {gestoresDisponiveis.length === 0 ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {t("admin.institucional.noManagersLoose")}
                </p>
              ) : (
                <Select value={selecionadoId} onValueChange={setSelecionadoId} disabled={submitting}>
                  <SelectTrigger><SelectValue placeholder={t("admin.institucional.chooseManager")} /></SelectTrigger>
                  <SelectContent>
                    {gestoresDisponiveis.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}{g.email ? ` — ${g.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
              {erro}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!selecionadoId || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.institucional.confirmLink")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

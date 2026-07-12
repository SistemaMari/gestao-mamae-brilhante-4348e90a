import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import type { ProfissionalRow } from "./AbaProfissionais";
import type { UnidadeRow } from "./AbaUnidades";

const STATUS_INATIVOS = ["DMG afastado", "Resultado do parto", "Encerrada"];

interface Props {
  profissional: ProfissionalRow | null;
  unidades: UnidadeRow[];
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalTransferirProfissional({ profissional, unidades, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [destino, setDestino] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setDestino(""); }, [profissional?.id]);

  const { data: orfasCount } = useQuery({
    queryKey: ["transfer-orfas", profissional?.id],
    queryFn: async () => {
      if (!profissional) return 0;
      const { count } = await supabase
        .from("pacientes")
        .select("id", { count: "exact", head: true })
        .eq("profissional_id", profissional.id)
        .eq("unidade_id", profissional.unidade_id)
        .not("status_ficha", "in", `(${STATUS_INATIVOS.map((s) => `"${s}"`).join(",")})`);
      return count ?? 0;
    },
    enabled: !!profissional,
  });

  if (!profissional) return null;

  const opcoes = unidades.filter((u) => u.id !== profissional.unidade_id);

  async function handleSubmit() {
    if (!destino || !profissional || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "transferir_profissional",
        profissional_id: profissional.id,
        unidade_destino_id: destino,
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    const n = data?.pacientes_orfas_count ?? 0;
    toast.success(
      t("admin.transferirProfissional.success", {
        nome: profissional.nome,
        destino: data?.unidade_destino_nome,
        count: n,
      }),
    );
    onSucesso();
    onClose();
  }

  return (
    <Dialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.transferirProfissional.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">
            {t("admin.transferirProfissional.movingBefore")} <strong>{profissional.nome}</strong>{" "}
            {t("admin.transferirProfissional.movingMid")} <strong>{profissional.unidade_nome}</strong>{" "}
            {t("admin.transferirProfissional.movingAfter")}
          </p>
          <div className="space-y-1.5">
            <Label>{t("admin.transferirProfissional.destinationLabel")}</Label>
            <Select value={destino} onValueChange={setDestino} disabled={submitting}>
              <SelectTrigger><SelectValue placeholder={t("admin.transferirProfissional.selectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {opcoes.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(orfasCount ?? 0) > 0 && (
            <div className="flex gap-2 rounded-md border-l-4 border-l-[#DC2626] bg-[#FEE2E2] p-3 text-sm text-[#7F1D1D]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("admin.transferirProfissional.warnBefore", { nome: profissional.nome })} <strong>{orfasCount}</strong>{" "}
                {t("admin.transferirProfissional.warnMid")} <strong>{profissional.unidade_nome}</strong>
                {t("admin.transferirProfissional.warnAfter")}
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!destino || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.transferirProfissional.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

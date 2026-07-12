import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface Props {
  alvo: { tipo: "gestor_unidade" | "gestor_geral"; id: string; email?: string | null } | null;
  onClose: () => void;
}

export default function ModalReenviarConvite({ alvo, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reenviar_convite", tipo: alvo.tipo, id: alvo.id },
    });
    setSubmitting(false);
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      if (codigo === "usuario_ja_ativo") {
        toast(t("admin.reenviarConvite.userAlreadyActive"));
        qc.invalidateQueries({ queryKey: ["institucional"] });
      } else {
        toast.error(FALLBACK_GENERICO);
      }
      onClose();
      return;
    }
    toast.success(
      alvo.email
        ? t("admin.reenviarConvite.resentToEmail", { email: alvo.email })
        : t("admin.reenviarConvite.resent")
    );
    qc.invalidateQueries({ queryKey: ["institucional"] });
    onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.reenviarConvite.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {alvo?.email
              ? t("admin.reenviarConvite.descriptionToEmail", { email: alvo.email })
              : t("admin.reenviarConvite.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.reenviarConvite.resendButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

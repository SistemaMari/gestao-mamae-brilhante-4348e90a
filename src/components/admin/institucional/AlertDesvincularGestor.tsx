import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { extrairErroEdge, FALLBACK_GENERICO, MENSAGENS_UNICIDADE } from "@/lib/mensagensUnicidade";

interface Alvo {
  gestor_id: string;
  gestor_nome: string;
  unidade_nome: string;
}

interface Props {
  alvo: Alvo | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function AlertDesvincularGestor({ alvo, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  async function confirmar() {
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "desvincular_gestor", gestor_id: alvo.gestor_id },
    });
    setSubmitting(false);
    if (error) {
      const { codigo, mensagem } = await extrairErroEdge(error);
      toast.error((codigo && MENSAGENS_UNICIDADE[codigo]) || mensagem || FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.desvincularGestor.success", { gestor: alvo.gestor_nome, unidade: alvo.unidade_nome }));
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.desvincularGestor.title", { gestor: alvo?.gestor_nome, unidade: alvo?.unidade_nome })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>→ <Trans i18nKey="admin.desvincularGestor.point1" components={{ strong: <strong /> }} /></p>
              <p>→ <Trans i18nKey="admin.desvincularGestor.point2" components={{ strong: <strong /> }} /></p>
              <p>→ <Trans i18nKey="admin.desvincularGestor.point3" components={{ strong: <strong /> }} /></p>
              <p>→ <Trans i18nKey="admin.desvincularGestor.point4" components={{ strong: <strong /> }} /></p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={submitting}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {t("admin.desvincularGestor.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import type { ProfissionalRow } from "./AbaProfissionais";

interface Props {
  profissional: ProfissionalRow | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function AlertReativarAcesso({ profissional, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  if (!profissional) return null;

  async function confirmar() {
    if (!profissional || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reativar_acesso_profissional", profissional_id: profissional.id },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.reativarAcesso.success", { nome: profissional.nome }));
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#5B3A8E]">
            {t("admin.reativarAcesso.title", { nome: profissional.nome })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>{t("admin.reativarAcesso.bullet1")}</li>
              <li>{t("admin.reativarAcesso.bullet2", { unidade: profissional.unidade_nome })}</li>
              <li>{t("admin.reativarAcesso.bullet3")}</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={confirmar} disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.reativarAcesso.confirm")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

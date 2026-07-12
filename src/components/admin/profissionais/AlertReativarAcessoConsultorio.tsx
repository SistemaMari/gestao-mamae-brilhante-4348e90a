import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

export default function AlertReativarAcessoConsultorio({
  open, onOpenChange, profissionalId, profissionalNome,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  profissionalId: string;
  profissionalNome: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        {
          body: {
            acao: "reativar_acesso_consultorio",
            profissional_id: profissionalId,
          },
        }
      );
      if (error || data?.status === "erro") {
        const { codigo } = error ? await extrairErroEdge(error) : { codigo: data?.codigo };
        const msg = (codigo && MENSAGENS_UNICIDADE[codigo]) || data?.mensagem || FALLBACK_GENERICO;
        toast.error(msg);
        return;
      }
      toast.success(t("admin.profissionais.reactivateSuccess", { nome: profissionalNome }));
      qc.invalidateQueries({ queryKey: ["profissionais-consultorio"] });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-blue-700">{t("admin.profissionais.reactivateTitle", { nome: profissionalNome })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.profissionais.reactivateDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {submitting ? t("admin.profissionais.reactivating") : t("admin.profissionais.reactivateAction")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function AlertRevogarAcesso({ profissional, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMotivo(""); }, [profissional?.id]);

  if (!profissional) return null;

  async function confirmar() {
    if (!profissional || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "revogar_acesso_profissional",
        profissional_id: profissional.id,
        motivo: motivo.trim() || null,
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.revogar.success", { nome: profissional.nome }));
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            {t("admin.revogar.title", { nome: profissional.nome })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("admin.revogar.bullet1")}</li>
                <li>{t("admin.revogar.bullet2")}</li>
                <li>{t("admin.revogar.bullet3")}</li>
                <li>{t("admin.revogar.bullet4")}</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label>{t("admin.revogar.reasonLabel")}</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("admin.revogar.reasonPlaceholder")}
            disabled={submitting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={confirmar} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.revogar.confirm")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

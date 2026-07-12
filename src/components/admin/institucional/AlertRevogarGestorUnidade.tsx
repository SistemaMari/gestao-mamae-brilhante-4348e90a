import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trans } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { extrairErroEdge, FALLBACK_GENERICO } from "@/lib/mensagensUnicidade";

interface Gestor { id: string; nome: string; }

interface Props {
  alvo: Gestor | null;
  onClose: () => void;
  onSucesso: () => void;
  onIrParaUnidades?: () => void;
}

export default function AlertRevogarGestorUnidade({ alvo, onClose, onSucesso, onIrParaUnidades }: Props) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bloqueio, setBloqueio] = useState<{ unidadeNome: string | null } | null>(null);

  function reset() { setMotivo(""); setSubmitting(false); setBloqueio(null); }
  function handleClose() { reset(); onClose(); }

  async function confirmar() {
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "revogar_acesso_gestor_unidade", gestor_id: alvo.id, motivo: motivo.trim() || undefined },
    });
    setSubmitting(false);
    if (error) {
      const { codigo, mensagem } = await extrairErroEdge(error);
      if (codigo === "gestor_ainda_vinculado") {
        let unidadeNome: string | null = null;
        try {
          const payload = await (error as any)?.context?.json?.();
          unidadeNome = payload?.unidade_nome ?? null;
        } catch { /* ignore */ }
        setBloqueio({ unidadeNome });
        return;
      }
      toast.error(mensagem || FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.revogarGestor.revokedToast", { nome: alvo.nome }));
    onSucesso();
    handleClose();
  }

  if (bloqueio) {
    return (
      <AlertDialog open={!!alvo} onOpenChange={(v) => !v && handleClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#DC2626]">{t("admin.revogarGestor.cannotRevokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {bloqueio.unidadeNome
                ? t("admin.revogarGestor.stillLinkedNamed", { unidade: bloqueio.unidadeNome })
                : t("admin.revogarGestor.stillLinked")}
              <br /><br />
              <Trans i18nKey="admin.revogarGestor.beforeRevokeHint" components={{ b: <strong /> }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>{t("common.close")}</AlertDialogCancel>
            {onIrParaUnidades && (
              <Button
                onClick={() => { handleClose(); onIrParaUnidades(); }}
                className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
              >
                {t("admin.revogarGestor.goToUnits")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.revogarGestor.confirmTitle", { nome: alvo?.nome })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("admin.revogarGestor.consequence1")}</p>
              <p>{t("admin.revogarGestor.consequence2")}</p>
              <p>{t("admin.revogarGestor.consequence3")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label>{t("admin.revogarGestor.reasonLabel")}</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={submitting} rows={2} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={handleClose}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={submitting}
            className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            {t("admin.revogarGestor.confirmButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

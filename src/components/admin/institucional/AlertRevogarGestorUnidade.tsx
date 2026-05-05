import { useState } from "react";
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
    toast.success(`Acesso de ${alvo.nome} revogado.`);
    onSucesso();
    handleClose();
  }

  if (bloqueio) {
    return (
      <AlertDialog open={!!alvo} onOpenChange={(v) => !v && handleClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#DC2626]">Não é possível revogar</AlertDialogTitle>
            <AlertDialogDescription>
              Este gestor ainda está vinculado à unidade
              {bloqueio.unidadeNome ? ` "${bloqueio.unidadeNome}"` : ""}.
              <br /><br />
              Antes de revogar o acesso, vá até a aba <strong>Unidades</strong> e use o botão
              "Trocar gestor" desta unidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Fechar</AlertDialogCancel>
            {onIrParaUnidades && (
              <Button
                onClick={() => { handleClose(); onIrParaUnidades(); }}
                className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
              >
                Ir para aba Unidades
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
          <AlertDialogTitle>Revogar acesso de {alvo?.nome}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>→ O gestor perde acesso ao sistema imediatamente</p>
              <p>→ Os dados da unidade permanecem intactos</p>
              <p>→ Esta ação pode ser revertida com "Reativar acesso"</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label>Motivo (opcional)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={submitting} rows={2} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={submitting}
            className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            Confirmar revogação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

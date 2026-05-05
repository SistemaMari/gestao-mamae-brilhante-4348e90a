import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { extrairErroEdge, FALLBACK_GENERICO } from "@/lib/mensagensUnicidade";

interface Gestor { id: string; nome: string; }

interface Props {
  alvo: Gestor | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function AlertReativarGestorUnidade({ alvo, onClose, onSucesso }: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function confirmar() {
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reativar_acesso_gestor_unidade", gestor_id: alvo.id },
    });
    setSubmitting(false);
    if (error) {
      const { mensagem } = await extrairErroEdge(error);
      toast.error(mensagem || FALLBACK_GENERICO);
      return;
    }
    toast.success(`Acesso de ${alvo.nome} reativado.`);
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reativar acesso de {alvo?.nome}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>→ O gestor poderá logar novamente com a senha atual</p>
              <p>→ Ele <strong>não</strong> será automaticamente vinculado a nenhuma unidade</p>
              <p>→ Para atribuí-lo a uma unidade, vá até a aba Unidades depois</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={submitting}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            Confirmar reativação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

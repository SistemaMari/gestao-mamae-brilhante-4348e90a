import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface Props {
  alvo: { id: string; nome: string } | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function AlertDesativarGestorGeral({ alvo, onClose, onSucesso }: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "desativar_gestor_geral", gestor_geral_id: alvo.id },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      onClose();
      return;
    }
    toast.success(`Gestor ${alvo.nome} desativado.`);
    onSucesso(); onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="border-l-4 border-l-[#DC2626]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-[Sora] text-[#DC2626]">Desativar gestor geral</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar <strong>{alvo?.nome}</strong>? O acesso ao Consolidador de Relatórios será removido imediatamente. Esta ação pode ser revertida recriando o gestor.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting}
            className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar desativação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

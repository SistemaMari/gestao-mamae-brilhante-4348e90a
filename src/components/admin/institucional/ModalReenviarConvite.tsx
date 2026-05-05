import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
        toast("O usuário já ativou a conta. Lista atualizada.");
        qc.invalidateQueries({ queryKey: ["institucional"] });
      } else {
        toast.error(FALLBACK_GENERICO);
      }
      onClose();
      return;
    }
    toast.success(`Convite reenviado${alvo.email ? ` para ${alvo.email}` : ""}.`);
    qc.invalidateQueries({ queryKey: ["institucional"] });
    onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-[Sora] text-[#5B3A8E]">Reenviar convite</AlertDialogTitle>
          <AlertDialogDescription>
            Um novo magic link será enviado{alvo?.email ? ` para ${alvo.email}` : ""}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reenviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

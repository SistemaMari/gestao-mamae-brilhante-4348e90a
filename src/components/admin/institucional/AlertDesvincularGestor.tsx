import { useState } from "react";
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
    toast.success(`${alvo.gestor_nome} desvinculado de ${alvo.unidade_nome}.`);
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desvincular {alvo?.gestor_nome} de {alvo?.unidade_nome}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>→ O gestor <strong>continua ativo</strong> e pode logar normalmente</p>
              <p>→ Ele ficará <strong>solto</strong> (sem unidade) até ser vinculado novamente</p>
              <p>→ A unidade ficará <strong>em aberto</strong>, pronta para receber outro gestor</p>
              <p>→ Esta ação <strong>não revoga</strong> o acesso. Para revogar, use a aba Gestores de Unidade</p>
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
            Confirmar desvinculação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState } from "react";
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
    toast.success(`Acesso de ${profissional.nome} reativado.`);
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#5B3A8E]">
            Reativar o acesso de {profissional.nome}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>O profissional poderá logar novamente com a senha atual.</li>
              <li>Voltará a ver os pacientes da unidade {profissional.unidade_nome}.</li>
              <li>Não é necessário enviar novo convite.</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={confirmar} disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar reativação
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useState } from "react";
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
      toast.success(`Acesso de ${profissionalNome} reativado.`);
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
          <AlertDialogTitle className="text-blue-700">Reativar acesso de {profissionalNome}?</AlertDialogTitle>
          <AlertDialogDescription>
            O profissional volta a ter acesso ao MARI. Plano e limite de laudos preservados como estavam.
            Profissional precisa fazer login de novo.
            Se a assinatura no Asaas estiver cancelada, lembre-se de reativar lá também.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {submitting ? "Reativando…" : "Reativar acesso"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

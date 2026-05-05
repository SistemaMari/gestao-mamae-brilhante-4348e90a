import { useState, useEffect } from "react";
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
    toast.success(`Acesso de ${profissional.nome} desativado.`);
    onSucesso();
    onClose();
  }

  return (
    <AlertDialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Desativar acesso de {profissional.nome}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>O profissional perde acesso ao sistema imediatamente.</li>
                <li>Os dados clínicos criados por ele permanecem intactos.</li>
                <li>Os carimbos de autoria nos prontuários são preservados.</li>
                <li>Esta ação pode ser revertida com o botão "Reativar acesso".</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: profissional saiu da unidade"
            disabled={submitting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={confirmar} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar desativação
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

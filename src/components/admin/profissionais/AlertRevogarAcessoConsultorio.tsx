import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

export default function AlertRevogarAcessoConsultorio({
  open, onOpenChange, profissionalId, profissionalNome,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  profissionalId: string;
  profissionalNome: string;
}) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setMotivo(""); setCiente(false); }
  }, [open]);

  const motivoOk = motivo.trim().length >= 20;

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        {
          body: {
            acao: "revogar_acesso_consultorio",
            profissional_id: profissionalId,
            motivo: motivo.trim(),
          },
        }
      );
      if (error || data?.status === "erro") {
        const { codigo } = error ? await extrairErroEdge(error) : { codigo: data?.codigo };
        const msg = (codigo && MENSAGENS_UNICIDADE[codigo]) || data?.mensagem || FALLBACK_GENERICO;
        toast.error(msg);
        return;
      }
      toast.success(`Acesso de ${profissionalNome} revogado.`, {
        description: data?.aviso_asaas,
        duration: 7000,
      });
      qc.invalidateQueries({ queryKey: ["profissionais-consultorio"] });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-700">Revogar acesso de {profissionalNome}?</AlertDialogTitle>
          <AlertDialogDescription>
            O profissional perderá acesso imediato ao MARI. Os dados clínicos permanecem preservados.
            Lembre-se de cancelar a assinatura no painel Asaas se ela existir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Motivo da revogação *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Mínimo 20 caracteres"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">{motivo.trim().length}/20</p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="ciente-asaas" checked={ciente} onCheckedChange={(c) => setCiente(c === true)} />
            <Label htmlFor="ciente-asaas" className="text-sm font-normal leading-tight">
              Estou ciente que precisarei cancelar a assinatura no Asaas manualmente, se aplicável.
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={submitting || !motivoOk || !ciente}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {submitting ? "Revogando…" : "Revogar acesso"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

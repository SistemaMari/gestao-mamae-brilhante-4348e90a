import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface Props {
  contratante: { id: string; nome: string } | null;
  onClose: () => void;
  onSucesso?: () => void;
}

export default function AlertReativarContratante({ contratante, onClose, onSucesso }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmar() {
    if (!contratante) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "reativar_contratante", contratante_id: contratante.id },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    const reativados = (data as any)?.profissionais_restaurados_count ?? 0;
    toast.success(`Contratante ${contratante.nome} reativado. ${reativados} profissional${reativados === 1 ? "" : "is"} voltaram a ter acesso.`);
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes"] });
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes-ativos"] });
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes-select"] });
    qc.invalidateQueries({ queryKey: ["institucional", "unidades"] });
    qc.invalidateQueries({ queryKey: ["institucional", "profissionais"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-unidade"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-gerais"] });
    onSucesso?.();
    onClose();
  }

  return (
    <AlertDialog open={!!contratante} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#1E40AF]">
            Reativar contratante {contratante?.nome}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <ul className="ml-4 space-y-1">
                <li>→ Status volta para <strong>Ativo</strong></li>
                <li>→ Profissionais afetados pelo encerramento têm acesso restaurado automaticamente</li>
                <li>→ Unidades vinculadas voltam ao status <strong>Ativa</strong></li>
              </ul>
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                Profissionais que foram revogados <strong>individualmente</strong> (antes do encerramento) <strong>NÃO</strong> serão reativados — apenas os que perderam acesso pela cascata do encerramento.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmar}
            disabled={submitting}
            className="bg-[#1E40AF] text-white hover:bg-[#1E3A8A]"
          >
            {submitting ? "Reativando…" : "Confirmar reativação"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

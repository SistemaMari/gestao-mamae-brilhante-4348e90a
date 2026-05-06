import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import SelectContratante from "./SelectContratante";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface Alvo {
  unidade_id: string;
  unidade_nome: string;
  contratante_origem_id: string | null;
  contratante_origem_nome: string | null;
}

interface Props {
  alvo: Alvo | null;
  onClose: () => void;
  onSucesso?: () => void;
}

export default function ModalTransferirUnidade({ alvo, onClose, onSucesso }: Props) {
  const qc = useQueryClient();
  const [destino, setDestino] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!alvo) { setDestino(""); setJustificativa(""); }
  }, [alvo?.unidade_id]);

  const justificativaValida = justificativa.trim().length >= 20;
  const podeConfirmar = !!destino && justificativaValida && !submitting;

  async function handleConfirmar() {
    if (!alvo) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "transferir_unidade_de_contratante",
        unidade_id: alvo.unidade_id,
        contratante_destino_id: destino,
        justificativa: justificativa.trim(),
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(`${alvo.unidade_nome} transferida.`);
    qc.invalidateQueries({ queryKey: ["institucional", "unidades"] });
    qc.invalidateQueries({ queryKey: ["institucional", "contratantes"] });
    qc.invalidateQueries({ queryKey: ["institucional", "profissionais"] });
    qc.invalidateQueries({ queryKey: ["institucional", "gestores-unidade"] });
    onSucesso?.();
    onClose();
  }

  const excluirIds = alvo?.contratante_origem_id ? [alvo.contratante_origem_id] : [];

  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#5B3A8E]">
            <ArrowRightLeft className="h-5 w-5" /> Transferir unidade de contratante
          </DialogTitle>
        </DialogHeader>

        {alvo && (
          <div className="space-y-4">
            <div className="rounded-md border bg-[#F9F7FC] p-3 text-sm">
              <p><span className="text-muted-foreground">Unidade:</span> <strong>{alvo.unidade_nome}</strong></p>
              <p><span className="text-muted-foreground">Contratante atual:</span> <strong>{alvo.contratante_origem_nome ?? "—"}</strong></p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Contratante destino</label>
              <SelectContratante
                value={destino}
                onChange={setDestino}
                excluirIds={excluirIds}
                placeholder="Selecione o contratante destino…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Justificativa da transferência</label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: Mudança de operadora administrativa por decisão da prefeitura."
                rows={3}
              />
              <p className={`text-xs ${justificativa.length > 0 && !justificativaValida ? "text-destructive" : "text-muted-foreground"}`}>
                {justificativa.trim().length}/20 caracteres mínimos
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {submitting ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

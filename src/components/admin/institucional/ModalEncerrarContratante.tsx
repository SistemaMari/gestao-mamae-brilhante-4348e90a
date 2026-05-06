import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface PreviewResp {
  status: string;
  contratante_nome: string;
  unidades_afetadas_count: number;
  unidades_lista: { id: string; nome: string }[];
  profissionais_afetados_count: number;
  gestores_unidade_afetados_count: number;
  gestores_gerais_afetados_count: number;
  pacientes_em_acompanhamento_count: number;
}

interface Props {
  contratante: { id: string; nome: string } | null;
  onClose: () => void;
  onSucesso?: () => void;
}

export default function ModalEncerrarContratante({ contratante, onClose, onSucesso }: Props) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [verUnidades, setVerUnidades] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!contratante) {
      setPreview(null); setMotivo(""); setConfirmado(false); setVerUnidades(false);
      return;
    }
    setLoadingPreview(true);
    supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "encerrar_contratante", contratante_id: contratante.id, modo: "preview" },
    }).then(async ({ data, error }) => {
      if (error) {
        await extrairErroEdge(error);
        toast.error(FALLBACK_GENERICO);
        onClose();
        return;
      }
      setPreview(data as PreviewResp);
    }).finally(() => setLoadingPreview(false));
  }, [contratante?.id]);

  const motivoValido = motivo.trim().length >= 20;
  const podeConfirmar = motivoValido && confirmado && !submitting;

  async function handleConfirmar() {
    if (!contratante) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "encerrar_contratante",
        contratante_id: contratante.id,
        modo: "confirmar",
        motivo: motivo.trim(),
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    const revogados = (data as any)?.profissionais_revogados ?? preview?.profissionais_afetados_count ?? 0;
    toast.success(`Contratante ${contratante.nome} encerrado. ${revogados} profissionais tiveram acesso revogado.`);
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
    <Dialog open={!!contratante} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#DC2626]">
            <AlertTriangle className="h-5 w-5" /> Encerrar contratante
          </DialogTitle>
        </DialogHeader>

        {loadingPreview && <Skeleton className="h-40 w-full" />}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-md border-l-4 border-l-[#DC2626] bg-[#FEF2F2] p-4 text-sm space-y-2">
              <p className="font-medium">
                Você está prestes a encerrar o contrato com <strong>{preview.contratante_nome}</strong>.
              </p>
              <div>
                <p className="font-semibold mt-2">ESTA AÇÃO AFETARÁ:</p>
                <ul className="ml-4 mt-1 space-y-0.5">
                  <li>→ {preview.unidades_afetadas_count} unidade{preview.unidades_afetadas_count === 1 ? "" : "s"} marcada{preview.unidades_afetadas_count === 1 ? "" : "s"} como inativa{preview.unidades_afetadas_count === 1 ? "" : "s"}</li>
                  <li>→ {preview.profissionais_afetados_count} profissional{preview.profissionais_afetados_count === 1 ? "" : "is"} com acesso revogado</li>
                  <li>→ {preview.gestores_unidade_afetados_count} gestor{preview.gestores_unidade_afetados_count === 1 ? "" : "es"} de unidade com acesso revogado</li>
                  <li>→ {preview.gestores_gerais_afetados_count} gestor{preview.gestores_gerais_afetados_count === 1 ? "" : "es"} geral{preview.gestores_gerais_afetados_count === 1 ? "" : "is"} com vínculo encerrado</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mt-2">DADOS PRESERVADOS:</p>
                <ul className="ml-4 mt-1 space-y-0.5">
                  <li>→ {preview.pacientes_em_acompanhamento_count} paciente{preview.pacientes_em_acompanhamento_count === 1 ? "" : "s"} permanecem com dados clínicos intactos</li>
                  <li>→ Carimbos de autoria nos prontuários preservados</li>
                  <li>→ Histórico de exames e laudos imutável</li>
                </ul>
              </div>
              <p className="mt-2 text-xs italic">Esta ação é REVERSÍVEL — você pode reativar o contratante depois.</p>
            </div>

            {preview.unidades_lista?.length > 0 && (
              <div className="rounded-md border bg-white">
                <button
                  type="button"
                  onClick={() => setVerUnidades((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-[#F9F7FC]"
                >
                  <span className="flex items-center gap-1">
                    {verUnidades ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Ver unidades afetadas ({preview.unidades_lista.length})
                  </span>
                </button>
                {verUnidades && (
                  <ul className="border-t px-6 py-2 text-sm">
                    {preview.unidades_lista.map((u) => (
                      <li key={u.id} className="py-0.5">• {u.nome}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo do encerramento</label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Não renovação contratual após auditoria de qualidade."
                rows={3}
              />
              <p className={`text-xs ${motivo.length > 0 && !motivoValido ? "text-destructive" : "text-muted-foreground"}`}>
                {motivo.trim().length}/20 caracteres mínimos
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmado}
                onCheckedChange={(v) => setConfirmado(!!v)}
                className="mt-0.5"
              />
              <span>Confirmo que entendi o impacto desta ação.</span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar}
            className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            {submitting ? "Encerrando…" : "Confirmar encerramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

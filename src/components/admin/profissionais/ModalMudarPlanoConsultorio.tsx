import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

export default function ModalMudarPlanoConsultorio({
  open, onOpenChange, profissionalId, profissionalNome, planoAtualId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  profissionalId: string;
  profissionalNome: string;
  planoAtualId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [planoId, setPlanoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setPlanoId(""); setMotivo(""); }
  }, [open]);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, preco_mensal, laudos_por_mes, ativo, ordem")
        .eq("ativo", true)
        .order("ordem");
      return data ?? [];
    },
  });

  const motivoValido = motivo.trim().length >= 10;
  const planoValido = planoId && planoId !== planoAtualId;

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        {
          body: {
            acao: "mudar_plano",
            profissional_id: profissionalId,
            plano_id: planoId,
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
      const planoNome = planos.find((p: any) => p.id === planoId)?.nome;
      toast.success(t("admin.mudarPlano.successToast", { plano: planoNome }));
      qc.invalidateQueries({ queryKey: ["profissionais-consultorio"] });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.mudarPlano.title", { nome: profissionalNome })}</DialogTitle>
          <DialogDescription>
            {t("admin.mudarPlano.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>{t("admin.mudarPlano.novoPlanoLabel")}</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger><SelectValue placeholder={t("invite.selectPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {planos.filter((p: any) => p.id !== planoAtualId).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {t("admin.mudarPlano.planoOption", { nome: p.nome, preco: Number(p.preco_mensal).toFixed(2), laudos: p.laudos_por_mes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("admin.mudarPlano.motivoLabel")}</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t("admin.mudarPlano.motivoPlaceholder")}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">{motivo.trim().length}/10</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={submit}
            disabled={submitting || !motivoValido || !planoValido}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {submitting ? t("common.saving") : t("admin.mudarPlano.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

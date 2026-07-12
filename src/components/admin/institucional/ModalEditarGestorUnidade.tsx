import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface Gestor {
  id: string;
  nome: string;
  email: string | null;
}

interface Props {
  alvo: Gestor | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalEditarGestorUnidade({ alvo, onClose, onSucesso }: Props) {
  const { t } = useTranslation();
  const [nome, setNome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (alvo) setNome(alvo.nome); }, [alvo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alvo || !nome.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "editar_gestor_unidade", gestor_id: alvo.id, nome: nome.trim() },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("admin.editarGestor.success"));
    onSucesso();
    onClose();
  }

  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.editarGestor.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              {t("common.email")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("admin.editarGestor.emailTooltip")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input value={alvo?.email ?? ""} disabled readOnly />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!nome.trim() || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

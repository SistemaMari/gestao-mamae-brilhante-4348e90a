import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { FALLBACK_GENERICO, extrairErroEdge, PERFIL_CLINICO_LABEL } from "@/lib/mensagensUnicidade";
import type { ProfissionalRow } from "./AbaProfissionais";

const PERFIS = ["medico", "enfermeiro", "tecnico_enfermagem", "outro"];

interface Props {
  profissional: ProfissionalRow | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalEditarProfissional({ profissional, onClose, onSucesso }: Props) {
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState("medico");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profissional) {
      setNome(profissional.nome);
      setPerfil(profissional.perfil_clinico ?? "medico");
    }
  }, [profissional]);

  if (!profissional) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profissional || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "editar_profissional",
        profissional_id: profissional.id,
        nome: nome.trim(),
        perfil,
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success("Profissional atualizado.");
    onSucesso();
    onClose();
  }

  return (
    <Dialog open={!!profissional} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Editar profissional</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil clínico</Label>
            <Select value={perfil} onValueChange={setPerfil} disabled={submitting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => <SelectItem key={p} value={p}>{PERFIL_CLINICO_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TooltipProvider>
            <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">E-mail:</span>
                <span>{profissional.email ?? "—"}</span>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Não editável. Para corrigir o e-mail, revogue o acesso e envie novo convite.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">CRM:</span>
                <span>{profissional.crm ?? "—"}</span>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3.5 w-3.5" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    O CRM é dado clínico-legal e só pode ser alterado pelo próprio profissional no perfil dele.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

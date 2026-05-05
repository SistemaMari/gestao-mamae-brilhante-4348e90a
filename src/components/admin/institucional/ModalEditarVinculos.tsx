import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import MultiSelectUnidades, { type UnidadeOption } from "./MultiSelectUnidades";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

interface GestorGeralAlvo {
  id: string;
  nome: string;
  email: string | null;
  unidades: { id: string; nome: string }[];
}

interface Props {
  alvo: GestorGeralAlvo | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalEditarVinculos({ alvo, onClose, onSucesso }: Props) {
  const [ids, setIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (alvo) setIds(alvo.unidades.map((u) => u.id));
  }, [alvo]);

  const { data: unidades } = useQuery({
    queryKey: ["institucional", "unidades"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      return (data?.unidades ?? []) as UnidadeOption[];
    },
    enabled: !!alvo,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alvo || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "atualizar_vinculos_gestor_geral",
        gestor_geral_id: alvo.id,
        unidade_ids: ids,
      },
    });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(`Vínculos atualizados: ${data?.adicionadas ?? 0} adicionadas, ${data?.removidas ?? 0} removidas.`);
    onSucesso(); onClose();
  }

  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Editar vínculos</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-[#F5F3FA] p-3 text-sm">
            <div><strong>{alvo?.nome}</strong></div>
            <div className="text-muted-foreground">{alvo?.email}</div>
          </div>
          <MultiSelectUnidades
            unidades={unidades ?? []}
            selecionadas={ids}
            onChange={setIds}
            disabled={submitting}
          />
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

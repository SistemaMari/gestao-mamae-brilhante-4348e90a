import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import MultiSelectUnidades, { type UnidadeOption } from "./MultiSelectUnidades";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}

export default function ModalCadastrarGestorGeral({ open, onOpenChange, onSucesso }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [unidadeIds, setUnidadeIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: unidades } = useQuery({
    queryKey: ["institucional", "unidades"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      return (data?.unidades ?? []) as UnidadeOption[];
    },
    enabled: open,
  });

  function reset() {
    setNome(""); setEmail(""); setCargo(""); setInstituicao("");
    setUnidadeIds([]); setErro(null); setSubmitting(false);
  }
  function handleOpenChange(v: boolean) { if (!v) reset(); onOpenChange(v); }

  const valido = nome.trim() && EMAIL_REGEX.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || submitting) return;
    setSubmitting(true); setErro(null);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "criar_gestor_geral",
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        cargo: cargo.trim() || null,
        instituicao: instituicao.trim() || null,
        unidade_ids: unidadeIds,
      },
    });
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      setSubmitting(false);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
      handleOpenChange(false); toast.error(FALLBACK_GENERICO); return;
    }
    setSubmitting(false);
    if (unidadeIds.length > 0) {
      toast.success(`Gestor geral cadastrado! E-mail enviado. ${unidadeIds.length} unidade${unidadeIds.length === 1 ? "" : "s"} vinculada${unidadeIds.length === 1 ? "" : "s"}.`);
    } else {
      toast.success("Gestor geral cadastrado! E-mail enviado. Vincule unidades quando estiver pronto.");
    }
    handleOpenChange(false); onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Cadastrar gestor geral</DialogTitle>
          <DialogDescription>Receberá e-mail para definir senha e acessar o consolidador.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo (opcional)</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Secretário Municipal de Saúde" disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>Instituição (opcional)</Label>
            <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>Unidades vinculadas (opcional)</Label>
            <MultiSelectUnidades
              unidades={unidades ?? []}
              selecionadas={unidadeIds}
              onChange={setUnidadeIds}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Você pode cadastrar o gestor sem vincular unidades agora e fazer isso depois pelo botão Editar.
            </p>
          </div>

          <AvisoUnicidadeEmail />

          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">{erro}</div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={!valido || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

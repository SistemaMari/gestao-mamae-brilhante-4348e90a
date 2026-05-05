import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  unidade: { id: string; nome: string } | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalTrocarGestor({ unidade, onClose, onSucesso }: Props) {
  const [destino, setDestino] = useState("remover");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (unidade) { setDestino("remover"); setNome(""); setEmail(""); setErro(null); }
  }, [unidade]);

  const valido = nome.trim() && EMAIL_REGEX.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unidade || !valido || submitting) return;
    setSubmitting(true); setErro(null);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "trocar_gestor_unidade",
        unidade_id: unidade.id,
        destino_gestor_atual: destino,
        novo_gestor_nome: nome.trim(),
        novo_gestor_email: email.trim().toLowerCase(),
      },
    });
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      setSubmitting(false);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
      onClose(); toast.error(FALLBACK_GENERICO); return;
    }
    setSubmitting(false);
    toast.success(`Gestor trocado. E-mail enviado para ${email.trim()}.`);
    onSucesso(); onClose();
  }

  return (
    <Dialog open={!!unidade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            Trocar gestor da unidade {unidade?.nome ?? ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha o que fazer com o gestor atual antes de cadastrar o novo gestor.
          </p>
          <RadioGroup value={destino} onValueChange={setDestino}>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="remover" id="d-rem" className="mt-1" />
              <Label htmlFor="d-rem" className="font-normal">Remover acesso do gestor atual</Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="manter_como_profissional" id="d-man" className="mt-1" />
              <Label htmlFor="d-man" className="font-normal">Manter como profissional da unidade</Label>
            </div>
          </RadioGroup>

          <div className="flex gap-2 rounded-md border-l-4 border-l-[#F59E0B] bg-[#FEF3C7] p-3 text-sm text-[#7C2D12]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>O gestor anterior perde acesso ao painel de gestão. Esta ação não pode ser desfeita automaticamente.</p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-[#5B3A8E]">Novo gestor</h3>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <AvisoUnicidadeEmail />

          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">{erro}</div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={!valido || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Trocar gestor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

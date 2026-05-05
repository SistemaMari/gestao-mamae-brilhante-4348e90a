import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import {
  MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge, PERFIL_CLINICO_LABEL,
} from "@/lib/mensagensUnicidade";
import type { UnidadeRow } from "./AbaUnidades";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS = ["medico", "enfermeiro", "tecnico_enfermagem", "outro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidades: UnidadeRow[];
  onSucesso: () => void;
}

export default function ModalConvidarProfissional({ open, onOpenChange, unidades, onSucesso }: Props) {
  const [unidadeId, setUnidadeId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("medico");
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valido = unidadeId && nome.trim() && EMAIL_REGEX.test(email.trim()) && perfil;

  function reset() {
    setUnidadeId(""); setNome(""); setEmail(""); setPerfil("medico");
    setErro(null); setSubmitting(false);
  }
  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || submitting) return;
    setSubmitting(true);
    setErro(null);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: {
        acao: "convidar_profissional_unidade",
        unidade_id: unidadeId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        perfil,
      },
    });
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      setSubmitting(false);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) {
        setErro(MENSAGENS_UNICIDADE[codigo]);
        return;
      }
      handleOpenChange(false);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    setSubmitting(false);
    toast.success(`Convite enviado para ${email.trim()}.`);
    handleOpenChange(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Convidar profissional</DialogTitle>
          <DialogDescription>
            O profissional receberá um e-mail em nome da unidade para definir senha e acessar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId} disabled={submitting}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
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

          <AvisoUnicidadeEmail />

          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
              {erro}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valido || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

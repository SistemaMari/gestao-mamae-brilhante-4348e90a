import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import { maskTelBR } from "@/lib/cnpj";

interface Plano {
  id: string;
  nome: string;
  preco_mensal: number;
  laudos_por_mes: number;
}

export default function ModalCadastrarProfissionalConsultorio({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [crm, setCrm] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [planoId, setPlanoId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, preco_mensal, laudos_por_mes, ativo, ordem")
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []) as Plano[];
    },
  });

  const reset = () => {
    setNome(""); setEmail(""); setCrm("");
    setEspecialidade(""); setTelefone(""); setPlanoId("");
  };

  const submit = async () => {
    if (!nome.trim() || !email.trim() || !planoId) {
      toast.error("Preencha nome, e-mail e plano.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        {
          body: {
            acao: "cadastrar_profissional_consultorio",
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            crm: crm.trim() || null,
            especialidade: especialidade.trim() || null,
            telefone: telefone.trim() || null,
            plano_id: planoId,
          },
        }
      );
      if (error || data?.status === "erro") {
        const { codigo } = error ? await extrairErroEdge(error) : { codigo: data?.codigo };
        const msg = (codigo && MENSAGENS_UNICIDADE[codigo]) || data?.mensagem || FALLBACK_GENERICO;
        toast.error(msg);
        return;
      }
      toast.success(`Convite enviado para ${email}.`);
      qc.invalidateQueries({ queryKey: ["profissionais-consultorio"] });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Cadastrar profissional</DialogTitle>
          <DialogDescription>
            Um e-mail de convite será enviado para o profissional definir sua senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Nome completo *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dra. Maria Silva" />
          </div>
          <div>
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="medico@exemplo.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CRM</Label>
              <Input value={crm} onChange={(e) => setCrm(e.target.value)} maxLength={20} placeholder="Opcional" />
            </div>
            <div>
              <Label>Especialidade</Label>
              <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(maskTelBR(e.target.value))} placeholder="(11) 91234-5678" />
          </div>
          <div>
            <Label>Plano *</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — R$ {Number(p.preco_mensal).toFixed(2)} ({p.laudos_por_mes} laudos/mês)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            {submitting ? "Enviando…" : "Cadastrar e enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

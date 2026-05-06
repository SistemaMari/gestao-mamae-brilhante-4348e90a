import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  isValidCNPJ, maskCNPJInput, unmaskCNPJ, formatCNPJ, maskTelBR,
} from "@/lib/cnpj";
import {
  MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge,
} from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContratanteForm {
  id?: string;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string | null;
  data_inicio_contrato: string;
  data_termino_contrato: string | null;
  observacoes: string | null;
  created_at?: string;
}

interface Props {
  open: boolean;
  modo: "criar" | "editar";
  inicial?: ContratanteForm | null;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}

const VAZIO: ContratanteForm = {
  nome: "", cnpj: "", razao_social: "", contato_nome: "",
  contato_email: "", contato_telefone: "",
  data_inicio_contrato: "", data_termino_contrato: "",
  observacoes: "",
};

export default function ModalContratante({
  open, modo, inicial, onOpenChange, onSucesso,
}: Props) {
  const [form, setForm] = useState<ContratanteForm>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(inicial ? { ...VAZIO, ...inicial, cnpj: maskCNPJInput(inicial.cnpj) } : VAZIO);
      setErro(null);
    }
  }, [open, inicial]);

  function set<K extends keyof ContratanteForm>(k: K, v: ContratanteForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isCriar = modo === "criar";
  const cnpjDigits = unmaskCNPJ(form.cnpj);

  function validate(): string | null {
    if (form.nome.trim().length < 3) return MENSAGENS_UNICIDADE.nome_contratante_obrigatorio;
    if (form.nome.trim().length > 200) return MENSAGENS_UNICIDADE.nome_contratante_obrigatorio;
    if (isCriar) {
      if (cnpjDigits.length !== 14 || !isValidCNPJ(cnpjDigits)) return MENSAGENS_UNICIDADE.cnpj_invalido;
    }
    if (form.contato_nome.trim().length < 3) return "Nome do contato é obrigatório.";
    if (!EMAIL_REGEX.test(form.contato_email.trim())) return MENSAGENS_UNICIDADE.contato_email_invalido;
    if (!form.data_inicio_contrato) return MENSAGENS_UNICIDADE.data_inicio_obrigatoria;
    if (form.data_termino_contrato && form.data_termino_contrato <= form.data_inicio_contrato) {
      return MENSAGENS_UNICIDADE.data_termino_invalida;
    }
    return null;
  }

  function dataTerminoMaisDeUmAno(): boolean {
    if (!form.data_termino_contrato) return false;
    const lim = new Date();
    lim.setFullYear(lim.getFullYear() + 1);
    return new Date(form.data_termino_contrato) > lim;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErro(null);
    const v = validate();
    if (v) { setErro(v); return; }

    if (dataTerminoMaisDeUmAno()) {
      const ok = window.confirm(
        "A data de término está a mais de 1 ano no futuro. Deseja confirmar?"
      );
      if (!ok) return;
    }

    setSubmitting(true);

    if (isCriar) {
      const { error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: {
          acao: "criar_contratante",
          nome: form.nome.trim(),
          cnpj: cnpjDigits,
          razao_social: form.razao_social?.trim() || null,
          contato_nome: form.contato_nome.trim(),
          contato_email: form.contato_email.trim().toLowerCase(),
          contato_telefone: form.contato_telefone?.trim() || null,
          data_inicio_contrato: form.data_inicio_contrato,
          data_termino_contrato: form.data_termino_contrato || null,
          observacoes: form.observacoes?.trim() || null,
        },
      });
      setSubmitting(false);
      if (error) {
        const { codigo } = await extrairErroEdge(error);
        if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
        toast.error(FALLBACK_GENERICO);
        return;
      }
      toast.success("Contratante cadastrado.");
      onOpenChange(false);
      onSucesso();
      return;
    }

    // editar — diff parcial
    const orig = inicial!;
    const patch: Record<string, unknown> = {};
    if (form.nome.trim() !== orig.nome) patch.nome = form.nome.trim();
    if ((form.razao_social ?? "") !== (orig.razao_social ?? "")) patch.razao_social = form.razao_social?.trim() || null;
    if (form.contato_nome.trim() !== orig.contato_nome) patch.contato_nome = form.contato_nome.trim();
    if (form.contato_email.trim().toLowerCase() !== orig.contato_email) patch.contato_email = form.contato_email.trim().toLowerCase();
    if ((form.contato_telefone ?? "") !== (orig.contato_telefone ?? "")) patch.contato_telefone = form.contato_telefone?.trim() || null;
    if (form.data_inicio_contrato !== orig.data_inicio_contrato) patch.data_inicio_contrato = form.data_inicio_contrato;
    if ((form.data_termino_contrato ?? "") !== (orig.data_termino_contrato ?? "")) patch.data_termino_contrato = form.data_termino_contrato || null;
    if ((form.observacoes ?? "") !== (orig.observacoes ?? "")) patch.observacoes = form.observacoes?.trim() || null;

    if (Object.keys(patch).length === 0) {
      setSubmitting(false);
      onOpenChange(false);
      return;
    }

    const { error } = await supabase.functions.invoke("gerenciar-institucional", {
      body: { acao: "editar_contratante", id: orig.id, ...patch },
    });
    setSubmitting(false);
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success("Contratante atualizado.");
    onOpenChange(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            {isCriar ? "Cadastrar contratante" : "Editar contratante"}
          </DialogTitle>
          <DialogDescription>
            {isCriar
              ? "Cadastre uma entidade jurídica que contrata o MARI."
              : "Atualize os dados do contratante. CNPJ não é editável."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} disabled={submitting} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ *</Label>
                {isCriar ? (
                  <Input
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", maskCNPJInput(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    disabled={submitting}
                  />
                ) : (
                  <Input
                    value={formatCNPJ(form.cnpj)}
                    disabled
                    title="Não editável. Para corrigir CNPJ, cadastre novo contratante e transfira as unidades."
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Razão social</Label>
                <Input value={form.razao_social ?? ""} onChange={(e) => set("razao_social", e.target.value)} disabled={submitting} maxLength={300} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Contato — Nome *</Label>
              <Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} disabled={submitting} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contato — E-mail *</Label>
                <Input type="email" value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label>Contato — Telefone</Label>
                <Input
                  value={form.contato_telefone ?? ""}
                  onChange={(e) => set("contato_telefone", maskTelBR(e.target.value))}
                  placeholder="(11) 99999-9999"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de início *</Label>
                <Input type="date" value={form.data_inicio_contrato} onChange={(e) => set("data_inicio_contrato", e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de término</Label>
                <Input type="date" value={form.data_termino_contrato ?? ""} onChange={(e) => set("data_termino_contrato", e.target.value)} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} disabled={submitting} rows={3} />
            </div>
          </div>

          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
              {erro}
            </div>
          )}

          {!isCriar && inicial?.created_at && (
            <p className="text-xs text-muted-foreground">
              Cadastrado em {new Date(inicial.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCriar ? "Cadastrar" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

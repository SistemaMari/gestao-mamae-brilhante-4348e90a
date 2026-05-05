import { useState, useMemo, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { countries } from "@/data/locationData";
import { useCidadesIBGE } from "@/hooks/useCidadesIBGE";
import CidadeCombobox from "@/components/CidadeCombobox";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const TIPOS = ["UBS", "USF", "Hospital", "Hospital Universitário", "Clínica", "Outro"];

export interface UnidadeEditavel {
  id: string;
  nome: string;
  tipo: string | null;
  cnes: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
}

interface Props {
  unidade: UnidadeEditavel | null;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalEditarUnidade({ unidade, onClose, onSucesso }: Props) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("UBS");
  const [cnes, setCnes] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (unidade) {
      setNome(unidade.nome ?? "");
      setTipo(unidade.tipo ?? "UBS");
      setCnes(unidade.cnes ?? "");
      setPais(unidade.pais ?? "Brasil");
      setEstado(unidade.estado ?? "");
      setCidade(unidade.cidade ?? "");
    }
  }, [unidade]);

  const { cidades } = useCidadesIBGE(pais, estado);
  const country = useMemo(() => countries.find((c) => c.value === pais), [pais]);
  const states = country?.states ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unidade || submitting) return;
    const diff: Record<string, unknown> = { acao: "editar_unidade", unidade_id: unidade.id };
    if (nome.trim() !== (unidade.nome ?? "")) diff.nome = nome.trim();
    if (tipo !== (unidade.tipo ?? "")) diff.tipo = tipo;
    if (cnes !== (unidade.cnes ?? "")) diff.cnes = cnes.trim() || null;
    if (pais !== (unidade.pais ?? "")) diff.pais = pais;
    if (estado !== (unidade.estado ?? "")) diff.estado = estado;
    if (cidade !== (unidade.cidade ?? "")) diff.cidade = cidade;
    if (Object.keys(diff).length <= 2) {
      onClose();
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("gerenciar-institucional", { body: diff });
    setSubmitting(false);
    if (error) {
      await extrairErroEdge(error);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success("Unidade atualizada.");
    onSucesso();
    onClose();
  }

  return (
    <Dialog open={!!unidade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">Editar unidade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo} disabled={submitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>CNES</Label>
              <Input value={cnes} onChange={(e) => setCnes(e.target.value)} disabled={submitting} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>País</Label>
              <Select value={pais} onValueChange={(v) => { setPais(v); setEstado(""); setCidade(""); }} disabled={submitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setCidade(""); }} disabled={submitting}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <CidadeCombobox value={cidade} onChange={setCidade} cidades={cidades} disabled={submitting || !estado} />
            </div>
          </div>
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

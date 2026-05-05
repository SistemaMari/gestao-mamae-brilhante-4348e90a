import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/data/locationData";
import { useCidadesIBGE } from "@/hooks/useCidadesIBGE";
import CidadeCombobox from "@/components/CidadeCombobox";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import {
  MENSAGENS_UNICIDADE,
  FALLBACK_GENERICO,
  extrairErroEdge,
} from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS = ["UBS", "USF", "Hospital", "Hospital Universitário", "Clínica", "Outro"];
const PLANOS = ["Clínica", "Institucional"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}

export default function ModalCriarUnidade({ open, onOpenChange, onSucesso }: Props) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("UBS");
  const [cnes, setCnes] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [plano, setPlano] = useState("Institucional");
  const [gestorNome, setGestorNome] = useState("");
  const [gestorEmail, setGestorEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { cidades } = useCidadesIBGE(pais, estado);
  const country = useMemo(() => countries.find((c) => c.value === pais), [pais]);
  const states = country?.states ?? [];

  const valido =
    nome.trim() &&
    tipo &&
    estado &&
    cidade &&
    gestorNome.trim() &&
    EMAIL_REGEX.test(gestorEmail.trim());

  function reset() {
    setNome(""); setTipo("UBS"); setCnes(""); setPais("Brasil");
    setEstado(""); setCidade(""); setPlano("Institucional");
    setGestorNome(""); setGestorEmail(""); setErro(null); setSubmitting(false);
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
        acao: "criar_unidade",
        nome: nome.trim(),
        tipo,
        cnes: cnes.trim() || null,
        pais,
        estado,
        cidade,
        plano,
        gestor_nome: gestorNome.trim(),
        gestor_email: gestorEmail.trim().toLowerCase(),
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
    toast.success(`Unidade criada! E-mail enviado para ${gestorEmail.trim()}.`);
    handleOpenChange(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            Criar unidade
          </DialogTitle>
          <DialogDescription>
            A unidade será criada e o gestor receberá um e-mail para definir a senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#5B3A8E]">Dados da unidade</h3>
            <div className="space-y-1.5">
              <Label>Nome da unidade</Label>
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
                <Label>CNES (opcional)</Label>
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
                <Select value={estado} onValueChange={(v) => { setEstado(v); setCidade(""); }} disabled={submitting || states.length === 0}>
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
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={plano} onValueChange={setPlano} disabled={submitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#5B3A8E]">Gestor da unidade</h3>
            <div className="space-y-1.5">
              <Label>Nome do gestor</Label>
              <Input value={gestorNome} onChange={(e) => setGestorNome(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail do gestor</Label>
              <Input type="email" value={gestorEmail} onChange={(e) => setGestorEmail(e.target.value)} disabled={submitting} />
            </div>
          </section>

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
              Criar unidade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

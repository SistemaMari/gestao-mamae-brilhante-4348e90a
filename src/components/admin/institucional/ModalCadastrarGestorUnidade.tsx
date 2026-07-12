import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEM_VINCULO = "__sem_vinculo__";

interface UnidadeOpt { id: string; nome: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}

export default function ModalCadastrarGestorUnidade({ open, onOpenChange, onSucesso }: Props) {
  const { t } = useTranslation();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [unidadeId, setUnidadeId] = useState<string>(SEM_VINCULO);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Unidades sem gestor ativo (cruzamento client-side)
  const { data: unidadesSemGestor = [], isLoading: loadingUnidades } = useQuery({
    queryKey: ["institucional", "unidades-sem-gestor"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_unidades" },
      });
      const all = (data?.unidades ?? []) as Array<{ id: string; nome: string; gestor_id: string | null }>;
      return all
        .filter((u) => !u.gestor_id)
        .map((u) => ({ id: u.id, nome: u.nome }) as UnidadeOpt);
    },
    enabled: open,
  });

  const valido = nome.trim() && EMAIL_REGEX.test(email.trim());

  function reset() {
    setNome(""); setEmail(""); setUnidadeId(SEM_VINCULO);
    setErro(null); setSubmitting(false);
  }
  function handleOpenChange(v: boolean) { if (!v) reset(); onOpenChange(v); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || submitting) return;
    setSubmitting(true);
    setErro(null);
    const body: Record<string, unknown> = {
      acao: "cadastrar_gestor_unidade",
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
    };
    if (unidadeId !== SEM_VINCULO) body.unidade_id = unidadeId;

    const { error } = await supabase.functions.invoke("gerenciar-institucional", { body });
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
    toast.success(
      unidadeId !== SEM_VINCULO
        ? t("admin.cadastrarGestorUnidade.successLinked", { email: email.trim() })
        : t("admin.cadastrarGestorUnidade.success", { email: email.trim() }),
    );
    handleOpenChange(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            {t("admin.cadastrarGestorUnidade.title")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.cadastrarGestorUnidade.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cadastrarGestorUnidade.unitLabel")}</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId} disabled={submitting || loadingUnidades}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VINCULO}>{t("admin.cadastrarGestorUnidade.noLinkNow")}</SelectItem>
                {unidadesSemGestor.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingUnidades && unidadesSemGestor.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("admin.cadastrarGestorUnidade.noUnitAvailable")}
              </p>
            )}
          </div>
          <AvisoUnicidadeEmail />
          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
              {erro}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!valido || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.cadastrarGestorUnidade.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

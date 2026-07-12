import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import MultiSelectContratantes, { type ContratanteOption } from "./MultiSelectContratantes";
import AvisoUnicidadeEmail from "./AvisoUnicidadeEmail";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}

export default function ModalCadastrarGestorGeral({ open, onOpenChange, onSucesso }: Props) {
  const { t } = useTranslation();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [contratanteIds, setContratanteIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: contratantes } = useQuery({
    queryKey: ["institucional", "contratantes-ativos-modal"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_contratantes" },
      });
      return ((data?.contratantes ?? []) as ContratanteOption[])
        .filter((c) => c.status === "ativo" && c.nome !== "MARI Sandbox");
    },
    enabled: open,
  });

  function reset() {
    setNome(""); setEmail(""); setCargo(""); setInstituicao("");
    setContratanteIds([]); setErro(null); setSubmitting(false);
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
        contratante_ids: contratanteIds,
      },
    });
    if (error) {
      const { codigo } = await extrairErroEdge(error);
      setSubmitting(false);
      if (codigo && MENSAGENS_UNICIDADE[codigo]) { setErro(MENSAGENS_UNICIDADE[codigo]); return; }
      handleOpenChange(false); toast.error(FALLBACK_GENERICO); return;
    }
    setSubmitting(false);
    if (contratanteIds.length > 0) {
      toast.success(t("admin.cadastrarGestorGeral.successWithContratantes", { count: contratanteIds.length }));
    } else {
      toast.success(t("admin.cadastrarGestorGeral.successNoContratantes"));
    }
    handleOpenChange(false); onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.cadastrarGestorGeral.title")}</DialogTitle>
          <DialogDescription>{t("admin.cadastrarGestorGeral.description")}</DialogDescription>
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
            <Label>{t("admin.cadastrarGestorGeral.cargoLabel")}</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder={t("admin.cadastrarGestorGeral.cargoPlaceholder")} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cadastrarGestorGeral.instituicaoLabel")}</Label>
            <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.cadastrarGestorGeral.contratantesLabel")}</Label>
            <MultiSelectContratantes
              contratantes={contratantes ?? []}
              selecionadas={contratanteIds}
              onChange={setContratanteIds}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.cadastrarGestorGeral.contratantesHint")}
            </p>
          </div>

          <AvisoUnicidadeEmail />

          {erro && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">{erro}</div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!valido || submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.cadastrarGestorGeral.submitButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

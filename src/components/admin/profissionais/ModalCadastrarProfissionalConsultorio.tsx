import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  pacientes_max: number | null;
}

export default function ModalCadastrarProfissionalConsultorio({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { t } = useTranslation();
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
        .select("id, nome, preco_mensal, pacientes_max, ativo, ordem")
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
      toast.error(t("admin.cadastrarProfissionalConsultorio.fillRequired"));
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
      toast.success(t("admin.cadastrarProfissionalConsultorio.inviteSent", { email }));
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
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("admin.cadastrarProfissionalConsultorio.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.cadastrarProfissionalConsultorio.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>{t("admin.cadastrarProfissionalConsultorio.fullNameLabel")}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("admin.cadastrarProfissionalConsultorio.fullNamePlaceholder")} />
          </div>
          <div>
            <Label>{t("admin.cadastrarProfissionalConsultorio.emailLabel")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("admin.cadastrarProfissionalConsultorio.emailPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("admin.cadastrarProfissionalConsultorio.crmLabel")}</Label>
              <Input value={crm} onChange={(e) => setCrm(e.target.value)} maxLength={20} placeholder={t("admin.cadastrarProfissionalConsultorio.optionalPlaceholder")} />
            </div>
            <div>
              <Label>{t("admin.cadastrarProfissionalConsultorio.specialtyLabel")}</Label>
              <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder={t("admin.cadastrarProfissionalConsultorio.optionalPlaceholder")} />
            </div>
          </div>
          <div>
            <Label>{t("admin.cadastrarProfissionalConsultorio.phoneLabel")}</Label>
            <Input value={telefone} onChange={(e) => setTelefone(maskTelBR(e.target.value))} placeholder="(11) 91234-5678" />
          </div>
          <div>
            <Label>{t("admin.cadastrarProfissionalConsultorio.planLabel")}</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger><SelectValue placeholder={t("admin.cadastrarProfissionalConsultorio.planPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — R$ {Number(p.preco_mensal).toFixed(2)} ({p.pacientes_max
                      ? t("admin.cadastrarProfissionalConsultorio.patientsLimit", { count: p.pacientes_max })
                      : t("admin.cadastrarProfissionalConsultorio.patientsUnlimited")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={submitting} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
            {submitting ? t("admin.cadastrarProfissionalConsultorio.sending") : t("admin.cadastrarProfissionalConsultorio.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

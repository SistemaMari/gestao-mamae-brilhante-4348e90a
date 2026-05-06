import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Pencil, Check, X as XIcon, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { maskTelBR } from "@/lib/cnpj";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import ModalMudarPlanoConsultorio from "./ModalMudarPlanoConsultorio";
import AlertRevogarAcessoConsultorio from "./AlertRevogarAcessoConsultorio";
import AlertReativarAcessoConsultorio from "./AlertReativarAcessoConsultorio";

export interface ProfissionalConsultorio {
  id: string;
  nome: string;
  email: string | null;
  crm: string | null;
  especialidade: string | null;
  telefone: string | null;
  plano_id: string;
  plano_nome: string | null;
  plano_preco: number | null;
  plano_status: string;
  plano_expira_em: string | null;
  laudos_limite: number;
  laudos_usados: number;
  asaas_subscription_id: string | null;
  asaas_customer_id?: string | null;
  proxima_renovacao?: string | null;
  acesso_revogado: boolean;
  convite_pendente: boolean;
  ultimo_login: string | null;
  ultimo_laudo: string | null;
  laudos_ultimos_30d: number;
  created_at: string;
}

type EditField = "nome" | "crm" | "especialidade" | "telefone" | null;

export default function DrawerProfissional({
  profissional, onClose,
}: {
  profissional: ProfissionalConsultorio | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditField>(null);
  const [draft, setDraft] = useState("");
  const [openMudar, setOpenMudar] = useState(false);
  const [openRevogar, setOpenRevogar] = useState(false);
  const [openReativar, setOpenReativar] = useState(false);

  useEffect(() => { setEditing(null); }, [profissional?.id]);

  if (!profissional) return null;

  const startEdit = (field: Exclude<EditField, null>) => {
    setEditing(field);
    setDraft((profissional[field] ?? "") as string);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const valor = editing === "telefone" ? draft : draft.trim();
    if (editing === "nome" && valor.length < 3) {
      toast.error("Nome muito curto.");
      return;
    }
    const { data, error } = await supabase.functions.invoke(
      "gerenciar-profissionais-consultorio",
      {
        body: {
          acao: "editar_profissional_consultorio",
          profissional_id: profissional.id,
          [editing]: valor || null,
        },
      }
    );
    if (error || data?.status === "erro") {
      const { codigo } = error ? await extrairErroEdge(error) : { codigo: data?.codigo };
      toast.error(codigo || data?.mensagem || FALLBACK_GENERICO);
      return;
    }
    toast.success("Atualizado.");
    qc.invalidateQueries({ queryKey: ["profissionais-consultorio"] });
    setEditing(null);
  };

  const Field = ({ label, field, value, readonly = false }: {
    label: string; field: Exclude<EditField, null>; value: string | null; readonly?: boolean;
  }) => (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-[#F0EAFA]">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {editing === field ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(field === "telefone" ? maskTelBR(e.target.value) : e.target.value)}
            className="h-8 mt-1"
            autoFocus
          />
        ) : (
          <p className="text-sm font-medium text-[#2A1B47] truncate">{value || "—"}</p>
        )}
      </div>
      {!readonly && (
        editing === field ? (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(field)}>
            <Pencil className="h-3.5 w-3.5 text-[#7E69AB]" />
          </Button>
        )
      )}
    </div>
  );

  const pct = profissional.laudos_limite > 0
    ? Math.min(100, (profissional.laudos_usados / profissional.laudos_limite) * 100)
    : 0;

  const statusBadge = profissional.acesso_revogado ? (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">⊘ Revogado</Badge>
  ) : profissional.convite_pendente ? (
    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">⏳ Convite pendente</Badge>
  ) : (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">✓ Ativo</Badge>
  );

  return (
    <>
      <Sheet open={!!profissional} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-[Sora] text-[#5B3A8E] flex items-center gap-2">
              {profissional.nome}
              {statusBadge}
            </SheetTitle>
          </SheetHeader>

          {/* Seção 1 — Informações */}
          <section className="mt-4">
            <h3 className="font-[Sora] text-sm font-semibold text-[#7E69AB] mb-1">Informações</h3>
            <Field label="Nome" field="nome" value={profissional.nome} />
            <div className="flex items-start justify-between gap-2 py-2 border-b border-[#F0EAFA]">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium text-[#2A1B47] truncate">{profissional.email || "—"}</p>
              </div>
            </div>
            <Field label="CRM" field="crm" value={profissional.crm} readonly={!!profissional.crm} />
            <Field label="Especialidade" field="especialidade" value={profissional.especialidade} />
            <Field label="Telefone" field="telefone" value={profissional.telefone} />
          </section>

          {/* Seção 2 — Plano e Cobrança */}
          <section className="mt-6 rounded-lg border border-[#E2DCF5] bg-[#FAF8FF] p-4">
            <h3 className="font-[Sora] text-sm font-semibold text-[#7E69AB] mb-2">Plano e Cobrança</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano atual</span>
                <span className="font-semibold text-[#2A1B47]">{profissional.plano_nome ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor mensal</span>
                <span className="font-semibold text-[#2A1B47]">
                  R$ {Number(profissional.plano_preco ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{profissional.plano_status}</span>
              </div>
              {profissional.proxima_renovacao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Próxima renovação</span>
                  <span>{new Date(profissional.proxima_renovacao).toLocaleDateString("pt-BR")}</span>
                </div>
              )}
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Laudos do mês</span>
                <span>{profissional.laudos_usados}/{profissional.laudos_limite}</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full border-[#7C4DBA] text-[#7C4DBA]"
              onClick={() => setOpenMudar(true)}
              disabled={profissional.acesso_revogado}
            >
              Mudar plano
            </Button>
          </section>

          {/* Seção 3 — Histórico de Pagamentos */}
          <section className="mt-6 rounded-lg border border-dashed border-[#E2E8F0] bg-slate-50 p-4">
            <h3 className="font-[Sora] text-sm font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Histórico de pagamentos
            </h3>
            <p className="text-xs text-muted-foreground">
              O histórico de pagamentos será exibido aqui após a integração com o Asaas.
              Por enquanto, consulte diretamente no painel Asaas.
            </p>
            {profissional.asaas_customer_id && (
              <Button
                size="sm" variant="outline" className="mt-3"
                onClick={() => window.open("https://www.asaas.com/customers", "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" /> Abrir no painel Asaas
              </Button>
            )}
          </section>

          {/* Seção 4 — Ações */}
          <section className="mt-6 mb-6">
            <h3 className="font-[Sora] text-sm font-semibold text-[#7E69AB] mb-2">Ações</h3>
            <div className="space-y-2">
              <Button
                variant="outline" className="w-full justify-start"
                onClick={() => setOpenMudar(true)}
                disabled={profissional.acesso_revogado}
              >
                Mudar plano
              </Button>
              {profissional.acesso_revogado ? (
                <Button
                  variant="outline" className="w-full justify-start border-blue-300 text-blue-700"
                  onClick={() => setOpenReativar(true)}
                >
                  Reativar acesso
                </Button>
              ) : (
                <Button
                  variant="outline" className="w-full justify-start border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setOpenRevogar(true)}
                >
                  Revogar acesso
                </Button>
              )}
            </div>
          </section>
        </SheetContent>
      </Sheet>

      <ModalMudarPlanoConsultorio
        open={openMudar} onOpenChange={setOpenMudar}
        profissionalId={profissional.id}
        profissionalNome={profissional.nome}
        planoAtualId={profissional.plano_id}
      />
      <AlertRevogarAcessoConsultorio
        open={openRevogar} onOpenChange={setOpenRevogar}
        profissionalId={profissional.id}
        profissionalNome={profissional.nome}
      />
      <AlertReativarAcessoConsultorio
        open={openReativar} onOpenChange={setOpenReativar}
        profissionalId={profissional.id}
        profissionalNome={profissional.nome}
      />
    </>
  );
}

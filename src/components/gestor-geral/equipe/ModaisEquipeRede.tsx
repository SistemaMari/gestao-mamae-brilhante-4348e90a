import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import AvisoUnicidadeEmail from "@/components/admin/institucional/AvisoUnicidadeEmail";
import { MENSAGENS_UNICIDADE, FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS_CLINICOS = ["medico", "enfermeiro", "tecnico_enfermagem", "outro"];

export interface UnidadeOpcao { id: string; nome: string; }

interface PropsBase {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidades: UnidadeOpcao[];
  /** Unidade já escolhida ao abrir (botão dentro do card da unidade). */
  unidadeInicial?: string | null;
  modoVitrine?: boolean;
  onSucesso: () => void;
}

// Erros do gerenciar-institucional: primeiro os próprios do gestor geral
// (i18n), depois os de unicidade de e-mail compartilhados com o admin.
function useMensagemErro() {
  const { t, i18n } = useTranslation();
  return (codigo?: string) => {
    if (!codigo) return null;
    const chave = `consolidar.equipeRede.erros.${codigo}`;
    if (i18n.exists(chave)) return t(chave);
    return MENSAGENS_UNICIDADE[codigo] ?? null;
  };
}

async function chamarGerenciarInstitucional(body: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke("gerenciar-institucional", { body });
  if (!error) return { ok: true as const };
  const { codigo } = await extrairErroEdge(error);
  return { ok: false as const, codigo };
}

function CaixaErro({ texto }: { texto: string }) {
  return (
    <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
      {texto}
    </div>
  );
}

function SelectUnidade({
  value, onChange, unidades, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void; unidades: UnidadeOpcao[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ModalConvidarProfissionalRede({
  open, onOpenChange, unidades, unidadeInicial, modoVitrine, onSucesso,
}: PropsBase) {
  const { t } = useTranslation();
  const mensagemErro = useMensagemErro();
  const [unidadeId, setUnidadeId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("medico");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) setUnidadeId(unidadeInicial ?? "");
  }, [open, unidadeInicial]);

  const valido = unidadeId && nome.trim() && EMAIL_REGEX.test(email.trim()) && perfil;

  function fechar(v: boolean) {
    if (!v) {
      setNome(""); setEmail(""); setPerfil("medico"); setErro(null); setEnviando(false);
    }
    onOpenChange(v);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    const emailLimpo = email.trim().toLowerCase();
    if (modoVitrine) {
      toast.info(t("consolidar.equipeRede.vitrineAviso"));
      fechar(false);
      return;
    }
    setEnviando(true);
    setErro(null);
    const r = await chamarGerenciarInstitucional({
      acao: "convidar_profissional_unidade",
      unidade_id: unidadeId,
      nome: nome.trim(),
      email: emailLimpo,
      perfil,
    });
    setEnviando(false);
    if (!r.ok) {
      const msg = mensagemErro(r.codigo);
      if (msg) { setErro(msg); return; }
      fechar(false);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("consolidar.equipeRede.modalConvidar.sucesso", { email: emailLimpo }));
    fechar(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("consolidar.equipeRede.modalConvidar.title")}</DialogTitle>
          <DialogDescription>{t("consolidar.equipeRede.modalConvidar.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("consolidar.equipeRede.modalConvidar.unidade")}</Label>
            <SelectUnidade
              value={unidadeId}
              onChange={setUnidadeId}
              unidades={unidades}
              placeholder={t("consolidar.equipeRede.modalConvidar.selecione")}
              disabled={enviando}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={enviando} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("consolidar.equipeRede.modalConvidar.perfil")}</Label>
            <Select value={perfil} onValueChange={setPerfil} disabled={enviando}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERFIS_CLINICOS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`consolidar.equipeRede.perfis.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AvisoUnicidadeEmail />
          {erro && <CaixaErro texto={erro} />}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => fechar(false)} disabled={enviando}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valido || enviando} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("consolidar.equipeRede.modalConvidar.enviar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** `unidades` aqui = só as unidades da rede que ainda não têm gestor ativo. */
export function ModalCadastrarGestorRede({
  open, onOpenChange, unidades, unidadeInicial, modoVitrine, onSucesso,
}: PropsBase) {
  const { t } = useTranslation();
  const mensagemErro = useMensagemErro();
  const [unidadeId, setUnidadeId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Só ao abrir: se dependesse de `unidades`, cada recarga da lista apagaria a escolha.
  const unicaUnidade = unidades.length === 1 ? unidades[0].id : "";
  useEffect(() => {
    if (open) setUnidadeId(unidadeInicial ?? unicaUnidade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unidadeInicial]);

  const valido = unidadeId && nome.trim() && EMAIL_REGEX.test(email.trim());

  function fechar(v: boolean) {
    if (!v) {
      setNome(""); setEmail(""); setErro(null); setEnviando(false);
    }
    onOpenChange(v);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    const emailLimpo = email.trim().toLowerCase();
    if (modoVitrine) {
      toast.info(t("consolidar.equipeRede.vitrineAviso"));
      fechar(false);
      return;
    }
    setEnviando(true);
    setErro(null);
    const r = await chamarGerenciarInstitucional({
      acao: "cadastrar_gestor_unidade",
      unidade_id: unidadeId,
      nome: nome.trim(),
      email: emailLimpo,
    });
    setEnviando(false);
    if (!r.ok) {
      const msg = mensagemErro(r.codigo);
      if (msg) { setErro(msg); return; }
      fechar(false);
      toast.error(FALLBACK_GENERICO);
      return;
    }
    toast.success(t("consolidar.equipeRede.modalGestor.sucesso", { email: emailLimpo }));
    fechar(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{t("consolidar.equipeRede.modalGestor.title")}</DialogTitle>
          <DialogDescription>{t("consolidar.equipeRede.modalGestor.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("consolidar.equipeRede.modalGestor.unidade")}</Label>
            <SelectUnidade
              value={unidadeId}
              onChange={setUnidadeId}
              unidades={unidades}
              placeholder={t("consolidar.equipeRede.modalGestor.selecione")}
              disabled={enviando || unidades.length === 0}
            />
            {unidades.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("consolidar.equipeRede.modalGestor.nenhumaSemGestor")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.name")}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={enviando} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} />
          </div>
          <AvisoUnicidadeEmail />
          {erro && <CaixaErro texto={erro} />}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => fechar(false)} disabled={enviando}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valido || enviando} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("consolidar.equipeRede.modalGestor.enviar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminRow {
  id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAGENS_INLINE: Record<string, string> = {
  email_existente: "Este e-mail já é administrador.",
  email_em_uso_profissional:
    "Este e-mail já está cadastrado como profissional. Cada e-mail só pode ter um perfil — use outro e-mail.",
  email_em_uso_gestor_unidade:
    "Este e-mail já está cadastrado como gestor de unidade. Cada e-mail só pode ter um perfil — use outro e-mail.",
  email_em_uso_gestor_geral:
    "Este e-mail já está cadastrado como gestor geral. Cada e-mail só pode ter um perfil — use outro e-mail.",
  email_em_uso_outro:
    "Este e-mail já está em uso no sistema. Use outro e-mail.",
};

const FALLBACK_GENERICO =
  "Não foi possível concluir a ação. Tente novamente em instantes.";

async function extrairErroEdge(
  error: unknown,
): Promise<{ codigo?: string; mensagem?: string }> {
  let payload: any = null;
  try {
    payload = await (error as any)?.context?.json?.();
  } catch {
    /* ignore */
  }
  console.error("[gerenciar-admin]", { error, payload });
  return { codigo: payload?.codigo, mensagem: payload?.mensagem };
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export default function AdminsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [openAdd, setOpenAdd] = useState(false);
  const [removerAlvo, setRemoverAlvo] = useState<AdminRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-admin",
        { body: { acao: "listar" } },
      );
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.admins ?? []) as AdminRow[];
    },
  });

  const admins = data ?? [];
  const total = admins.length;
  const podeRemover = total > 1;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-admins"] });

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">
            Administradores
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${total} administrador${total === 1 ? "" : "es"}`}
          </p>
        </div>
        <Button
          onClick={() => setOpenAdd(true)}
          className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar administrador
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              <TableHead className="bg-[#5B3A8E] font-[Sora] text-white">
                Nome
              </TableHead>
              <TableHead className="bg-[#5B3A8E] font-[Sora] text-white">
                E-mail
              </TableHead>
              <TableHead className="bg-[#5B3A8E] font-[Sora] text-white">
                Desde
              </TableHead>
              <TableHead className="bg-[#5B3A8E] font-[Sora] text-right text-white">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {[0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive">
                  Erro ao carregar lista de administradores.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum administrador cadastrado. Isso não deveria acontecer —
                  entre em contato com o suporte.
                </TableCell>
              </TableRow>
            )}
            {admins.map((a, idx) => {
              const ehProprio = a.user_id === user?.id;
              const mostrarRemover = !ehProprio && podeRemover;
              return (
                <TableRow
                  key={a.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}
                >
                  <TableCell className="font-medium">{a.nome ?? "—"}</TableCell>
                  <TableCell>{a.email ?? "—"}</TableCell>
                  <TableCell>{formatarData(a.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {mostrarRemover ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoverAlvo(a)}
                        className="text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                      >
                        Remover
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModalAdicionar
        open={openAdd}
        onOpenChange={setOpenAdd}
        onSucesso={refresh}
      />
      <ModalConfirmarRemocao
        alvo={removerAlvo}
        onClose={() => setRemoverAlvo(null)}
        onSucesso={refresh}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal: Adicionar
// ──────────────────────────────────────────────────────────────────────────────

function ModalAdicionar({
  open,
  onOpenChange,
  onSucesso,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSucesso: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [touchedNome, setTouchedNome] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [erroBackend, setErroBackend] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nomeTrim = nome.trim();
  const emailTrim = email.trim();
  const nomeValido = nomeTrim.length > 0;
  const emailValido = EMAIL_REGEX.test(emailTrim);
  const podeSubmeter = nomeValido && emailTrim.length > 0 && emailValido;

  function reset() {
    setNome("");
    setEmail("");
    setTouchedNome(false);
    setTouchedEmail(false);
    setErroBackend(null);
    setSubmitting(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSubmeter || submitting) return;
    setSubmitting(true);
    setErroBackend(null);

    const { data, error } = await supabase.functions.invoke("gerenciar-admin", {
      body: { acao: "criar", nome: nomeTrim, email: emailTrim },
    });

    if (error) {
      const { codigo } = await extrairErroEdge(error);
      setSubmitting(false);
      if (codigo && MENSAGENS_INLINE[codigo]) {
        setErroBackend(MENSAGENS_INLINE[codigo]);
        return;
      }
      // Fallback: fecha modal e exibe toast
      handleOpenChange(false);
      toast.error(FALLBACK_GENERICO);
      return;
    }

    setSubmitting(false);
    toast.success(`Administrador adicionado! E-mail enviado para ${emailTrim}.`);
    handleOpenChange(false);
    onSucesso();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            Adicionar administrador
          </DialogTitle>
          <DialogDescription>
            O novo admin receberá um e-mail para definir a senha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-nome">Nome completo</Label>
            <Input
              id="admin-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => setTouchedNome(true)}
              disabled={submitting}
              autoComplete="name"
            />
            {touchedNome && !nomeValido && (
              <p className="text-xs text-[#DC2626]">Nome obrigatório.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-email">E-mail</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouchedEmail(true)}
              disabled={submitting}
              autoComplete="email"
            />
            {touchedEmail && emailTrim.length === 0 && (
              <p className="text-xs text-[#DC2626]">E-mail obrigatório.</p>
            )}
            {touchedEmail && emailTrim.length > 0 && !emailValido && (
              <p className="text-xs text-[#DC2626]">E-mail inválido.</p>
            )}
          </div>

          <div className="flex gap-2 rounded-md bg-[#F5F3FA] p-3 text-sm text-[#4B3F66]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Cada e-mail só pode ter um perfil no sistema. Se esta pessoa já
              usa a MARI como profissional, gestor de unidade ou gestor geral,
              ela precisará usar um e-mail diferente para o acesso de
              administrador.
            </p>
          </div>

          {erroBackend && (
            <div className="rounded-md border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-sm text-[#DC2626]">
              {erroBackend}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!podeSubmeter || submitting}
              className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal: Confirmar remoção
// ──────────────────────────────────────────────────────────────────────────────

function ModalConfirmarRemocao({
  alvo,
  onClose,
  onSucesso,
}: {
  alvo: AdminRow | null;
  onClose: () => void;
  onSucesso: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmar() {
    if (!alvo || submitting) return;
    setSubmitting(true);

    const { error } = await supabase.functions.invoke("gerenciar-admin", {
      body: { acao: "remover", admin_id: alvo.id },
    });

    setSubmitting(false);

    if (error) {
      const { codigo } = await extrairErroEdge(error);
      if (codigo === "auto_remocao") {
        toast.error("Você não pode remover a si mesmo.");
      } else if (codigo === "ultimo_admin") {
        toast.error("Não é possível remover o último administrador.");
      } else {
        toast.error(FALLBACK_GENERICO);
      }
      onClose();
      return;
    }

    toast.success("Administrador removido.");
    onClose();
    onSucesso();
  }

  return (
    <AlertDialog open={!!alvo} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="border-l-4 border-l-[#DC2626]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-[Sora] text-[#DC2626]">
            Remover administrador
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover{" "}
            <strong>{alvo?.nome ?? "este admin"}</strong> como administrador?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirmar();
            }}
            disabled={submitting}
            className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar remoção
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

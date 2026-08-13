import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * V4 — exclusão de gestante (hard delete). Confirmação deliberada para uma ação
 * IRREVERSÍVEL: exige (1) marcar o reconhecimento e (2) confirmar a SENHA DE LOGIN
 * do próprio usuário (re-autenticação, igual ao /perfil). A permissão real é do
 * backend (RLS): consultório dono, gestor da unidade e gestor geral das unidades
 * dele. Centraliza a re-auth + o delete; o caller só trata o "depois" (onExcluida:
 * navegar de volta na ficha, ou refazer a lista).
 */
interface ExcluirGestanteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string | null;
  nomeGestante: string;
  /** Chamado após a exclusão bem-sucedida (ex.: refetch da lista ou navegação). */
  onExcluida?: () => void;
}

export default function ExcluirGestanteModal({
  open,
  onOpenChange,
  pacienteId,
  nomeGestante,
  onExcluida,
}: ExcluirGestanteModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reconhecido, setReconhecido] = useState(false);
  const [senha, setSenha] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  // Reseta o estado sempre que o modal abre/fecha — nunca vem pré-preenchido.
  useEffect(() => {
    if (!open) {
      setReconhecido(false);
      setSenha('');
      setExcluindo(false);
    }
  }, [open]);

  const confirmar = async () => {
    if (!pacienteId) return;
    const email = user?.email;
    if (!email) {
      toast.error(t('fichaPaciente.excluir.erro'));
      return;
    }
    if (!senha) {
      toast.error(t('fichaPaciente.excluir.senhaObrigatoria'));
      return;
    }
    setExcluindo(true);
    // 1) Re-autentica com a senha de login (confirma que é a pessoa certa).
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (authErr) {
      setExcluindo(false);
      toast.error(t('fichaPaciente.excluir.senhaErrada'));
      return;
    }
    // 2) Exclui (o RLS decide de fato; as tabelas-filhas saem por ON DELETE CASCADE).
    const { error } = await supabase.from('pacientes').delete().eq('id', pacienteId);
    setExcluindo(false);
    if (error) {
      toast.error(t('fichaPaciente.excluir.erro'));
      return;
    }
    toast.success(t('fichaPaciente.excluir.sucesso', { nome: nomeGestante }));
    onOpenChange(false);
    onExcluida?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {t('fichaPaciente.excluir.title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t('fichaPaciente.excluir.desc', { nome: nomeGestante })}</p>
              <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                <Checkbox
                  checked={reconhecido}
                  onCheckedChange={(v) => setReconhecido(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs font-medium">{t('fichaPaciente.excluir.ackLabel')}</span>
              </label>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  {t('fichaPaciente.excluir.senhaLabel')}
                </label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={t('fichaPaciente.excluir.senhaPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && reconhecido && senha && !excluindo) {
                      e.preventDefault();
                      void confirmar();
                    }
                  }}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>{t('fichaPaciente.excluir.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reconhecido || !senha || excluindo}
            onClick={(e) => {
              // Impede o fechamento automático do AlertDialog antes do await terminar.
              e.preventDefault();
              void confirmar();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {excluindo ? t('fichaPaciente.excluir.excluindo') : t('fichaPaciente.excluir.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

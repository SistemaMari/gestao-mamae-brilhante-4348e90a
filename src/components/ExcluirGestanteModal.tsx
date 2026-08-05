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

/**
 * V4 — exclusão de gestante (hard delete). Confirmação deliberada para uma ação
 * IRREVERSÍVEL: exige marcar o reconhecimento antes de liberar o botão vermelho.
 * A permissão real é do backend (RLS): consultório dono, gestor da unidade e
 * gestor geral das unidades dele. O profissional institucional e o admin não têm.
 */
interface ExcluirGestanteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeGestante: string;
  onConfirmar: () => void | Promise<void>;
  excluindo?: boolean;
}

export default function ExcluirGestanteModal({
  open,
  onOpenChange,
  nomeGestante,
  onConfirmar,
  excluindo,
}: ExcluirGestanteModalProps) {
  const { t } = useTranslation();
  const [reconhecido, setReconhecido] = useState(false);

  // Reseta o reconhecimento sempre que o modal abre/fecha — nunca vem pré-marcado.
  useEffect(() => {
    if (!open) setReconhecido(false);
  }, [open]);

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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>{t('fichaPaciente.excluir.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reconhecido || excluindo}
            onClick={(e) => {
              // Impede o fechamento automático do AlertDialog antes do await terminar.
              e.preventDefault();
              void onConfirmar();
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

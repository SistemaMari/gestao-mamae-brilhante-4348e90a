import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BlockingModalProps {
  open: boolean;
  onClose: () => void;
  /** Nome amigável do plano atual (ex.: "Inicial"). Opcional. */
  planoNome?: string | null;
}

/**
 * Guardrail genérico de limite de plano.
 * Texto único, neutro — não menciona pacientes nem números de cota.
 * Disparado quando uma RPC de capacidade retorna false.
 */
export default function BlockingModal({ open, onClose, planoNome }: BlockingModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const planoLabel = planoNome ?? t('blockingModal.currentPlanFallback');
  const mensagem = t('blockingModal.message', { plano: planoLabel });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-clinical-danger-bg">
            <ShieldAlert className="h-6 w-6 text-clinical-danger-icon" />
          </div>
          <DialogTitle className="text-center font-heading">{t('blockingModal.title')}</DialogTitle>
          <DialogDescription className="text-center">
            {mensagem}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            className="w-full"
            onClick={() => { onClose(); navigate('/planos'); }}
          >
            {t('blockingModal.viewPlans')}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

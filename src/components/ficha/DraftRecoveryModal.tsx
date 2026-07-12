import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Modal de recuperação de rascunho local (Prompt 34B seção 3.5).
 *
 * Aparece quando a reconciliação detecta um draft em localStorage MAIS RECENTE
 * que os dados do servidor. Não tem botão "X" / "Cancelar" — o usuário precisa
 * escolher uma das duas opções pra evitar estado ambíguo (seção 3.5.2).
 *
 * Diagramação (revista):
 *  - max-w-lg dá espaço suficiente pros 2 botões em desktop sem cortar texto.
 *  - Em mobile, botões empilham com o PRIMÁRIO em cima (mais visível);
 *    em sm+ ficam lado a lado com primário à direita (convenção web).
 *  - Padding generoso no header e footer.
 */

interface Props {
  open: boolean;
  /** ISO 8601 do savedAt do rascunho local. */
  draftTimestamp: string;
  onRecover: () => void;
  onDiscard: () => void;
}

function formatDataHora(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DraftRecoveryModal({
  open,
  draftTimestamp,
  onRecover,
  onDiscard,
}: Props) {
  const { t, i18n } = useTranslation();
  // O AlertDialog do shadcn é controlado: omitimos onOpenChange para impedir
  // fechamento por clique fora / ESC. Só sai via clique nos botões.
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg sm:max-w-xl">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="flex items-center gap-2.5 text-lg">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#7C4DBA]" />
            {t('ficha.draftRecovery.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {t('ficha.draftRecovery.descBefore')}{' '}
            <span className="font-semibold text-foreground">
              {formatDataHora(draftTimestamp, i18n.language)}
            </span>
            {t('ficha.draftRecovery.descAfter')}
            <br />
            {t('ficha.draftRecovery.question')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Botões: em mobile empilha com primário em cima (flex-col-reverse).
            Em sm+ fica lado a lado, primário à direita (convenção). */}
        <AlertDialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            variant="outline"
            onClick={onDiscard}
            type="button"
            className="w-full sm:w-auto"
          >
            {t('ficha.draftRecovery.discard')}
          </Button>
          <AlertDialogAction
            onClick={onRecover}
            className="w-full bg-[#7C4DBA] text-white hover:bg-[#7E69AB] sm:w-auto"
          >
            {t('ficha.draftRecovery.recover')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

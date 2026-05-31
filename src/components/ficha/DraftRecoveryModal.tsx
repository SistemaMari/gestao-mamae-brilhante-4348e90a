import { AlertCircle } from 'lucide-react';
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
 */

interface Props {
  open: boolean;
  /** ISO 8601 do savedAt do rascunho local. */
  draftTimestamp: string;
  onRecover: () => void;
  onDiscard: () => void;
}

function formatDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
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
  // O AlertDialog do shadcn é controlado: omitimos onOpenChange para impedir
  // fechamento por clique fora / ESC. Só sai via clique nos botões.
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#7C4DBA]" />
            Rascunho não salvo encontrado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-2">
            Existe um rascunho desta ficha salvo localmente em{' '}
            <strong>{formatDataHora(draftTimestamp)}</strong>, que não foi enviado
            ao servidor. Deseja recuperar ou descartar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onDiscard} type="button">
            Descartar e usar dados do servidor
          </Button>
          <AlertDialogAction
            onClick={onRecover}
            className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
          >
            Recuperar rascunho
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

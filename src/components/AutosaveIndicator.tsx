import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import type { AutosaveStatus } from '@/hooks/useAutosave';
import { cn } from '@/lib/utils';

interface Props {
  status: AutosaveStatus;
  className?: string;
}

const labels: Record<AutosaveStatus, string> = {
  idle: '',
  dirty: 'Alterações não salvas',
  saving: 'Salvando...',
  saved: 'Salvo',
  error: 'Erro ao salvar',
};

export default function AutosaveIndicator({ status, className }: Props) {
  if (status === 'idle') return null;

  const Icon =
    status === 'saving' ? Loader2 :
    status === 'saved' ? Check :
    status === 'error' ? AlertCircle :
    Cloud;

  const color =
    status === 'error' ? 'text-destructive' :
    status === 'saved' ? 'text-emerald-600' :
    'text-muted-foreground';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium transition-opacity',
        color,
        className,
      )}
      aria-live="polite"
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      <span>{labels[status]}</span>
    </div>
  );
}

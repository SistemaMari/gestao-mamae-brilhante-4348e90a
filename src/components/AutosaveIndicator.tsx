import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AutosaveStatus } from '@/hooks/useAutosave';
import { cn } from '@/lib/utils';

interface Props {
  status: AutosaveStatus;
  className?: string;
}

export default function AutosaveIndicator({ status, className }: Props) {
  const { t } = useTranslation();

  const labels: Record<AutosaveStatus, string> = {
    idle: '',
    dirty: t('autosaveIndicator.dirty'),
    saving: t('autosaveIndicator.saving'),
    saved: t('autosaveIndicator.saved'),
    error: t('autosaveIndicator.error'),
  };

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

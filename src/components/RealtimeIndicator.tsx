import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Props {
  status: 'idle' | 'connecting' | 'live' | 'error';
  className?: string;
}

const LABEL_KEY: Record<Props['status'], string> = {
  idle: 'realtimeIndicator.idle',
  connecting: 'realtimeIndicator.connecting',
  live: 'realtimeIndicator.live',
  error: 'realtimeIndicator.error',
};

const COLOR: Record<Props['status'], string> = {
  idle: 'text-muted-foreground',
  connecting: 'text-amber-600',
  live: 'text-emerald-600',
  error: 'text-destructive',
};

export default function RealtimeIndicator({ status, className }: Props) {
  const { t } = useTranslation();
  const label = t(LABEL_KEY[status]);
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', COLOR[status], className)}
      title={label}
    >
      <span className="relative flex h-2 w-2">
        {status === 'live' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            status === 'live' && 'bg-emerald-500',
            status === 'connecting' && 'bg-amber-500',
            status === 'error' && 'bg-destructive',
            status === 'idle' && 'bg-muted-foreground/50',
          )}
        />
      </span>
      <Radio className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  titulo: string;
  valor: number | null;
  sublabel: string;
  tooltip: string;
  icon: LucideIcon;
  loading?: boolean;
  erro?: boolean;
}

export default function CardResumoEquipe({
  titulo, valor, sublabel, tooltip, icon: Icon, loading, erro,
}: Props) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
            <CardInfoTooltip text={tooltip} />
          </div>
          <div className="mt-2 min-h-[40px] flex items-end">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span
                className="font-heading text-[32px] font-bold leading-none"
                style={{ color: '#1E293B' }}
              >
                {erro ? '—' : (valor ?? 0)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F0FF]">
          <Icon className="h-5 w-5 text-[#9b87f5]" />
        </div>
      </div>
    </div>
  );
}

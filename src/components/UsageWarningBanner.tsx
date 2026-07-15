import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface UsageWarningBannerProps {
  usados: number;
  limite: number | null;
}

export default function UsageWarningBanner({ usados, limite }: UsageWarningBannerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (limite === null) return null;

  const percentual = limite > 0 ? (usados / limite) * 100 : 0;

  if (percentual < 90) return null;

  const atingiu = usados >= limite;
  const restantes = Math.max(0, limite - usados);
  const pct = Math.min(100, Math.round(percentual));

  // Paleta lilás alinhada ao design system, sem faixa amarela agressiva.
  const cor = atingiu ? '#EF4444' : '#7E69AB';
  const bg = atingiu ? '#FEF2F2' : '#F5F0FF';
  const borda = atingiu ? '#FCA5A5' : '#E9E3FA';

  return (
    <div className="mx-auto mb-4 max-w-[1200px] px-1">
      <div
        className="flex items-center gap-4 rounded-2xl border p-4"
        style={{ background: bg, borderColor: borda }}
        role="status"
      >
        <div
          className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'white', color: cor, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          {atingiu ? <AlertTriangle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}>
            {atingiu
              ? t('usageWarning.limitReached')
              : t('usageWarning.remaining', { count: restantes })}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="relative block h-1.5 w-40 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(126, 105, 171, 0.15)' }}
            >
              <span
                className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: cor }}
              />
            </span>
            <span className="text-xs tabular-nums" style={{ color: '#64748B' }}>
              {usados} / {limite} · {pct}%
            </span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('/planos')}
          className="shrink-0"
          style={{ background: cor, color: 'white' }}
        >
          {atingiu ? t('usageWarning.upgradePlan') : t('usageWarning.viewPlans')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

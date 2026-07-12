import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfissionalData } from '@/hooks/useProfissionalData';

/**
 * Banner global de uso de laudos.
 * - Esconde quando usado < 70% do limite.
 * - Aviso amarelo entre 70%-99%.
 * - Aviso vermelho quando 100% (limite atingido).
 * - Não mostra para planos institucionais ilimitados (limite >= 9999).
 */
export default function BannerUsoLaudos() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profissionalData, loading } = useProfissionalData();

  if (loading || !profissionalData) return null;

  const { laudos_usados, laudos_limite } = profissionalData;
  if (laudos_limite >= 9999) return null;

  const pct = laudos_limite > 0 ? laudos_usados / laudos_limite : 0;
  if (pct < 0.7) return null;

  const atingido = laudos_usados >= laudos_limite;
  const restantes = Math.max(0, laudos_limite - laudos_usados);

  return (
    <div
      className={
        'border-b px-6 py-3 print:hidden ' +
        (atingido
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-amber-300/50 bg-amber-50')
      }
      role="status"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
        {atingido ? (
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
        )}

        <div className="flex-1 min-w-[220px]">
          <p className={'text-sm font-medium ' + (atingido ? 'text-destructive' : 'text-amber-900')}>
            {atingido
              ? t('bannerUsoLaudos.limitReached')
              : t('bannerUsoLaudos.remaining', { count: restantes })}
          </p>
          <p className={'text-xs ' + (atingido ? 'text-destructive/80' : 'text-amber-800/80')}>
            {t('bannerUsoLaudos.usedOfLimit', { usados: laudos_usados, limite: laudos_limite })}
          </p>
        </div>

        <Button
          size="sm"
          variant={atingido ? 'destructive' : 'default'}
          onClick={() => navigate('/planos')}
        >
          {atingido ? t('bannerUsoLaudos.upgradePlan') : t('bannerUsoLaudos.viewPlans')}
        </Button>
      </div>
    </div>
  );
}

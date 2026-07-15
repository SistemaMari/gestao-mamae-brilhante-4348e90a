import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfissionalData } from '@/hooks/useProfissionalData';

/**
 * Banner global de uso de pacientes (cota do plano).
 * - Esconde quando usado < 70% do limite.
 * - Aviso amarelo entre 70%-99%.
 * - Aviso vermelho quando 100% (limite atingido).
 * - Não mostra quando o plano não tem limite de pacientes (institucional/ilimitado).
 */
export default function BannerUsoPacientes() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profissionalData, loading } = useProfissionalData();

  if (loading || !profissionalData) return null;

  const pacientesMax = profissionalData.planos?.pacientes_max ?? null;
  if (pacientesMax === null) return null;

  const { pacientes_usados } = profissionalData;
  const pct = pacientesMax > 0 ? pacientes_usados / pacientesMax : 0;
  if (pct < 0.7) return null;

  const atingido = pacientes_usados >= pacientesMax;
  const restantes = Math.max(0, pacientesMax - pacientes_usados);

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
              ? t('bannerUsoPacientes.limitReached')
              : t('bannerUsoPacientes.remaining', { count: restantes })}
          </p>
          <p className={'text-xs ' + (atingido ? 'text-destructive/80' : 'text-amber-800/80')}>
            {t('bannerUsoPacientes.usedOfLimit', { usados: pacientes_usados, limite: pacientesMax })}
          </p>
        </div>

        <Button
          size="sm"
          variant={atingido ? 'destructive' : 'default'}
          onClick={() => navigate('/planos')}
        >
          {atingido ? t('bannerUsoPacientes.upgradePlan') : t('bannerUsoPacientes.viewPlans')}
        </Button>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { avaliarPlanoStatus } from '@/lib/planoStatus';

/**
 * Banner global de status do plano:
 * - inadimplente/suspenso/cancelado: vermelho
 * - expirado: vermelho
 * - expirando em <=5 dias: amarelo (aviso antecipado)
 * - ok: não renderiza
 *
 * O BLOQUEIO TOTAL é feito no AppShellClinico (intercepta antes de renderizar o shell).
 * Este banner fica visível apenas no modo "expirando" (aviso não-bloqueante).
 */
export default function BannerStatusPlano() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profissionalData, loading } = useProfissionalData();

  if (loading || !profissionalData) return null;

  const info = avaliarPlanoStatus(
    profissionalData.plano_status,
    profissionalData.plano_expira_em,
    profissionalData.proxima_renovacao,
  );

  // Bloqueados são interceptados antes pelo AppShellClinico; aqui só mostra aviso
  if (info.severidade === 'ok' || info.bloqueado) return null;

  const Icon = info.severidade === 'expirado' ? AlertTriangle : Clock;

  return (
    <div
      className="border-b border-amber-300/50 bg-amber-50 px-6 py-3 print:hidden"
      role="alert"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-medium text-amber-900">{info.titulo}</p>
          <p className="text-xs text-amber-800/80">{info.descricao}</p>
        </div>
        <Button size="sm" onClick={() => navigate('/planos')}>
          {t('bannerStatusPlano.viewPlans')}
        </Button>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { avaliarPlanoStatus } from '@/lib/planoStatus';
import { useRenovacaoPlano } from '@/hooks/useRenovacaoPlano';

/**
 * Banner global de status do plano:
 * - inadimplente/suspenso/cancelado: vermelho
 * - expirado: vermelho
 * - plano de consultório a até 60 dias do fim do ano pago: renovar ou não
 *   (a MARI não renova sozinha; ver useRenovacaoPlano)
 * - expirando em <=5 dias: amarelo (aviso antecipado)
 * - ok: não renderiza
 *
 * O BLOQUEIO TOTAL é feito no AppShellClinico (intercepta antes de renderizar o shell).
 * Este banner fica visível apenas no modo "expirando" (aviso não-bloqueante).
 */
export default function BannerStatusPlano() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profissionalData, loading } = useProfissionalData();
  const renov = useRenovacaoPlano();

  if (loading || !profissionalData) return null;

  const info = avaliarPlanoStatus(
    profissionalData.plano_status,
    profissionalData.plano_expira_em,
    profissionalData.proxima_renovacao,
  );

  // Bloqueados são interceptados antes pelo AppShellClinico; aqui só mostra aviso
  if (info.bloqueado) return null;

  if (!renov.loading && renov.aplica && renov.emJanela && renov.fim) {
    const data = renov.fim.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dias = renov.dias ?? 0;
    // Já pediu para não renovar: só lembra até quando vai o acesso.
    if (renov.pedido) {
      return (
        <div className="border-b border-[#E8E0FF] bg-[#F5F0FF] px-6 py-3 print:hidden" role="status">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-[#7E69AB]" />
            <p className="flex-1 min-w-[220px] text-sm text-[#475569]">
              {t('bannerStatusPlano.naoRenovaAte', { data })}
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate('/planos')}>
              {t('bannerStatusPlano.renovar')}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="border-b border-amber-300/50 bg-amber-50 px-6 py-3 print:hidden" role="alert">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium text-amber-900">
              {dias === 0 ? t('bannerStatusPlano.venceHoje') : t('bannerStatusPlano.venceEm', { count: dias, data })}
            </p>
            <p className="text-xs text-amber-800/80">{t('bannerStatusPlano.renoveSemPerder')}</p>
          </div>
          <Button size="sm" onClick={() => navigate('/planos')}>
            {t('bannerStatusPlano.renovar')}
          </Button>
          <Button size="sm" variant="ghost" className="text-amber-900" onClick={() => navigate('/perfil#meu-plano')}>
            {t('bannerStatusPlano.naoVouRenovar')}
          </Button>
        </div>
      </div>
    );
  }

  if (info.severidade === 'ok') return null;

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

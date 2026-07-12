import { HeartPulse, Syringe, Activity, CalendarClock, AlertTriangle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PainelPerfilClinico } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  data: PainelPerfilClinico;
  loading?: boolean;
  error?: string | null;
}

function formatIg(dias: number | null) {
  if (dias == null) return '—';
  const w = Math.floor(dias / 7);
  const d = dias % 7;
  return `${w}s ${d}d`;
}

type StatusPrevalencia = 'subnotificacao' | 'esperado' | 'alto_risco';

export default function BlocoPerfilClinico({ data, loading, error }: Props) {
  const { t } = useTranslation();
  const status: StatusPrevalencia =
    data.prevalencia_pct < 7
      ? 'subnotificacao'
      : data.prevalencia_pct > 18
        ? 'alto_risco'
        : 'esperado';

  const dentroDoBenchmark = status === 'esperado';

  return (
    <section className="space-y-3" data-pdf-section="perfil">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {t('gestao.blocoPerfilClinico.title')}
      </h2>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : data.total_acompanhadas === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t('gestao.blocoPerfilClinico.semGestantes')}
        </div>
      ) : (
        <>
          {status === 'subnotificacao' && (
            <div className="mb-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-900">
              ⚠️ {t('gestao.blocoPerfilClinico.alertaSubnotificacao', { pct: data.prevalencia_pct })}
            </div>
          )}
          {status === 'alto_risco' && (
            <div className="mb-4 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4 text-sm text-orange-900">
              ⚠️ {t('gestao.blocoPerfilClinico.alertaAltoRisco', { pct: data.prevalencia_pct })}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{t('gestao.blocoPerfilClinico.prevalenciaDmg')}</p>
                    <CardInfoTooltip text={t('gestao.blocoPerfilClinico.ttPrevalencia')} />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {data.prevalencia_pct}%
                    </p>
                    {status === 'subnotificacao' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        <AlertTriangle className="h-3 w-3" />
                        {t('gestao.blocoPerfilClinico.badgeSubnotificacao')}
                      </span>
                    )}
                    {status === 'alto_risco' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        <AlertCircle className="h-3 w-3" />
                        {t('gestao.blocoPerfilClinico.badgeAltoRisco')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.total_dmg_confirmadas} {t('common.of')} {data.total_acompanhadas}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      dentroDoBenchmark
                        ? 'text-emerald-600'
                        : status === 'alto_risco'
                          ? 'text-orange-600'
                          : 'text-yellow-700'
                    }`}
                  >
                    {t('gestao.blocoPerfilClinico.esperadoFebrasgo')}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: '#E8E0FF' }}>
                  <HeartPulse className="h-5 w-5" style={{ color: '#7E69AB' }} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{t('gestao.blocoPerfilClinico.emInsulina')}</p>
                    <CardInfoTooltip text={t('gestao.blocoPerfilClinico.ttInsulina')} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {data.em_insulina}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('gestao.blocoPerfilClinico.pctDasDmg', { pct: data.em_insulina_pct })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Syringe className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{t('management.dmgPriorPregnancy')}</p>
                    <CardInfoTooltip text={t('gestao.blocoPerfilClinico.ttDmgAnterior')} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {data.dmg_anterior}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('gestao.blocoPerfilClinico.pctDasAtivas', { pct: data.dmg_anterior_pct })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{t('gestao.blocoPerfilClinico.igMediaDiagnostico')}</p>
                    <CardInfoTooltip text={t('gestao.blocoPerfilClinico.ttIgMedia')} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {formatIg(data.ig_media_diagnostico_dias)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('gestao.blocoPerfilClinico.ultimos90dias')}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

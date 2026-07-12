import { Check, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CardInfoTooltip from './CardInfoTooltip';

export interface Sobrecarregado {
  nome: string;
  pacientes: number;
}

interface Props {
  tempoMedioDias: number | null;
  sobrecarregados: Sobrecarregado[];
  loading?: boolean;
  erroTempo?: boolean;
  erroSobrecarga?: boolean;
}

function Skeleton() {
  return <div className="h-10 w-32 animate-pulse rounded bg-muted" />;
}

export default function IndicadoresFluxo({
  tempoMedioDias,
  sobrecarregados,
  loading,
  erroTempo,
  erroSobrecarga,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {/* Tempo médio até 1º laudo */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {t('gestao.indicadoresFluxo.tempoMedioTitle')}
          </h3>
          <CardInfoTooltip text={t('gestao.indicadoresFluxo.tempoMedioTooltip')} />
        </div>
        {loading ? (
          <Skeleton />
        ) : erroTempo ? (
          <p className="text-sm text-muted-foreground">{t('gestao.indicadoresFluxo.loadError')}</p>
        ) : tempoMedioDias === null ? (
          <>
            <div className="text-3xl font-semibold text-foreground">—</div>
            <p className="mt-1 text-xs text-muted-foreground">{t('gestao.indicadoresFluxo.semDados')}</p>
          </>
        ) : (() => {
          const status =
            tempoMedioDias <= 14 ? 'ideal' : tempoMedioDias <= 30 ? 'atencao' : 'critico';
          const cor =
            status === 'atencao' ? '#BA7517' : status === 'critico' ? '#A32D2D' : undefined;
          const sublabel =
            status === 'atencao'
              ? t('gestao.indicadoresFluxo.sublabelAtencao')
              : status === 'critico'
              ? t('gestao.indicadoresFluxo.sublabelCritico')
              : t('gestao.indicadoresFluxo.sublabelIdeal');
          return (
            <>
              <div
                className="text-3xl font-semibold tabular-nums"
                style={cor ? { color: cor } : undefined}
              >
                <span className={cor ? '' : 'text-foreground'}>
                  {t('gestao.indicadoresFluxo.dias', { valor: tempoMedioDias.toFixed(1).replace('.', ',') })}
                </span>
              </div>
              <p
                className="mt-1 text-xs"
                style={cor ? { color: cor } : undefined}
              >
                <span className={cor ? '' : 'text-muted-foreground'}>{sublabel}</span>
              </p>
            </>
          );
        })()}
      </div>

      {/* Profissional sobrecarregado */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {t('gestao.indicadoresFluxo.sobrecargaTitle')}
          </h3>
          <CardInfoTooltip text={t('gestao.indicadoresFluxo.sobrecargaTooltip')} />
        </div>
        {loading ? (
          <Skeleton />
        ) : erroSobrecarga ? (
          <p className="text-sm text-muted-foreground">{t('gestao.indicadoresFluxo.loadError')}</p>
        ) : sobrecarregados.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Check className="h-4 w-4" style={{ color: '#1D9E75' }} />
            {t('gestao.indicadoresFluxo.cargaEquilibrada')}
          </div>
        ) : (
          <div className="space-y-3">
            {sobrecarregados.map((s, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4" style={{ color: '#BA7517' }} />
                  {t('gestao.indicadoresFluxo.profPacientes', { nome: s.nome, count: s.pacientes })}
                </div>
                <p className="ml-6 mt-0.5 text-xs text-muted-foreground">
                  {t('gestao.indicadoresFluxo.considereRedistribuir')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

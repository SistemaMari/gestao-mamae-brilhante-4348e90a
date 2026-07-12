import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PainelGargalos } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  data: PainelGargalos;
  loading?: boolean;
  error?: string | null;
  hideVerPacientesLink?: boolean;
  subtitle?: string;
}

type Severidade = 'amarelo' | 'laranja' | 'vermelho';

const PALETA: Record<Severidade, { border: string; bg: string; iconBg: string; iconText: string }> = {
  amarelo: {
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-700',
  },
  laranja: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
  },
  vermelho: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconText: 'text-red-700',
  },
};

export default function BlocoGargalos({ data, loading, error, hideVerPacientesLink, subtitle }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/vitrine') ? '/vitrine/gestao' : '/gestao';

  const TOOLTIPS: Record<string, string> = {
    sem_gj: t('gestao.blocoGargalos.tooltipSemGj'),
    gtt: t('gestao.blocoGargalos.tooltipGtt'),
    sem_retorno: t('gestao.blocoGargalos.tooltipSemRetorno'),
  };

  const itens: Array<{
    key: string;
    filtroParam: 'sem_gj_primeira' | 'atrasadas_gtt' | 'sem_retorno';
    titulo: string;
    descricao: string;
    severidade: Severidade;
    data: { count: number; paciente_ids: string[] };
  }> = [
    {
      key: 'sem_gj',
      filtroParam: 'sem_gj_primeira',
      titulo: t('gestao.blocoGargalos.semGjTitulo'),
      descricao: t('gestao.blocoGargalos.semGjDescricao'),
      severidade: 'amarelo',
      data: data.sem_gj_primeira_consulta,
    },
    {
      key: 'gtt',
      filtroParam: 'atrasadas_gtt',
      titulo: t('gestao.blocoGargalos.gttTitulo'),
      descricao: t('gestao.blocoGargalos.gttDescricao'),
      severidade: 'laranja',
      data: data.atrasadas_gtt,
    },
    {
      key: 'sem_retorno',
      filtroParam: 'sem_retorno',
      titulo: t('gestao.blocoGargalos.semRetornoTitulo'),
      descricao: t('gestao.blocoGargalos.semRetornoDescricao'),
      severidade: 'vermelho',
      data: data.confirmadas_sem_retorno,
    },
  ];

  const total = itens.reduce((s, i) => s + i.data.count, 0);

  return (
    <section className="space-y-3" data-pdf-section="gargalos">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('gestao.blocoGargalos.title')}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          {t('gestao.blocoGargalos.emptyState')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {itens.map(it => {
            const tem = it.data.count > 0;
            const p = PALETA[it.severidade];
            return (
              <div
                key={it.key}
                className={`rounded-xl border p-5 ${
                  tem ? `${p.border} ${p.bg}` : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      tem ? p.iconBg : 'bg-muted'
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${tem ? p.iconText : 'text-muted-foreground'}`}
                    />
                  </div>
                  <span className="font-heading text-2xl font-bold text-foreground tabular-nums">
                    {it.data.count}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground">{it.titulo}</p>
                  <CardInfoTooltip text={TOOLTIPS[it.key]} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{it.descricao}</p>
                {tem && !hideVerPacientesLink && (
                  <button
                    onClick={() => {
                      const ids = it.data.paciente_ids.join(',');
                      navigate(`${basePath}/fichas?filtro=${it.filtroParam}&ids=${ids}`);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t('gestao.blocoGargalos.verPacientes')} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

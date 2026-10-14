import { Activity, FileText, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PainelOperacao } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  data: PainelOperacao;
  loading?: boolean;
  error?: string | null;
}

interface CardProps {
  title: string;
  tooltip: string;
  value: number | string;
  subtitle: string;
  Icon: React.ElementType;
}

function Card({ title, tooltip, value, subtitle, Icon }: CardProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <CardInfoTooltip text={tooltip} />
          </div>
          <p className="mt-1 font-heading text-[32px] font-bold leading-none text-[#1E293B]">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F5F0FF]">
          <Icon className="h-5 w-5 text-[#9b87f5]" />
        </div>
      </div>
    </div>
  );
}

export default function BlocoOperacao({ data, loading, error }: Props) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3" data-pdf-section="operacao">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {t('gestao.blocoOperacao.title')}
      </h2>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            title={t('gestao.blocoOperacao.gestantesTitle')}
            tooltip={t('gestao.blocoOperacao.gestantesTooltip')}
            value={data.gestantes_ativas}
            subtitle={t('gestao.blocoOperacao.gestantesSubtitle')}
            Icon={Users}
          />
          <Card
            title={t(data.periodo ? 'gestao.blocoOperacao.laudosTitlePeriodo' : 'gestao.blocoOperacao.laudosTitle')}
            tooltip={t(data.periodo ? 'gestao.blocoOperacao.laudosTooltipPeriodo' : 'gestao.blocoOperacao.laudosTooltip')}
            value={data.periodo ? (data.laudos_periodo ?? data.laudos_30d) : data.laudos_30d}
            subtitle={t('gestao.blocoOperacao.laudosSubtitle')}
            Icon={FileText}
          />
          <Card
            title={t('gestao.blocoOperacao.profsTitle')}
            tooltip={t('gestao.blocoOperacao.profsTooltip')}
            value={data.distribuicao_profissionais.filter(p => p.total_pacientes_ativos > 0).length}
            subtitle={t('gestao.blocoOperacao.profsSubtitle', { total: data.distribuicao_profissionais.length })}
            Icon={Activity}
          />
        </div>
      )}
    </section>
  );
}

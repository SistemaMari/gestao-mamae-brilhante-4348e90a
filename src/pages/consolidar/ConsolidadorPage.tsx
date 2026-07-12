import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, Activity, Stethoscope, FlaskConical } from "lucide-react";
import {
  useConsolidadorOperacao,
  useConsolidadorPerfilClinico,
  useConsolidadorGargalos,
  useConsolidadorTendencia,
} from "@/hooks/usePainelDataGestorGeral";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import BlocoGargalos from "@/components/gestao/BlocoGargalos";
import { formatNum, formatPctOrDash, formatIg } from "@/lib/formatters";

interface MetricCardProps {
  label: string;
  value: string;
  Icon: React.ElementType;
  tooltip: string;
  subtitle?: string;
}

function MetricCard({ label, value, Icon, tooltip, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-[#64748B] truncate">{label}</p>
            <TooltipInfo text={tooltip} />
          </div>
          <p
            className="mt-1 text-2xl font-semibold text-[#1E293B] tabular-nums"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            {value}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-[#94A3B8]">{subtitle}</p>}
        </div>
        <div className="h-10 w-10 rounded-lg bg-[#F1F0FB] flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-[#7E69AB]" />
        </div>
      </div>
    </div>
  );
}

export default function ConsolidadorPage() {
  const { semSelecao } = useFiltrosGestorGeral();
  if (semSelecao) return <EmptyStateSemSelecao />;
  return (
    <div className="space-y-8">
      <BlocoOperacaoConsolidado />
      <BlocoPerfilClinicoConsolidado />
      <BlocoGargalosConsolidado />
      <BlocoTendenciaConsolidado />
    </div>
  );
}

function BlocoOperacaoConsolidado() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidadorOperacao();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
        {t('consolidar.operacao.title')}
      </h2>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {t('consolidar.operacao.loadError')}
        </div>
      ) : isLoading || !data ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label={t('consolidar.operacao.gestantesAtivas')}
            value={formatNum(data.gestantes_ativas)}
            Icon={Users}
            tooltip={t('consolidar.operacao.gestantesAtivasTip')}
          />
          <MetricCard
            label={t('consolidar.operacao.laudosEmitidos')}
            value={formatNum(data.laudos_emitidos)}
            Icon={FileText}
            tooltip={t('consolidar.operacao.laudosEmitidosTip')}
          />
          <MetricCard
            label={t('consolidar.operacao.examesRealizados')}
            value={formatNum(data.exames_realizados)}
            Icon={FlaskConical}
            tooltip={t('consolidar.operacao.examesRealizadosTip')}
          />
          <MetricCard
            label={t('consolidar.operacao.partosRegistrados')}
            value={formatNum(data.partos_registrados)}
            Icon={Activity}
            tooltip={t('consolidar.operacao.partosRegistradosTip')}
          />
          <MetricCard
            label={t('consolidar.operacao.profissionaisAtivos')}
            value={formatNum(data.profissionais_ativos)}
            Icon={Stethoscope}
            tooltip={t('consolidar.operacao.profissionaisAtivosTip')}
          />
        </div>
      )}
    </section>
  );
}

function BlocoPerfilClinicoConsolidado() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidadorPerfilClinico();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
        {t('consolidar.perfilClinico.title')}
      </h2>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {t('consolidar.perfilClinico.loadError')}
        </div>
      ) : isLoading || !data ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            label={t('consolidar.perfilClinico.taxaDmgPositivo')}
            value={formatPctOrDash(data.taxa_dmg_positivo_pct, 1)}
            Icon={Activity}
            tooltip={t('consolidar.perfilClinico.taxaDmgPositivoTip')}
            subtitle={t('consolidar.perfilClinico.diagnosticosNoCalculo', { count: data.total_diagnosticos_no_calculo, valor: formatNum(data.total_diagnosticos_no_calculo) })}
          />
          <MetricCard
            label={t('consolidar.perfilClinico.igMediaDiagnostico')}
            value={formatIg(data.ig_media_diagnostico)}
            Icon={Activity}
            tooltip={t('consolidar.perfilClinico.igMediaDiagnosticoTip')}
          />
          <MetricCard
            label={t('consolidar.perfilClinico.tempoMedioFechamento')}
            value={
              data.tempo_medio_fechamento_dias === null
                ? "—"
                : t('consolidar.perfilClinico.diasSuffix', { valor: data.tempo_medio_fechamento_dias.toFixed(1) })
            }
            Icon={Activity}
            tooltip={t('consolidar.perfilClinico.tempoMedioFechamentoTip')}
          />
        </div>
      )}
    </section>
  );
}

function BlocoGargalosConsolidado() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidadorGargalos();
  // Adapt para shape do BlocoGargalos da unidade (paciente_ids vazios — sem drill-down).
  const adaptado = data
    ? {
        sem_gj_primeira_consulta: { count: data.sem_gj_primeira_consulta.count, paciente_ids: [] },
        atrasadas_gtt: { count: data.atrasadas_gtt.count, paciente_ids: [] },
        confirmadas_sem_retorno: { count: data.confirmadas_sem_retorno.count, paciente_ids: [] },
      }
    : null;
  return (
    <BlocoGargalos
      data={adaptado ?? { sem_gj_primeira_consulta: { count: 0, paciente_ids: [] }, atrasadas_gtt: { count: 0, paciente_ids: [] }, confirmadas_sem_retorno: { count: 0, paciente_ids: [] } }}
      loading={isLoading}
      error={isError ? t('consolidar.gargalos.loadError') : null}
      hideVerPacientesLink
      subtitle={t('consolidar.gargalos.subtitle')}
    />
  );
}

function BlocoTendenciaConsolidado() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidadorTendencia();
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          {t('consolidar.tendencia.title')}
        </h2>
        <TooltipInfo text={t('consolidar.tendencia.tooltip')} />
      </div>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {t('consolidar.tendencia.loadError')}
        </div>
      ) : isLoading || !data ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="mes_label" stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} allowDecimals={false} />
                <RTooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total_gestantes" name={t('consolidar.tendencia.legendGestantes')} stroke="#9b87f5" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="total_dmg_confirmadas" name={t('consolidar.tendencia.legendDmg')} stroke="#7E69AB" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

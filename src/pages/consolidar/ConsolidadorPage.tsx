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
  const { data, isLoading, isError } = useConsolidadorOperacao();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
        Operação consolidada
      </h2>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          Falha ao carregar operação.
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
            label="Gestantes ativas"
            value={formatNum(data.gestantes_ativas)}
            Icon={Users}
            tooltip="Soma das gestantes com DUM nos últimos 280 dias em todas as unidades selecionadas."
          />
          <MetricCard
            label="Laudos emitidos"
            value={formatNum(data.laudos_emitidos)}
            Icon={FileText}
            tooltip="Laudos gerados no período selecionado pelas unidades selecionadas."
          />
          <MetricCard
            label="Exames realizados"
            value={formatNum(data.exames_realizados)}
            Icon={FlaskConical}
            tooltip="Total de exames de glicemia (GJ + TTOG + perfil) registrados no período."
          />
          <MetricCard
            label="Partos registrados"
            value={formatNum(data.partos_registrados)}
            Icon={Activity}
            tooltip="Partos registrados no período pelas unidades selecionadas."
          />
          <MetricCard
            label="Profissionais ativos"
            value={formatNum(data.profissionais_ativos)}
            Icon={Stethoscope}
            tooltip="Profissionais com ao menos 1 paciente em acompanhamento."
          />
        </div>
      )}
    </section>
  );
}

function BlocoPerfilClinicoConsolidado() {
  const { data, isLoading, isError } = useConsolidadorPerfilClinico();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
        Perfil clínico consolidado
      </h2>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          Falha ao carregar perfil clínico.
        </div>
      ) : isLoading || !data ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Taxa DMG positivo"
            value={formatPctOrDash(data.taxa_dmg_positivo_pct, 1)}
            Icon={Activity}
            tooltip="Percentual de gestantes com DMG confirmado. Faixa esperada Febrasgo: 7-18%."
            subtitle={`${formatNum(data.total_diagnosticos_no_calculo)} diagnósticos no cálculo`}
          />
          <MetricCard
            label="IG média ao diagnóstico"
            value={formatIg(data.ig_media_diagnostico)}
            Icon={Activity}
            tooltip="Idade gestacional média no momento do diagnóstico de DMG. Janela ideal: 24-28 semanas."
          />
          <MetricCard
            label="Tempo médio DUM → diagnóstico"
            value={formatIg(data.tempo_medio_dum_diagnostico)}
            Icon={Activity}
            tooltip="Tempo médio (em sem+dias) entre a DUM da paciente e a confirmação do DMG."
          />
          <MetricCard
            label="Tempo médio de fechamento"
            value={
              data.tempo_medio_fechamento_dias === null
                ? "—"
                : `${data.tempo_medio_fechamento_dias.toFixed(1)} d`
            }
            Icon={Activity}
            tooltip="Dias médios entre confirmação do DMG e o desfecho (alta/parto)."
          />
        </div>
      )}
    </section>
  );
}

function BlocoGargalosConsolidado() {
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
      error={isError ? "Falha ao carregar gargalos." : null}
      hideVerPacientesLink
    />
  );
}

function BlocoTendenciaConsolidado() {
  const { data, isLoading, isError } = useConsolidadorTendencia();
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          Tendência da rede (12 meses)
        </h2>
        <TooltipInfo text="Fotografia mensal das últimas 12 referências: total de gestantes ativas e DMG confirmados. Não respeita o filtro de período — sempre 12 meses." />
      </div>
      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          Falha ao carregar tendência.
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
                <Line type="monotone" dataKey="total_gestantes" name="Gestantes ativas" stroke="#9b87f5" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="total_dmg_confirmadas" name="DMG confirmadas" stroke="#7E69AB" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

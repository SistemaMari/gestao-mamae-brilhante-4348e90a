import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import { useDiagnosticoRanking } from "@/hooks/usePainelDataGestorGeral";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";

type MetricaKey =
  | "pacientes_ativos"
  | "laudos_emitidos"
  | "taxa_dmg_positivo_pct"
  | "tempo_medio_fechamento_dias"
  | "profissionais_ativos";

interface MetricaCfg {
  key: MetricaKey;
  label: string;
  labelLong: string;
  direcao: "maior" | "menor";
  format: (v: number) => string;
  tooltip: string;
}

const METRICAS: MetricaCfg[] = [
  {
    key: "pacientes_ativos",
    label: "Pacientes ativos",
    labelLong: "número de pacientes ativos",
    direcao: "maior",
    format: (v) => Math.round(v).toLocaleString("pt-BR"),
    tooltip: "Maior é melhor: indica volume de atendimento da unidade.",
  },
  {
    key: "laudos_emitidos",
    label: "Laudos emitidos",
    labelLong: "número de laudos emitidos",
    direcao: "maior",
    format: (v) => Math.round(v).toLocaleString("pt-BR"),
    tooltip: "Maior é melhor: produtividade de diagnóstico no período.",
  },
  {
    key: "taxa_dmg_positivo_pct",
    label: "Taxa DMG",
    labelLong: "taxa de DMG positivo",
    direcao: "maior",
    format: (v) => `${v.toFixed(1)}%`,
    tooltip:
      "Comparação direta entre unidades. Faixa esperada Febrasgo: 7-18% — interprete com contexto.",
  },
  {
    key: "tempo_medio_fechamento_dias",
    label: "Tempo médio desde DUM",
    labelLong: "tempo médio entre DUM e parto",
    direcao: "menor",
    format: (v) => `${v.toFixed(1)} d`,
    tooltip: "Menor é melhor: tempo entre DUM e parto.",
  },
  {
    key: "profissionais_ativos",
    label: "Profissionais ativos",
    labelLong: "número de profissionais ativos",
    direcao: "maior",
    format: (v) => Math.round(v).toLocaleString("pt-BR"),
    tooltip: "Profissionais com pelo menos uma gestante ativa.",
  },
];

const DEFAULT_ATIVAS: MetricaKey[] = ["pacientes_ativos", "laudos_emitidos"];

interface Row {
  nome: string;
  valor: number;
}

function buildRows(data: any[] | undefined, m: MetricaCfg): Row[] {
  if (!data) return [];
  const rows = data
    .map((r) => ({ nome: r.unidade_nome as string, valor: r[m.key] as number | null }))
    .filter((r) => r.valor !== null && r.valor !== undefined) as Row[];
  rows.sort((a, b) => (m.direcao === "maior" ? b.valor - a.valor : a.valor - b.valor));
  return rows;
}

function buildInsight(rows: Row[], m: MetricaCfg): string | null {
  if (rows.length === 0) return null;
  const top = rows[0];
  const media = rows.reduce((s, r) => s + r.valor, 0) / rows.length;
  const diff = top.valor - media;
  const diffPct = media === 0 ? 0 : (Math.abs(diff) / media) * 100;
  const palavraSup = m.direcao === "maior" ? "maior" : "menor";
  const acimaAbaixo = m.direcao === "maior" ? "acima" : "abaixo";
  return `${top.nome} tem o ${palavraSup} ${m.labelLong} (${m.format(top.valor)}), ${diffPct.toFixed(0)}% ${acimaAbaixo} da média da rede (${m.format(media)}).`;
}

function GraficoMetrica({ m, rows, isLoading }: { m: MetricaCfg; rows: Row[]; isLoading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          {m.label}
        </h3>
        <TooltipInfo text={m.tooltip} />
        <span className="ml-auto text-[11px] uppercase tracking-wide text-[#94A3B8]">
          {m.direcao === "maior" ? "Maior é melhor" : "Menor é melhor"}
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-md" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#64748B]">Sem dados para esta métrica.</p>
      ) : (
        <div style={{ width: "100%", height: Math.max(180, rows.length * 44) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 60, left: 10, bottom: 6 }}>
              <CartesianGrid stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis
                type="category"
                dataKey="nome"
                stroke="#64748B"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                width={170}
              />
              <RTooltip
                formatter={(v: number) => m.format(v)}
                labelStyle={{ color: "#1E293B" }}
                contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13 }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#7E69AB" : "#9b87f5"} />
                ))}
                <LabelList
                  dataKey="valor"
                  position="right"
                  formatter={(v: number) => m.format(v)}
                  style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ComparadorPage() {
  const { semSelecao } = useFiltrosGestorGeral();
  const { data, isLoading, isError } = useDiagnosticoRanking();
  const [ativas, setAtivas] = useState<MetricaKey[]>(DEFAULT_ATIVAS);

  const togglePill = (k: MetricaKey) => {
    setAtivas((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const ativasOrdenadas = useMemo(
    () => METRICAS.filter((m) => ativas.includes(m.key)),
    [ativas],
  );

  const insights = useMemo(() => {
    return ativasOrdenadas
      .map((m) => buildInsight(buildRows(data, m), m))
      .filter((x): x is string => Boolean(x));
  }, [ativasOrdenadas, data]);

  if (semSelecao) return <EmptyStateSemSelecao />;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          Comparador de unidades
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Selecione uma ou mais métricas para comparar as unidades lado a lado.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {METRICAS.map((m) => {
          const isActive = ativas.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => togglePill(m.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-[#7E69AB] bg-[#7E69AB] text-white shadow-sm"
                  : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#9b87f5] hover:text-[#7E69AB]",
              )}
              aria-pressed={isActive}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-5">
          <p className="text-sm text-[#991B1B]">Falha ao carregar dados.</p>
        </div>
      ) : ativasOrdenadas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#64748B]">
          Selecione ao menos uma métrica acima para comparar as unidades.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ativasOrdenadas.map((m) => (
            <GraficoMetrica key={m.key} m={m} rows={buildRows(data, m)} isLoading={isLoading || !data} />
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="rounded-lg border border-border border-l-4 border-l-[#9b87f5] bg-[#FAF8FF] p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7E69AB]" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7E69AB]">
                Insight automático
              </p>
              {insights.map((t, i) => (
                <p key={i} className="text-sm text-[#1E293B]">
                  {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

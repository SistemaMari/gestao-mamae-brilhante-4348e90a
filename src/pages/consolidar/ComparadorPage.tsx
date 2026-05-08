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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import { useDiagnosticoRanking } from "@/hooks/usePainelDataGestorGeral";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";

type MetricaKey =
  | "pacientes_ativos"
  | "laudos_emitidos"
  | "taxa_dmg_positivo_pct"
  | "tempo_medio_fechamento_dias";

const METRICAS: {
  key: MetricaKey;
  label: string;
  direcao: "maior" | "menor";
  format: (v: number) => string;
  unidade: string;
  tooltip: string;
}[] = [
  {
    key: "pacientes_ativos",
    label: "Pacientes ativos",
    direcao: "maior",
    format: (v) => v.toLocaleString("pt-BR"),
    unidade: "pacientes",
    tooltip: "Maior é melhor: indica volume de atendimento da unidade.",
  },
  {
    key: "laudos_emitidos",
    label: "Laudos emitidos",
    direcao: "maior",
    format: (v) => v.toLocaleString("pt-BR"),
    unidade: "laudos",
    tooltip: "Maior é melhor: produtividade de diagnóstico no período.",
  },
  {
    key: "taxa_dmg_positivo_pct",
    label: "Taxa DMG positivo",
    direcao: "maior",
    format: (v) => `${v.toFixed(1)}%`,
    unidade: "% positivos",
    tooltip:
      "Comparação direta entre unidades. Faixa esperada Febrasgo: 7-18% — interprete com contexto.",
  },
  {
    key: "tempo_medio_fechamento_dias",
    label: "Tempo médio de fechamento",
    direcao: "menor",
    format: (v) => `${v.toFixed(1)} d`,
    unidade: "dias até fechamento",
    tooltip: "Menor é melhor: tempo entre confirmação e desfecho.",
  },
];

export default function ComparadorPage() {
  const { semSelecao } = useFiltrosGestorGeral();
  const { data, isLoading, isError } = useDiagnosticoRanking();
  const [metrica, setMetrica] = useState<MetricaKey>("pacientes_ativos");

  const cfg = METRICAS.find((m) => m.key === metrica)!;

  const rows = useMemo(() => {
    if (!data) return [];
    const filtered = data
      .map((r) => ({
        nome: r.unidade_nome,
        valor: r[metrica] as number | null,
      }))
      .filter((r) => r.valor !== null && r.valor !== undefined) as { nome: string; valor: number }[];
    filtered.sort((a, b) => (cfg.direcao === "maior" ? b.valor - a.valor : a.valor - b.valor));
    return filtered;
  }, [data, metrica, cfg.direcao]);

  const insight = useMemo(() => {
    if (rows.length === 0) return null;
    const top = rows[0];
    const media = rows.reduce((s, r) => s + r.valor, 0) / rows.length;
    const diff = top.valor - media;
    const diffPct = media === 0 ? 0 : (diff / media) * 100;
    const palavra = cfg.direcao === "maior" ? "maior" : "menor";
    return `${top.nome} tem o ${palavra} ${cfg.label.toLowerCase()} (${cfg.format(top.valor)}), ${Math.abs(diffPct).toFixed(0)}% ${cfg.direcao === "maior" ? "acima" : "abaixo"} da média da rede (${cfg.format(media)}).`;
  }, [rows, cfg]);

  if (semSelecao) return <EmptyStateSemSelecao />;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
            Comparador de unidades
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Ranqueamento direto por uma métrica de cada vez. Mais é melhor para volumes; menos é melhor para tempo.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-64">
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Métrica</label>
            <Select value={metrica} onValueChange={(v) => setMetrica(v as MetricaKey)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICAS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TooltipInfo text={cfg.tooltip} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        {isError ? (
          <p className="text-sm text-[#991B1B]">Falha ao carregar dados.</p>
        ) : isLoading || !data ? (
          <Skeleton className="h-80 w-full rounded-md" />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-[#64748B] py-8">
            Sem dados nesta métrica para as unidades e período selecionados.
          </p>
        ) : (
          <div style={{ width: "100%", height: Math.max(220, rows.length * 48) }}>
            <ResponsiveContainer>
              <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" stroke="#64748B" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  stroke="#64748B"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  width={180}
                />
                <RTooltip
                  formatter={(v: number) => cfg.format(v)}
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
                    formatter={(v: number) => cfg.format(v)}
                    style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {insight && (
        <div className="rounded-lg border-l-4 border-[#9b87f5] border border-border bg-[#FAF8FF] p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-[#7E69AB] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#7E69AB] uppercase tracking-wide">
                Insight automático
              </p>
              <p className="mt-1 text-sm text-[#1E293B]">{insight}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

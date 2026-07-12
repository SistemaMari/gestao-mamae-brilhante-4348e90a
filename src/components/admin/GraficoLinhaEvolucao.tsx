import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";

export interface SerieLinha {
  chave: string;
  nome: string;
  cor: string;
}

interface Props {
  dados: Array<Record<string, string | number>>;
  series: SerieLinha[];
  xKey?: string;
  height?: number;
}

const PALETA_BRAND = ["#7C4DBA", "#5EEAD4", "#7C4DBA", "#7E69AB", "#D6BCFA"];

export const paletaSeries = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => PALETA_BRAND[i % PALETA_BRAND.length]);

interface TooltipItem {
  color?: string;
  name?: string;
  value?: number | string;
  dataKey?: string;
}

function TooltipCustom({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}) {
  const { i18n } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border bg-white px-3 py-2 shadow-md"
      style={{
        borderColor: "#E2E8F0",
        fontFamily: "Plus Jakarta Sans, sans-serif",
        minWidth: 160,
      }}
    >
      <div
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "#94A3B8", letterSpacing: "0.04em" }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-[12px]" style={{ color: "#334155" }}>
                {p.name}
              </span>
            </div>
            <span
              className="text-[13px] font-semibold"
              style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
            >
              {typeof p.value === "number" ? p.value.toLocaleString(i18n.language) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendaCustom({ series }: { series: SerieLinha[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {series.map((s) => (
        <span
          key={s.chave}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            borderColor: `${s.cor}55`,
            background: `${s.cor}12`,
            color: "#1E293B",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: s.cor }}
          />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

export function GraficoLinhaEvolucao({ dados, series, xKey = "mes", height = 280 }: Props) {
  return (
    <div className="w-full" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
            dy={4}
          />
          <YAxis
            stroke="#94A3B8"
            fontSize={11}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            content={<TooltipCustom />}
            cursor={{ stroke: "#CBD5E1", strokeDasharray: "3 3" }}
          />
          {series.map((s) => (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 2, fill: "#fff", stroke: s.cor }}
              activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: s.cor }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <LegendaCustom series={series} />
    </div>
  );
}

export default GraficoLinhaEvolucao;

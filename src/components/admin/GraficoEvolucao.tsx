import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PontoGrafico {
  mes: string;
  valor: number;
}

interface GraficoEvolucaoProps {
  dados: PontoGrafico[];
  titulo?: string;
  cor?: string;
  altura?: number;
}

export function GraficoEvolucao({
  dados,
  titulo,
  cor = "#7C4DBA",
  altura = 280,
}: GraficoEvolucaoProps) {
  if (dados.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-white"
        style={{
          height: altura,
          borderColor: "#E2E8F0",
          color: "#94A3B8",
          fontFamily: "Plus Jakarta Sans, sans-serif",
        }}
      >
        Sem dados no período
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border bg-white p-4"
      style={{ borderColor: "#E2E8F0" }}
    >
      {titulo && (
        <div
          className="mb-3 text-[15px] font-bold"
          style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
        >
          {titulo}
        </div>
      )}
      <div style={{ width: "100%", height: altura }}>
        <ResponsiveContainer>
          <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="mes"
              stroke="#64748B"
              tick={{ fontSize: 12, fontFamily: "Plus Jakarta Sans, sans-serif" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <YAxis
              stroke="#64748B"
              tick={{ fontSize: 12, fontFamily: "Plus Jakarta Sans, sans-serif" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 6,
                fontFamily: "Plus Jakarta Sans, sans-serif",
                fontSize: 13,
              }}
              labelStyle={{ color: "#1E293B", fontWeight: 600 }}
              formatter={(v: number) => [v, "Valor"]}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={cor}
              strokeWidth={2}
              dot={{ r: 4, fill: cor, stroke: cor }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default GraficoEvolucao;

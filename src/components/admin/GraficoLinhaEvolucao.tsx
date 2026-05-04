import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

const PALETA_BRAND = ["#9b87f5", "#5EEAD4", "#7C4DBA", "#7E69AB", "#D6BCFA"];

export const paletaSeries = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => PALETA_BRAND[i % PALETA_BRAND.length]);

export function GraficoLinhaEvolucao({ dados, series, xKey = "mes", height = 280 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={xKey} stroke="#64748B" fontSize={12} />
          <YAxis stroke="#64748B" fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GraficoLinhaEvolucao;

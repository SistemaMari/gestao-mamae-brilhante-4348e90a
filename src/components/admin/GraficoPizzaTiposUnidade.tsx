import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PALETA = ["#9b87f5", "#5EEAD4", "#7E69AB", "#D6BCFA", "#99F6E4", "#C4B5FD", "#7C4DBA"];

interface Props {
  rows: { tipo: string | null; total: number }[];
}

export function GraficoPizzaTiposUnidade({ rows }: Props) {
  const dados = rows.map((r) => ({
    name: r.tipo ?? "Não informado",
    value: r.total,
  }));

  return (
    <div className="min-h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={dados}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {dados.map((d, i) => (
              <Cell key={d.name} fill={PALETA[i % PALETA.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GraficoPizzaTiposUnidade;

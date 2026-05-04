import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PlanoRow } from "@/lib/adminMetrics";

const CORES: Record<string, string> = {
  inicial: "#5EEAD4",
  intermediaria: "#D6BCFA",
  profissional: "#7C4DBA",
};

interface Props {
  rows: PlanoRow[];
}

export function GraficoPizzaPlanos({ rows }: Props) {
  // Garante a ordem fixa Inicial / Intermediária / Profissional.
  const ordem = ["inicial", "intermediaria", "profissional"];
  const dados = ordem.map((slug) => {
    const r = rows.find((x) => x.plano_slug === slug);
    return {
      name:
        slug === "inicial"
          ? "Inicial"
          : slug === "intermediaria"
            ? "Intermediária"
            : "Profissional",
      value: r?.total ?? 0,
      slug,
    };
  });

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
            {dados.map((d) => (
              <Cell key={d.slug} fill={CORES[d.slug]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GraficoPizzaPlanos;

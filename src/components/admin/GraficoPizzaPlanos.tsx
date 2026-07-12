import { useTranslation } from "react-i18next";
import type { PlanoRow } from "@/lib/adminMetrics";
import { BarrasHorizontaisRanking } from "./BarrasHorizontaisRanking";

const CORES: Record<string, string> = {
  inicial: "#5EEAD4",
  intermediaria: "#D6BCFA",
  profissional: "#7C4DBA",
};

interface Props {
  rows: PlanoRow[];
}

export function GraficoPizzaPlanos({ rows }: Props) {
  const { t } = useTranslation();
  const ordem = ["inicial", "intermediaria", "profissional"];
  const itens = ordem.map((slug) => {
    const r = rows.find((x) => x.plano_slug === slug);
    const nome =
      slug === "inicial"
        ? "Inicial"
        : slug === "intermediaria"
          ? "Intermediária"
          : "Profissional";
    return { nome, valor: r?.total ?? 0, cor: CORES[slug] };
  });
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <BarrasHorizontaisRanking
      itens={itens}
      ordenar={false}
      vazioMsg={t("admin.planosChart.empty")}
      rodape={t("admin.planosChart.total", { count: total })}
    />
  );
}

export default GraficoPizzaPlanos;

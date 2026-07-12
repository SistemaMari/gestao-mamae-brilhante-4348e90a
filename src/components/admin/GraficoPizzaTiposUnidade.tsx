import { useTranslation } from "react-i18next";
import { BarrasHorizontaisRanking } from "./BarrasHorizontaisRanking";

const PALETA = ["#7C4DBA", "#5EEAD4", "#7E69AB", "#D6BCFA", "#99F6E4", "#C4B5FD", "#A78BFA"];

interface Props {
  rows: { tipo: string | null; total: number }[];
}

export function GraficoPizzaTiposUnidade({ rows }: Props) {
  const { t } = useTranslation();

  function formatarTipo(tipo: string | null): string {
    if (!tipo) return t("admin.overview.notInformed");
    if (tipo.toLowerCase() === "ubs") return "UBS";
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  }

  const itens = rows.map((r, i) => ({
    nome: formatarTipo(r.tipo),
    valor: r.total,
    cor: PALETA[i % PALETA.length],
  }));
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <BarrasHorizontaisRanking
      itens={itens}
      vazioMsg={t("admin.tiposUnidade.emptyMsg")}
      rodape={t("admin.tiposUnidade.footer", { count: total })}
    />
  );
}

export default GraficoPizzaTiposUnidade;

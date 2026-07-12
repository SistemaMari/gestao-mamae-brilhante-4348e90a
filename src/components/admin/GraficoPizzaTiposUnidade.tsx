import { BarrasHorizontaisRanking } from "./BarrasHorizontaisRanking";

const PALETA = ["#7C4DBA", "#5EEAD4", "#7E69AB", "#D6BCFA", "#99F6E4", "#C4B5FD", "#A78BFA"];

function formatarTipo(t: string | null): string {
  if (!t) return "Não informado";
  if (t.toLowerCase() === "ubs") return "UBS";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface Props {
  rows: { tipo: string | null; total: number }[];
}

export function GraficoPizzaTiposUnidade({ rows }: Props) {
  const itens = rows.map((r, i) => ({
    nome: formatarTipo(r.tipo),
    valor: r.total,
    cor: PALETA[i % PALETA.length],
  }));
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <BarrasHorizontaisRanking
      itens={itens}
      vazioMsg="Nenhuma unidade cadastrada ainda."
      rodape={`${total} unidade${total === 1 ? "" : "s"} no total`}
    />
  );
}

export default GraficoPizzaTiposUnidade;

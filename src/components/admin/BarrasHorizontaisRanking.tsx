import { useTranslation } from "react-i18next";

const FONT_CORPO = "Plus Jakarta Sans, sans-serif";
const COR_CINZA = "#94A3B8";

interface Item {
  nome: string;
  valor: number;
  cor: string;
}

interface Props {
  itens: Item[];
  vazioMsg?: string;
  ordenar?: boolean;
  rodape?: string;
}

/**
 * Ranking horizontal com dot colorido, nome, contagem absoluta e percentual.
 * Substitui pizzas quando a leitura fica ruim (muitas fatias pequenas,
 * labels sobrepostos, ou uma categoria dominante — ex.: Painel).
 */
export function BarrasHorizontaisRanking({
  itens,
  vazioMsg,
  ordenar = true,
  rodape,
}: Props) {
  const { t } = useTranslation();
  const msgVazio = vazioMsg ?? t("admin.barrasRanking.emptyPeriod");
  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (total === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm"
        style={{ borderColor: "#E2E8F0", color: COR_CINZA, fontFamily: FONT_CORPO }}
      >
        {msgVazio}
      </div>
    );
  }
  const lista = ordenar ? [...itens].sort((a, b) => b.valor - a.valor) : itens;
  const max = Math.max(...lista.map((i) => i.valor), 1);
  return (
    <div className="flex flex-col gap-3">
      {lista.map((i) => {
        const pct = total > 0 ? Math.round((i.valor / total) * 100) : 0;
        const larguraBar = (i.valor / max) * 100;
        return (
          <div key={i.nome}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: i.cor }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "#1E293B", fontFamily: FONT_CORPO }}
                >
                  {i.nome}
                </span>
              </div>
              <div
                className="text-sm tabular-nums"
                style={{ color: "#475569", fontFamily: FONT_CORPO }}
              >
                <span className="font-semibold" style={{ color: "#1E293B" }}>
                  {i.valor}
                </span>
                <span className="mx-1.5" style={{ color: COR_CINZA }}>·</span>
                <span>{pct}%</span>
              </div>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ background: "#F1F5F9" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(larguraBar, i.valor > 0 ? 6 : 0)}%`,
                  background: i.cor,
                }}
              />
            </div>
          </div>
        );
      })}
      {rodape && (
        <p
          className="mt-1 text-[11px] uppercase tracking-wide"
          style={{ color: COR_CINZA, fontFamily: FONT_CORPO }}
        >
          {rodape}
        </p>
      )}
    </div>
  );
}

export default BarrasHorizontaisRanking;

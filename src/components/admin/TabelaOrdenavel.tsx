import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Coluna {
  chave: string;
  titulo: string;
  ordenavel?: boolean;
  formato?: (valor: any) => string;
  alinhamento?: "left" | "right" | "center";
}

interface TabelaOrdenavelProps {
  colunas: Coluna[];
  dados: any[];
  paginacao?: boolean;
  itensPorPagina?: number;
  denso?: boolean;
}

type Dir = "asc" | "desc";

export function TabelaOrdenavel({
  colunas,
  dados,
  paginacao = true,
  itensPorPagina = 20,
  denso = false,
}: TabelaOrdenavelProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<Dir>("asc");
  const [pagina, setPagina] = useState(1);

  const dadosOrdenados = useMemo(() => {
    if (!sortKey) return dados;
    const copia = [...dados];
    copia.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb), "pt-BR")
        : String(vb).localeCompare(String(va), "pt-BR");
    });
    return copia;
  }, [dados, sortKey, sortDir]);

  const paginar = paginacao && dadosOrdenados.length > 50;
  const totalPaginas = paginar ? Math.ceil(dadosOrdenados.length / itensPorPagina) : 1;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = paginar ? (paginaAtual - 1) * itensPorPagina : 0;
  const fim = paginar ? inicio + itensPorPagina : dadosOrdenados.length;
  const dadosVisiveis = dadosOrdenados.slice(inicio, fim);

  const handleSort = (col: Coluna) => {
    if (col.ordenavel === false) return;
    if (sortKey === col.chave) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.chave);
      setSortDir("asc");
    }
  };

  if (dados.length === 0) {
    return (
      <div
        className="rounded-lg border bg-white py-10 text-center"
        style={{ borderColor: "#E2E8F0", color: "#94A3B8", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        Nenhum dado para exibir
      </div>
    );
  }

  const padCell = denso ? "6px 8px" : "10px 12px";
  const fontSize = denso ? 13 : 14;

  return (
    <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="overflow-x-auto">
        <table className={denso ? "w-full text-[13px]" : "w-full text-sm"} style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          <thead>
            <tr style={{ background: "#E8E0FF" }}>
              {colunas.map((col) => {
                const ativo = sortKey === col.chave;
                const ordenavel = col.ordenavel !== false;
                return (
                  <th
                    key={col.chave}
                    onClick={() => handleSort(col)}
                    className={ordenavel ? "cursor-pointer select-none" : ""}
                    style={{
                      fontFamily: "Sora, sans-serif",
                      color: "#1E293B",
                      fontSize,
                      fontWeight: 700,
                      padding: padCell,
                      textAlign: col.alinhamento ?? "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.titulo}
                      {ordenavel && ativo && (
                        sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dadosVisiveis.map((linha, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-[#F1F5F9]"
                style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
              >
                {colunas.map((col) => {
                  const valor = linha[col.chave];
                  const exibido = col.formato ? col.formato(valor) : valor;
                  return (
                    <td
                      key={col.chave}
                      style={{
                        padding: "10px 12px",
                        textAlign: col.alinhamento ?? "left",
                        color: "#1E293B",
                      }}
                    >
                      {exibido}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginar && (
        <div
          className="flex items-center justify-between border-t px-4 py-3 text-[13px]"
          style={{
            borderColor: "#E2E8F0",
            color: "#64748B",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
        >
          <span>
            Mostrando {inicio + 1}-{Math.min(fim, dadosOrdenados.length)} de{" "}
            {dadosOrdenados.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="rounded border px-2 py-1 disabled:opacity-40"
              style={{ borderColor: "#E2E8F0" }}
            >
              {"< Anterior"}
            </button>
            {Array.from({ length: totalPaginas }).map((_, idx) => {
              const n = idx + 1;
              const ativo = n === paginaAtual;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPagina(n)}
                  className="rounded border px-2 py-1 min-w-[32px]"
                  style={{
                    borderColor: ativo ? "#7C4DBA" : "#E2E8F0",
                    background: ativo ? "#7C4DBA" : "white",
                    color: ativo ? "white" : "#1E293B",
                    fontWeight: ativo ? 600 : 400,
                  }}
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="rounded border px-2 py-1 disabled:opacity-40"
              style={{ borderColor: "#E2E8F0" }}
            >
              {"Próxima >"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabelaOrdenavel;

import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useVisaoGeralRede, type VisaoGeralRow } from "@/hooks/usePainelDataGestorGeral";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import { formatNum, formatPctOrDash } from "@/lib/formatters";

type SortKey = keyof VisaoGeralRow;
type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; tooltip?: string; align?: "right" }[] = [
  { key: "unidade_nome", label: "Unidade" },
  {
    key: "gestor_nome",
    label: "Gestor",
    tooltip: "Profissional cadastrado como gestor da unidade. Vazio quando ninguém ocupa o papel.",
  },
  {
    key: "pacientes_ativos",
    label: "Pacientes ativos",
    align: "right",
    tooltip: "Gestantes com DUM nos últimos 280 dias.",
  },
  {
    key: "laudos_emitidos",
    label: "Laudos emitidos",
    align: "right",
    tooltip: "Laudos gerados no período selecionado.",
  },
  {
    key: "partos_registrados",
    label: "Partos",
    align: "right",
    tooltip: "Partos registrados no período selecionado.",
  },
  {
    key: "profissionais_ativos",
    label: "Profissionais",
    align: "right",
    tooltip: "Profissionais com pelo menos 1 paciente em acompanhamento na unidade.",
  },
  {
    key: "taxa_dmg_positivo_pct",
    label: "Taxa DMG+",
    align: "right",
    tooltip: "Percentual de gestantes com diagnóstico positivo de DMG. Faixa esperada Febrasgo: 7-18%.",
  },
];

export default function VisaoGeralRedePage() {
  const { semSelecao } = useFiltrosGestorGeral();
  const { data, isLoading, isError } = useVisaoGeralRede();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/vitrine") ? "/vitrine/consolidar" : "/consolidar";

  const [sortKey, setSortKey] = useState<SortKey>("unidade_nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => {
    if (!data) return [];
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR");
      } else {
        cmp = ((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  if (semSelecao) return <EmptyStateSemSelecao />;

  return (
    <section className="space-y-3">
      <div>
        <h1
          className="text-xl font-semibold text-[#1E293B]"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          Visão geral da rede
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Linha por unidade. Clique para abrir o painel completo em modo somente leitura.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {isError ? (
          <div className="p-6 text-sm text-[#991B1B]">Não foi possível carregar a visão geral.</div>
        ) : isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B]">
            Nenhuma unidade encontrada para o filtro atual.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8FAFC]">
                {COLS.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(c.align === "right" && "text-right")}
                  >
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-[#7E69AB]"
                      >
                        {c.label}
                        {sortKey === c.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                      {c.tooltip && <TooltipInfo text={c.tooltip} />}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.unidade_id}
                  className="hover:bg-[#F1F0FB] cursor-pointer"
                  onClick={() => navigate(`${basePath}/unidade/${r.unidade_id}`)}
                >
                  <TableCell className="font-medium text-[#1E293B]">{r.unidade_nome}</TableCell>
                  <TableCell className="text-[#475569]">
                    {r.gestor_nome ?? (
                      <span className="inline-flex items-center gap-1 text-[#92400E]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Sem gestor
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(r.pacientes_ativos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(r.laudos_emitidos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(r.partos_registrados)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(r.profissionais_ativos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPctOrDash(r.taxa_dmg_positivo_pct, 1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ExternalLink className="ml-auto h-4 w-4 text-[#94A3B8]" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

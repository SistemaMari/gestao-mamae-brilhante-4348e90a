import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RankingUnidade } from "@/hooks/usePainelGestorGeral";
import { fmtNum, fmtPct, humanizeUltimaAtividade } from "./utils/formatters";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";

interface Props {
  data: RankingUnidade[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

type SortKey =
  | "unidade_nome"
  | "pacientes_ativos"
  | "laudos_emitidos"
  | "taxa_dmg_positivo_pct"
  | "tempo_medio_fechamento_dias"
  | "ultima_atividade"
  | "status_operacional";

type SortDir = "asc" | "desc";

const STATUS_MAP: Record<
  string,
  { label: string; classes: string }
> = {
  ativa: {
    label: "Ativa",
    classes: "bg-[#DCFCE7] text-[#065F46] border-[#A7F3D0]",
  },
  atencao: {
    label: "Atenção",
    classes: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
  },
  inativa: {
    label: "Inativa",
    classes: "bg-[#FEE2E2] text-[#7F1D1D] border-[#FECACA]",
  },
  nao_iniciada: {
    label: "Não iniciada",
    classes: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
  },
};

const STATUS_ORDER: Record<string, number> = {
  nao_iniciada: 0,
  inativa: 1,
  atencao: 2,
  ativa: 3,
};

export default function BlocoRanking({ data, isLoading, isError, onRetry }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status_operacional") {
        cmp = (STATUS_ORDER[a.status_operacional] ?? 9) - (STATUS_ORDER[b.status_operacional] ?? 9);
      } else if (sortKey === "ultima_atividade") {
        const av = a.ultima_atividade ? new Date(a.ultima_atividade).getTime() : 0;
        const bv = b.ultima_atividade ? new Date(b.ultima_atividade).getTime() : 0;
        cmp = av - bv;
      } else if (sortKey === "unidade_nome") {
        cmp = a.unidade_nome.localeCompare(b.unidade_nome, "pt-BR");
      } else {
        const av = (a[sortKey] as number | null) ?? -Infinity;
        const bv = (b[sortKey] as number | null) ?? -Infinity;
        cmp = (av as number) - (bv as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const Header = ({ k, label, align, tooltip }: { k: SortKey; label: string; align?: "right"; tooltip?: string }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <span className={cn("inline-flex items-center gap-1", align === "right" && "ml-auto")}>
        <button
          type="button"
          onClick={() => onSort(k)}
          className="inline-flex items-center gap-1 hover:text-[#7E69AB] transition-colors"
        >
          {label}
          {sortKey === k ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
        {tooltip && <TooltipInfo text={tooltip} />}
      </span>
    </TableHead>
  );

  if (isError) {
    return (
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-5">
        <p className="text-sm text-[#991B1B]">Não foi possível carregar o ranking.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2
          className="text-base font-semibold text-[#1E293B]"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          Ranking de unidades
        </h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          Por status operacional. Clique nas colunas para reordenar.
        </p>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#64748B]">
          Nenhuma unidade registrou atividade no período selecionado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F8FAFC]">
              <Header k="unidade_nome" label="Unidade" />
              <Header k="pacientes_ativos" label="Pacientes" tooltip="Gestantes com DUM nos últimos 280 dias." />
              <Header k="laudos_emitidos" label="Laudos" tooltip="Laudos gerados no período selecionado." />
              <Header k="taxa_dmg_positivo_pct" label="Taxa DMG+" tooltip="Percentual de laudos do período com diagnóstico positivo de DMG." />
              <Header k="tempo_medio_fechamento_dias" label="Tempo médio" tooltip="Dias médios entre DUM e parto registrado no período. '—' quando não há partos elegíveis." />
              <Header k="ultima_atividade" label="Última atividade" tooltip="Último registro (paciente, laudo, exame ou atendimento) na unidade." />
              <Header k="status_operacional" label="Status" tooltip="Ativa: registro nos últimos 30d. Atenção: 30-60d. Inativa: >60d. Não iniciada: sem registros." />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const st = STATUS_MAP[r.status_operacional] ?? STATUS_MAP.nao_iniciada;
              return (
                <TableRow
                  key={r.unidade_id}
                  className="hover:bg-[#F1F0FB] transition-colors cursor-default"
                  // TODO: drill-down por unidade — clique na linha abre visão agregada.
                  data-todo="drill-down-unidade"
                >
                  <TableCell className="font-medium text-[#1E293B]">{r.unidade_nome}</TableCell>
                  <TableCell>{fmtNum(r.pacientes_ativos)}</TableCell>
                  <TableCell>{fmtNum(r.laudos_emitidos)}</TableCell>
                  <TableCell>{fmtPct(r.taxa_dmg_positivo_pct, 1)}</TableCell>
                  <TableCell>
                    {r.tempo_medio_fechamento_dias === null ||
                    r.tempo_medio_fechamento_dias === undefined ||
                    r.tempo_medio_fechamento_dias === 0
                      ? "—"
                      : `${r.tempo_medio_fechamento_dias.toFixed(1)} d`}
                  </TableCell>
                  <TableCell className="text-[#475569]">
                    {humanizeUltimaAtividade(r.ultima_atividade)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-medium", st.classes)}>
                      {st.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

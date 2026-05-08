import { ArrowDown, ArrowUp, Info, Minus, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { KpisPayload } from "@/hooks/usePainelGestorGeral";
import { fmtNum, fmtPct, fmtVarPct, fmtVarPp } from "./utils/formatters";

interface Props {
  data: KpisPayload | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

interface CardConfig {
  titulo: string;
  valor: string;
  variacao: { text: string; tone: "up" | "down" | "neutral" };
  hideTrend?: boolean;
  tooltip?: string;
}

function ToneIcon({ tone }: { tone: "up" | "down" | "neutral" }) {
  if (tone === "up") return <ArrowUp className="h-3.5 w-3.5" />;
  if (tone === "down") return <ArrowDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function toneClass(tone: "up" | "down" | "neutral") {
  if (tone === "up") return "text-[#10B981]";
  if (tone === "down") return "text-[#EF4444]";
  return "text-[#94A3B8]";
}

export default function BlocoKpis({ data, isLoading, isError, onRetry }: Props) {
  if (isError) {
    return (
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-5">
        <p className="text-sm text-[#991B1B]">Não foi possível carregar os indicadores.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Recarregar
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      titulo: "Pacientes ativos",
      valor: fmtNum(data.totais.pacientes_ativos),
      variacao: fmtVarPct(data.variacao_periodo_anterior.pacientes_ativos_pct),
      tooltip:
        "Gestantes com DUM nos últimos 280 dias nas unidades selecionadas. Snapshot atual — não depende da janela do filtro.",
    },
    {
      titulo: "Laudos emitidos",
      valor: fmtNum(data.totais.laudos_emitidos),
      variacao: fmtVarPct(data.variacao_periodo_anterior.laudos_emitidos_pct),
      tooltip: "Laudos gerados no período selecionado pelas unidades selecionadas.",
    },
    {
      titulo: "Taxa DMG positivo",
      valor: fmtPct(data.totais.taxa_dmg_positivo_pct, 1),
      variacao: fmtVarPp(data.variacao_periodo_anterior.taxa_dmg_positivo_delta),
      tooltip:
        "Percentual de laudos do período com diagnóstico positivo de DMG. Faixa esperada Febrasgo: 7-18%.",
    },
    {
      titulo: "Partos registrados",
      valor: fmtNum(data.totais.partos_registrados),
      variacao: { text: "—", tone: "neutral" },
      hideTrend: true,
      tooltip: "Partos registrados no período pelas unidades selecionadas.",
    },
    {
      titulo: "Profissionais ativos",
      valor: fmtNum(data.totais.profissionais_ativos),
      variacao: { text: "—", tone: "neutral" },
      hideTrend: true,
      tooltip: "Profissionais com ao menos 1 paciente em acompanhamento nas unidades selecionadas.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.titulo}
          className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col justify-between min-h-[112px]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#64748B] truncate">{c.titulo}</p>
            {c.tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-[#94A3B8] hover:text-[#7E69AB] transition-colors"
                      aria-label="Mais informações"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{c.tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p
            className="mt-1 text-2xl font-semibold text-[#1E293B]"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            {c.valor}
          </p>
          <div
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs",
              c.hideTrend ? "text-[#94A3B8]" : toneClass(c.variacao.tone),
            )}
          >
            {!c.hideTrend && <ToneIcon tone={c.variacao.tone} />}
            <span>{c.variacao.text}</span>
            {!c.hideTrend && <span className="text-[#94A3B8]">vs período anterior</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import type { TopDestaquesPayload } from "@/hooks/usePainelDataGestorGeral";

interface Props {
  data: TopDestaquesPayload | undefined;
  isLoading: boolean;
  isError: boolean;
}

export default function BlocoTopDestaques({ data, isLoading, isError }: Props) {
  if (isError) {
    return (
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
        Falha ao carregar destaques.
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-[#A7F3D0] border-l-4 border-l-[#10B981] bg-[#F0FDF4] p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[#065F46]">Diagnostica MAIS</p>
              <TooltipInfo text="Unidade com maior número de diagnósticos confirmados de DMG (cenários 1, 6 e 6b) no período selecionado." />
            </div>
            <p
              className="mt-1 text-lg font-semibold text-[#1E293B] truncate"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              {data.mais?.unidade_nome ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-[#475569]">
              {data.mais ? `${data.mais.diagnosticos} diagnóstico${data.mais.diagnosticos === 1 ? "" : "s"}` : "Sem dados"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-[#10B981]" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#FDE68A] border-l-4 border-l-[#F59E0B] bg-[#FFFBEB] p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[#92400E]">Diagnostica MENOS</p>
              <TooltipInfo text="Unidade com menor número de diagnósticos confirmados de DMG no período. Pode indicar baixa captação ou subdiagnóstico." />
            </div>
            <p
              className="mt-1 text-lg font-semibold text-[#1E293B] truncate"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              {data.menos?.unidade_nome ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-[#475569]">
              {data.menos ? `${data.menos.diagnosticos} diagnóstico${data.menos.diagnosticos === 1 ? "" : "s"}` : "Sem dados"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5 text-[#F59E0B]" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { TrendingUp, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import type { TopDestaquesPayload } from "@/hooks/usePainelDataGestorGeral";

interface Props {
  data: TopDestaquesPayload | undefined;
  isLoading: boolean;
  isError: boolean;
}

export default function BlocoTopDestaques({ data, isLoading, isError }: Props) {
  const { t } = useTranslation();
  if (isError) {
    return (
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
        {t('gestorGeral.topDestaques.loadError')}
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
              <p className="text-xs font-medium text-[#065F46]">{t('gestorGeral.topDestaques.diagnosticaMais')}</p>
              <TooltipInfo text={t('gestorGeral.topDestaques.maisTooltip')} />
            </div>
            <p
              className="mt-1 text-lg font-semibold text-[#1E293B] truncate"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              {data.mais?.unidade_nome ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-[#475569]">
              {data.mais ? t('gestorGeral.topDestaques.diagnosticosCount', { count: data.mais.diagnosticos }) : t('common.noData')}
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
              <p className="text-xs font-medium text-[#92400E]">{t('gestorGeral.topDestaques.diagnosticaMenos')}</p>
              <TooltipInfo text={t('gestorGeral.topDestaques.menosTooltip')} />
            </div>
            <p
              className="mt-1 text-lg font-semibold text-[#1E293B] truncate"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              {data.menos?.unidade_nome ?? "—"}
            </p>
            <p className="mt-0.5 text-sm text-[#475569]">
              {data.menos ? t('gestorGeral.topDestaques.diagnosticosCount', { count: data.menos.diagnosticos }) : t('common.noData')}
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

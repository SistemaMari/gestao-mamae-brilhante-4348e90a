import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Alerta } from "@/hooks/usePainelGestorGeral";

interface Props {
  data: Alerta[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export default function BlocoAlertas({ data, isLoading, isError, onRetry }: Props) {
  const { t } = useTranslation();
  if (isError) {
    return (
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-5">
        <p className="text-sm text-[#991B1B]">{t('gestorGeral.blocoAlertas.loadError')}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {t('gestorGeral.blocoAlertas.reload')}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <h2
          className="text-base font-semibold text-[#1E293B]"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          {t('gestorGeral.blocoAlertas.title')}
        </h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          {t('gestorGeral.blocoAlertas.subtitle')}
        </p>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-[#DCFCE7] flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-[#10B981]" />
            </div>
            <p className="text-sm font-medium text-[#1E293B]">{t('gestorGeral.blocoAlertas.emptyTitle')}</p>
            <p className="text-xs text-[#64748B] mt-1">{t('gestorGeral.blocoAlertas.emptyDesc')}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((a) => {
              const alta = a.severidade === "alta";
              return (
                <div
                  key={a.alerta_id}
                  className={cn(
                    "rounded-lg border-l-4 border border-border bg-white p-4 shadow-sm",
                    alta
                      ? "border-l-[#EF4444] bg-[#FEF2F2]"
                      : "border-l-[#F59E0B] bg-[#FFFBEB]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        alta ? "text-[#EF4444]" : "text-[#F59E0B]",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1E293B] truncate">
                        {a.unidade_nome}
                      </p>
                      <p className="text-sm text-[#475569] mt-0.5">{a.mensagem}</p>
                      {a.detalhe_numerico !== null && a.detalhe_numerico !== undefined && (
                        <p className="text-xs text-[#64748B] mt-1">
                          {t('gestorGeral.blocoAlertas.detalhe', { valor: a.detalhe_numerico })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

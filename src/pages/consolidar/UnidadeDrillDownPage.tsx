import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyProvider } from "@/contexts/ReadOnlyContext";
import { supabase } from "@/integrations/supabase/client";
import GestaoPage from "@/pages/GestaoPage";

/**
 * Drill-down readonly do gestor geral.
 * Reaproveita GestaoPage forçando o unidadeId via URL e ativando ReadOnlyContext.
 */
export default function UnidadeDrillDownPage() {
  const { t } = useTranslation();
  const { unidadeId } = useParams<{ unidadeId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith("/vitrine");
  const basePath = isVitrine ? "/vitrine/consolidar" : "/consolidar";

  const [nomeUnidade, setNomeUnidade] = useState<string | null>(null);

  useEffect(() => {
    if (!unidadeId || isVitrine) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("unidades")
        .select("nome")
        .eq("id", unidadeId)
        .maybeSingle();
      if (!cancelado) setNomeUnidade(data?.nome ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [unidadeId, isVitrine]);

  if (!unidadeId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7E69AB]" />
      </div>
    );
  }

  return (
    <ReadOnlyProvider readonly reason={t('consolidar.unidadeDrillDown.readOnlyReason')}>
      <div className="border-b border-[#FDE68A] bg-[#FEF3C7] px-5 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[#92400E]">
          <Eye className="h-4 w-4" />
          <span>
            {nomeUnidade
              ? t('consolidar.unidadeDrillDown.readOnlyBannerUnit', { unidade: nomeUnidade })
              : t('consolidar.unidadeDrillDown.readOnlyBanner')}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`${basePath}/visao-geral`)}
          className="bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t('consolidar.unidadeDrillDown.voltarVisaoGeral')}
        </Button>
      </div>
      <GestaoPage forcedUnidadeId={unidadeId} />
    </ReadOnlyProvider>
  );
}

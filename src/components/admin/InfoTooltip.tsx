import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  ariaLabel?: string;
}

/**
 * Tooltip informativo compacto usado nos painéis do ADMIN
 * (Painel/Visão Geral e Diagnósticos).
 */
export function InfoTooltip({ text, side = "top", ariaLabel }: Props) {
  const { t } = useTranslation();
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel ?? t("admin.infoTooltip.moreInfo")}
            className="inline-flex items-center text-[#94A3B8] hover:text-[#7E69AB] transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default InfoTooltip;

import { useContext } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PdfModeContext } from './PdfModeContext';

interface Props {
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  ariaLabel?: string;
}

export default function CardInfoTooltip({ text, side = 'top', ariaLabel }: Props) {
  const { t } = useTranslation();
  const isPdf = useContext(PdfModeContext);
  if (isPdf) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel ?? t('gestao.cardInfoTooltip.ariaLabel')}
            className="text-muted-foreground hover:text-foreground"
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

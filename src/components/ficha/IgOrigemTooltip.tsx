import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDateBR } from '@/lib/dateUtils';
import type { UsgRefInput } from '@/lib/fichaUtils';

/**
 * IgOrigemTooltip — ícone ℹ️ com tooltip explicando a origem do cálculo da IG
 * (Prompt 34B seção 3.9.3).
 *
 * Texto exibido:
 *   - "Calculada a partir da DUM (DD/MM/AAAA)" quando origem = DUM
 *   - "Calculada a partir da USG #N (DD/MM/AAAA, laudo: Xs Yd)" quando origem = USG
 *
 * Quando não há dados de origem disponíveis, o ícone não renderiza (graceful).
 */

interface Props {
  /** Origem ativa do cálculo. */
  referenciaIg: 'dum' | 'usg' | null | undefined;
  /** Data da DUM (yyyy-MM-dd). Necessária quando referencia='dum'. */
  dum?: string | null;
  /** USG ativa quando referencia='usg'. Inclui ordem, data_exame, ig_semanas, ig_dias. */
  usgAtiva?: UsgRefInput | null;
  className?: string;
}

export default function IgOrigemTooltip({
  referenciaIg,
  dum,
  usgAtiva,
  className = '',
}: Props) {
  const { t } = useTranslation();
  let texto: string | null = null;

  if (referenciaIg === 'dum' && dum) {
    texto = t('ficha.igOrigemTooltip.origemDum', { data: formatDateBR(dum) });
  } else if (referenciaIg === 'usg' && usgAtiva) {
    const ordemLabel =
      usgAtiva.ordem === 1
        ? t('ficha.igOrigemTooltip.primeiraUsg')
        : t('ficha.igOrigemTooltip.usgOrdem', { ordem: usgAtiva.ordem });
    const laudoIg = `${usgAtiva.ig_semanas}s ${usgAtiva.ig_dias}d`;
    texto = t('ficha.igOrigemTooltip.origemUsg', {
      ordemLabel,
      data: formatDateBR(usgAtiva.data_exame),
      laudoIg,
    });
  }

  if (!texto) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('ficha.igOrigemTooltip.ariaLabel')}
            className={`inline-flex items-center ${className}`}
          >
            <Info className="h-3 w-3 text-[#7C4DBA]" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{texto}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

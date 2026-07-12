import { format } from 'date-fns';
import { Trans, useTranslation } from 'react-i18next';

interface JanelaGttCardProps {
  janelaGTT: { inicio: Date; fim: Date } | null;
  igMaior24: boolean;
}

/**
 * Card "Janela para GTT 75g" — exibido APENAS no laudo do Retorno 1
 * quando o resultado da glicemia de jejum é NEGATIVO (< 92 mg/dL).
 * Posicionado entre o Bloco 1 e o Bloco 2 do laudo.
 */
export default function JanelaGttCard({ janelaGTT, igMaior24 }: JanelaGttCardProps) {
  const { t } = useTranslation();
  if (!janelaGTT) return null;

  return (
    <div className="rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-3">
      <p className="text-sm font-semibold text-[#92400E]">{t('laudo.janelaGtt.title')}</p>
      <p className="mt-1 text-xs text-[#92400E]">
        {igMaior24 ? (
          t('laudo.janelaGtt.jaNaJanela')
        ) : (
          <Trans
            i18nKey="laudo.janelaGtt.instrucao"
            values={{
              inicio: format(janelaGTT.inicio, 'dd/MM/yyyy'),
              fim: format(janelaGTT.fim, 'dd/MM/yyyy'),
            }}
            components={{ strong: <strong /> }}
          />
        )}
      </p>
      <p className="mt-2 text-xs italic text-[#92400E]/80">
        {t('laudo.janelaGtt.nota')}
      </p>
    </div>
  );
}

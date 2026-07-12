import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * DivergenciaIgBanner — banner laranja informativo (não bloqueante) que aparece
 * quando o backend (Edge Function salvar-ficha-retorno) sinaliza divergência
 * maior que 7 dias entre a IG calculada pela DUM e a IG calculada pela USG
 * (Prompt 34B seção 3.9.4).
 *
 * Estado é EFÊMERO por sessão — vive na memória do form que recebeu a flag
 * na resposta do save. Não é persistido entre recargas (decisão acordada
 * durante o 34B.1 com o usuário).
 */

interface Props {
  ativo: boolean;
  className?: string;
}

export default function DivergenciaIgBanner({ ativo, className = '' }: Props) {
  const { t } = useTranslation();
  if (!ativo) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border-2 border-orange-400 bg-orange-50 p-3 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
      <p className="text-xs text-orange-900">
        <strong className="font-semibold">{t('ficha.divergenciaIg.label')}</strong>{' '}
        {t('ficha.divergenciaIg.mensagem')}
      </p>
    </div>
  );
}
